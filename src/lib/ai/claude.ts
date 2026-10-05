/**
 * claude.ts — the two AI calls the app makes: identify and assess.
 *
 * 📘 LEARN:
 *  - `messages.parse` + `zodOutputFormat` = "structured output": Claude must
 *    answer in exactly the shape we defined in types.ts, so the app can use the
 *    answer directly (no fragile text parsing).
 *  - Images are sent as base64 alongside text.
 *  - The API key is read from the environment (.env.local) on the SERVER only.
 *    It never reaches the browser.
 *  - Set PLANT_AI_MOCK=1 to get canned answers without spending API credit —
 *    handy for working on screens.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { Assessment, DEFAULT_HOME, Identification, type HomeInfo, type PlantBundle, type PlantQuestion, type Settings } from "@/lib/types";
import { ASSESS_SYSTEM, CHAT_SYSTEM, identifySystem } from "./prompts";
import { buildPlantContext } from "./context";
import { mockAssessment, mockIdentification } from "./mock";
import type { WeatherData } from "@/lib/weather";

export const MODEL = process.env.PLANT_AI_MODEL || "claude-sonnet-5";
/** Quick questions use a faster, cheaper model than full assessments (~1¢ vs ~5¢). */
export const CHAT_MODEL = process.env.PLANT_CHAT_MODEL || "claude-sonnet-5";
const MOCK = process.env.PLANT_AI_MOCK === "1";

type ImageInput = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };

function client() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local (or set PLANT_AI_MOCK=1).");
  }
  return new Anthropic();
}

/**
 * Turns Anthropic API errors into a sentence a person can act on, instead of
 * raw text like `401 {"type":"error",...}` (which is what Sarah saw on 1 Oct).
 */
export function friendlyAiError(e: unknown): Error {
  if (e instanceof Anthropic.APIError) {
    const msg = (e.message || "").toLowerCase();
    console.error(`[ai] API error ${e.status}:`, e.message);
    if (e.status === 401) return new Error("Couldn't reach Claude: the API key isn't working. Check ANTHROPIC_API_KEY (in Vercel → Settings → Environment Variables), then redeploy.");
    if (e.status === 403) return new Error("Couldn't reach Claude: this API key doesn't have permission for that model.");
    if (msg.includes("credit")) return new Error("Couldn't reach Claude: the Anthropic account is out of credit or has hit its monthly limit.");
    if (e.status === 429) return new Error("Claude is getting a lot of requests right now. Wait a minute and try again.");
    if (e.status === 529 || (e.status ?? 0) >= 500) return new Error("Claude is busy or briefly unavailable. Try again in a minute.");
    return new Error(`Couldn't reach Claude (error ${e.status}). Try again in a minute.`);
  }
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * structured() — ask Claude for JSON in an exact shape, defensively.
 *
 * 📘 LEARN (from our first real bug, 28 Sep): the answer came back cut off
 * mid-sentence ("Unterminated string in JSON"). The model ran out of its
 * output budget (`max_tokens`) before finishing. So this helper:
 *   1. gives a generous budget (you only pay for tokens actually used),
 *   2. checks *why* the model stopped (`stop_reason`),
 *   3. retries once with double the budget if it was cut off,
 *   4. validates the JSON against our zod schema,
 *   5. logs token usage so you can see what each call costs.
 */
/** Optional per-call stats, filled in by structured() — used by the model comparison script. */
export type CallStats = { model?: string; inputTokens?: number; outputTokens?: number; attempts?: number; ms?: number };

async function structured<T>(
  schema: z.ZodType<T>,
  params: { system: string; content: Anthropic.ContentBlockParam[]; maxTokens: number; label: string; model?: string; stats?: CallStats },
): Promise<T> {
  const model = params.model ?? MODEL;
  const started = Date.now();
  let budget = params.maxTokens;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res;
    try {
      res = await client().messages.create({
        model,
        max_tokens: budget,
        system: params.system,
        messages: [{ role: "user", content: params.content }],
        output_config: { format: zodOutputFormat(schema) },
      });
    } catch (e) {
      throw friendlyAiError(e);
    }

    const u = res.usage;
    if (params.stats) Object.assign(params.stats, { model, inputTokens: u.input_tokens, outputTokens: u.output_tokens, attempts: attempt, ms: Date.now() - started });
    console.log(`[ai] ${params.label} · ${model} · attempt ${attempt} · stop=${res.stop_reason} · in=${u.input_tokens} out=${u.output_tokens}`);

    if (res.stop_reason === "refusal") throw new Error("Claude declined to answer this one. Try a different photo or wording.");

    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    if (res.stop_reason === "max_tokens") {
      budget *= 2;
      continue; // cut off — try again with more room
    }

    try {
      const parsed = schema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
      console.error(`[ai] ${params.label}: answer didn't match the expected shape`, parsed.error.issues.slice(0, 3));
    } catch {
      console.error(`[ai] ${params.label}: answer wasn't valid JSON (first 200 chars): ${text.slice(0, 200)}`);
    }
    budget = Math.round(budget * 1.5);
  }
  throw new Error(`Couldn't get a complete ${params.label} from Claude after 2 tries. Check the Terminal for details.`);
}

