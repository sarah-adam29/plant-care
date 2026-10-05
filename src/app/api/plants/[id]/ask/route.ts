/**
 * POST /api/plants/<id>/ask — "Ask about <plant>".
 *
 * 📘 LEARN: This is a Route Handler rather than a Server Action because it
 * *streams*: the response starts straight away and Claude's words are written
 * into it as they arrive, so the phone shows the answer appearing live. When
 * the answer is finished, the question and answer are saved on the plant.
 */
import { store } from "@/lib/store";
import { askPlant, CHAT_MODEL } from "@/lib/ai/claude";
import { isOutdoor } from "@/lib/environment";
import { getHomeWeather } from "@/lib/home-weather";

export const maxDuration = 60; // seconds — plenty for a short answer

type Body = { question?: string; photo?: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" } };

function fail(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Couldn't read the question.");
  }
  const question = (body.question ?? "").trim();
  if (!question) return fail(400, "Type a question first.");
  if (question.length > 1000) return fail(400, "That's a long one — keep it under 1,000 characters.");

  let bundle, viewer, settings, recent;
  try {
    [bundle, viewer, settings, recent] = await Promise.all([store.getPlant(id), store.getViewer(), store.getSettings(), store.listQuestions(id, 3)]);
  } catch {
    return fail(401, "Please sign in again.");
  }
  if (!bundle) return fail(404, "Plant not found.");
  if (!(await store.useAi())) return fail(429, "Your home has used today's 30 AI actions. They reset tomorrow.");

  // Keep the photo with the question, so you can see later what was asked about.
  const photo = body.photo;
  const photoUrl = photo ? await store.savePhoto(Buffer.from(photo.base64, "base64"), photo.mediaType.split("/")[1]) : null;

  const weather = isOutdoor(bundle.plant.current) ? await getHomeWeather(viewer.home) : null;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      try {
        for await (const piece of askPlant(bundle, question, { settings, home: viewer.home, weather, photo, recent, askerName: viewer.name })) {
          answer += piece;
          controller.enqueue(encoder.encode(piece));
        }
        await store.addQuestion({ plantId: id, askerName: viewer.name, question, answer: answer.trim(), photoUrl, model: CHAT_MODEL });
      } catch (e) {
        const msg = `${answer ? "\n\n" : ""}Sorry — ${(e as Error).message}`;
        controller.enqueue(encoder.encode(msg));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
