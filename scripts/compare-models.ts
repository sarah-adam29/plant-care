/**
 * compare-models.ts — run the same plants through two Claude models and compare.
 *
 * Usage:  npm run compare
 *         npm run compare -- spike birdie        (choose plants)
 *
 * 📘 LEARN: This is an "eval" — the same inputs through different models (or
 * prompts), scored against answers we already trust (our Phase 0 hand
 * diagnoses). It reads your real plant data but DOES NOT change it: results go
 * to a report in .data/reports/, not into the app.
 */
import { promises as fs } from "fs";
import path from "path";
import { store } from "../src/lib/store";
import { assessPlant, type CallStats } from "../src/lib/ai/claude";
import type { Assessment } from "../src/lib/types";

const MODELS = [
  { id: "claude-sonnet-5", label: "Sonnet 5", inPerM: 2, outPerM: 10 },
  { id: "claude-opus-5-5", label: "Opus 5.5", inPerM: 4, outPerM: 20 },
];

// What we concluded by hand in Phase 0 — each check is a label + a pattern to look for.
const EXPECTED: Record<string, { label: string; re: RegExp }[]> = {
  spike: [
    { label: "Waterlogging / no drainage", re: /waterlog|drainage|soggy|wet roots/i },
    { label: "Change of cleaner / caretaker", re: /cleaner|caretaker|took over|someone else/i },
    { label: "Tap water / salts", re: /tap water|salt|fluoride|mineral/i },
    { label: "Repeated moves", re: /moved|moving|relocat|shuffl/i },
  ],
  birdie: [
    { label: "Sun / heat scorch at the glass", re: /scorch|sunburn|heat|glass|direct sun/i },
    { label: "No drainage / roots", re: /drainage|waterlog|roots|soggy/i },
    { label: "Apartment move in summer", re: /move|moved|new apartment|summer/i },
  ],
  "big-spike": [
    { label: "Tap water / salt build-up", re: /tap water|salt|fluoride|mineral/i },
    { label: "Spider mites", re: /mite/i },
    { label: "Leaf spot", re: /leaf spot|fung|bacteri/i },
    { label: "No drainage", re: /drainage/i },
  ],
};
const DEFAULT_PLANTS = ["spike", "birdie", "big-spike"];

function allText(a: Assessment) {
  return [a.headline, a.diagnosis, ...a.likelyCauses.map((c) => `${c.cause} ${c.evidence}`), ...a.doNow, ...a.monitor, ...a.longerTerm].join(" \n ");
}

function scheduleViolation(a: Assessment) {
  return /every \d+\s*(-|–|to)?\s*\d*\s*days|once a week|weekly water|water (it )?every/i.test(allText(a));
}

type Row = { plant: string; model: (typeof MODELS)[number]; a?: Assessment; stats: CallStats; error?: string };

async function main() {
  const plants = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PLANTS;
  const bundles = await Promise.all(plants.map((id) => store.getPlant(id)));
  const missing = plants.filter((_, i) => !bundles[i]);
  if (missing.length) throw new Error(`Not found: ${missing.join(", ")}`);

  console.log(`Comparing ${MODELS.map((m) => m.label).join(" vs ")} on ${plants.join(", ")} — running ${plants.length * MODELS.length} assessments in parallel…\n`);

  const settings = await store.getSettings();
  const { home } = await store.getViewer();
  const jobs: Promise<Row>[] = [];
  plants.forEach((plant, i) => {
    for (const model of MODELS) {
      const stats: CallStats = {};
      jobs.push(
        assessPlant(bundles[i]!, undefined, { model: model.id, stats, settings, home })
          .then(({ assessment }) => ({ plant, model, a: assessment, stats }))
          .catch((e) => ({ plant, model, stats, error: (e as Error).message })),
      );
    }
  });
  const rows = await Promise.all(jobs);

  const cost = (r: Row) => ((r.stats.inputTokens ?? 0) * r.model.inPerM + (r.stats.outputTokens ?? 0) * r.model.outPerM) / 1_000_000;
  const hits = (r: Row) => (EXPECTED[r.plant] ?? []).map((e) => ({ ...e, hit: r.a ? e.re.test(allText(r.a)) : false }));

  // ── Summary table ──
  let md = `# Model comparison — ${new Date().toISOString().slice(0, 16).replace("T", " ")}\n\n`;
  md += `| Plant | Model | Expected causes found | Fixed schedule? | Time | Tokens in/out | Cost |\n|---|---|---|---|---|---|---|\n`;
  for (const r of rows) {
    const h = hits(r);
    md += `| ${r.plant} | ${r.model.label} | ${r.error ? "ERROR" : `${h.filter((x) => x.hit).length}/${h.length}`} | ${r.a ? (scheduleViolation(r.a) ? "⚠️ yes" : "no") : "–"} | ${r.stats.ms ? (r.stats.ms / 1000).toFixed(0) + "s" : "–"} | ${r.stats.inputTokens ?? "–"}/${r.stats.outputTokens ?? "–"} | $${cost(r).toFixed(3)} |\n`;
  }
  for (const m of MODELS) {
    const mine = rows.filter((r) => r.model.id === m.id);
    const found = mine.reduce((s, r) => s + hits(r).filter((x) => x.hit).length, 0);
    const total = mine.reduce((s, r) => s + hits(r).length, 0);
    const avgS = mine.reduce((s, r) => s + (r.stats.ms ?? 0), 0) / mine.length / 1000;
    md += `\n**${m.label}:** ${found}/${total} expected causes · avg ${avgS.toFixed(0)}s · total $${mine.reduce((s, r) => s + cost(r), 0).toFixed(3)}`;
  }
  md += "\n\n---\n";

  // ── Full answers side by side, per plant ──
  for (const plant of plants) {
    md += `\n## ${plant}\n`;
    for (const r of rows.filter((x) => x.plant === plant)) {
      md += `\n### ${r.model.label}\n`;
      if (r.error || !r.a) { md += `Error: ${r.error}\n`; continue; }
      const a = r.a;
      md += `**Status:** ${a.status} — ${a.headline}\n\n${a.diagnosis}\n\n`;
      md += `**Causes:**\n${a.likelyCauses.map((c) => `- ${c.cause} (${c.confidence}) — ${c.evidence}`).join("\n")}\n\n`;
      md += `**Checklist:** ${hits(r).map((h) => `${h.hit ? "✅" : "❌"} ${h.label}`).join(" · ")}\n\n`;
      md += `**Do now:**\n${a.doNow.map((x) => `- ${x}`).join("\n")}\n\n`;
      md += `**Questions:**\n${a.questions.map((x) => `- ${x}`).join("\n") || "- (none)"}\n`;
    }
  }

  const dir = path.join(process.cwd(), ".data", "reports");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `model-comparison-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.md`);
  await fs.writeFile(file, md);

  console.log(md.split("\n---\n")[0]);
  console.log(`\nFull report: ${path.relative(process.cwd(), file)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
