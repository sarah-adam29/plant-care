/**
 * Serves plant photos.
 *  - /api/photos/<file>               → local file in .data/photos (local mode)
 *  - /api/photos/sb/<home>/<file>     → Supabase Storage, as the signed-in person,
 *                                       so the security rules decide who can see it.
 */
import { promises as fs } from "fs";
import path from "path";
import { PHOTO_DIR } from "@/lib/store/local-file";
import { supabaseServer } from "@/lib/supabase/server";
import { PHOTO_BUCKET } from "@/lib/store/supabase";

const TYPE = (name: string) => (name.endsWith("png") ? "image/png" : name.endsWith("webp") ? "image/webp" : "image/jpeg");
const FILE = /^[\w-]+\.(jpeg|jpg|png|webp)$/;

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;

  if (parts[0] === "sb" && parts.length === 3 && /^[0-9a-f-]{36}$/.test(parts[1]) && FILE.test(parts[2])) {
    const sb = await supabaseServer();
    const { data, error } = await sb.storage.from(PHOTO_BUCKET).download(`${parts[1]}/${parts[2]}`);
    if (error || !data) return new Response("Not found", { status: 404 });
    return new Response(data, { headers: { "Content-Type": TYPE(parts[2]), "Cache-Control": "private, max-age=86400" } });
  }

  if (parts.length === 1 && FILE.test(parts[0])) {
    try {
      const bytes = await fs.readFile(path.join(PHOTO_DIR, parts[0]));
      return new Response(new Uint8Array(bytes), { headers: { "Content-Type": TYPE(parts[0]), "Cache-Control": "max-age=31536000, immutable" } });
    } catch {
      /* fall through */
    }
  }
  return new Response("Not found", { status: 404 });
}