export async function identifyPlant(images: ImageInput[], hint?: string, home: HomeInfo = DEFAULT_HOME): Promise<Identification> {
  if (MOCK) return mockIdentification;
  // 📘 Several photos of the same plant (whole plant, leaf close-up, stem base)
  // give Claude more clues — like a botanist turning the pot around.
  const content: Anthropic.ContentBlockParam[] = images.map((img) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
  }));
  const intro = images.length > 1 ? `These ${images.length} photos all show the SAME plant from different angles. Identify it.` : "Identify this plant.";
  content.push({ type: "text", text: hint ? `${intro} User note: ${hint}` : intro });
  return structured(Identification, { label: "identification", system: identifySystem(home), maxTokens: 4000, content });
}

export async function assessPlant(
  bundle: PlantBundle,
  photo?: ImageInput,
  opts: { model?: string; stats?: CallStats; settings?: Settings; home?: HomeInfo; weather?: { data: WeatherData; place: string } | null } = {},
): Promise<{ assessment: Assessment; briefing: string }> {
  const briefing = buildPlantContext(bundle, new Date(), opts.settings, opts.home, opts.weather);
  if (MOCK) return { assessment: mockAssessment, briefing };

  const content: Anthropic.ContentBlockParam[] = [];
  if (photo) {
    content.push({ type: "image", source: { type: "base64", media_type: photo.mediaType, data: photo.base64 } });
  }
  content.push({ type: "text", text: `Briefing:\n\n${briefing}\n\nAssess this plant and advise what to do next.` });

  const assessment = await structured(Assessment, {
    label: "assessment",
    system: ASSESS_SYSTEM,
    maxTokens: 8000,
    content,
    model: opts.model,
    stats: opts.stats,
  });
  return { assessment, briefing };
}

/**
 * askPlant() — answer one quick question, streaming the words as they arrive.
 *
 * 📘 LEARN: `stream: true` makes Claude send the answer in small pieces
 * ("deltas") instead of all at once, so the phone can show words appearing
 * within a second. This is an *async generator*: the caller loops over it with
 * `for await (const piece of askPlant(...))`.
 */
export async function* askPlant(
  bundle: PlantBundle,
  question: string,
  opts: {
    settings?: Settings;
    home?: HomeInfo;
    weather?: { data: WeatherData; place: string } | null;
    photo?: ImageInput;
    recent?: PlantQuestion[];
    askerName?: string;
  } = {},
): AsyncGenerator<string> {
  if (MOCK) {
    for (const word of "Those white speckles are most likely mineral deposits from tap water. They're harmless; wipe gently with a damp cloth and water the soil rather than the leaves.".split(" ")) {
      await new Promise((r) => setTimeout(r, 40));
      yield word + " ";
    }
    return;
  }

  const briefing = buildPlantContext(bundle, new Date(), opts.settings, opts.home, opts.weather);
  const earlier = (opts.recent ?? [])
    .slice()
    .reverse() // oldest first reads like a conversation
    .map((q) => `Q (${q.askerName}): ${q.question}\nA: ${q.answer}`)
    .join("\n\n");

  const content: Anthropic.ContentBlockParam[] = [];
  if (opts.photo) content.push({ type: "image", source: { type: "base64", media_type: opts.photo.mediaType, data: opts.photo.base64 } });
  content.push({
    type: "text",
    text:
      `Briefing:\n\n${briefing}\n\n` +
      (earlier ? `## Recent questions about this plant (oldest first)\n${earlier}\n\n` : "") +
      `New question${opts.askerName ? ` from ${opts.askerName}` : ""}${opts.photo ? " (photo attached)" : ""}: ${question}`,
  });

  let stream;
  try {
    stream = await client().messages.create({
      model: CHAT_MODEL,
      max_tokens: 350, // ~250 words: a backstop — the instructions ask for 80
      system: CHAT_SYSTEM,
      messages: [{ role: "user", content }],
      stream: true,
    });
  } catch (e) {
    throw friendlyAiError(e);
  }

  let out = 0;
  try {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
      if (event.type === "message_delta") {
        out = event.usage.output_tokens;
        if (event.delta.stop_reason === "max_tokens") yield "…";
      }
    }
  } catch (e) {
    throw friendlyAiError(e);
  }
  console.log(`[ai] chat · ${CHAT_MODEL} · out=${out}`);
}

