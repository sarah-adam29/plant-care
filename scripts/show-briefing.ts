/**
 * show-briefing.ts — print exactly what Claude will be told about a plant.
 * Usage:  npm run briefing -- spike
 *
 * 📘 LEARN: When advice looks wrong, look here first. If a fact isn't in the
 * briefing, Claude can't use it.
 */
import { store } from "../src/lib/store";
import { buildPlantContext } from "../src/lib/ai/context";

async function main() {
  const id = process.argv[2] ?? "spike";
  const b = await store.getPlant(id);
  if (!b) throw new Error(`No plant with id "${id}"`);
  console.log(buildPlantContext(b, new Date(), await store.getSettings(), (await store.getViewer()).home));
}
main();
