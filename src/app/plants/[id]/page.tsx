/**
 * plants/[id]/page.tsx — one plant's full record.
 *
 * Order follows the core loop: Understand (who it is) → Assess (diagnosis) →
 * Act (do now / monitor / longer term, checks) → Record (log + timeline) →
 * Reassess (coach button). Sections are separated by hairlines, not boxes.
 */
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { store } from "@/lib/store";
import { STATUS, Section, SeverityTag, StatusLine, formatDue } from "@/components/ui";
import { completeCheckAction, logEventAction, setMainPhotoAction } from "@/app/actions";
import { CoachButton } from "./coach-button";
import { AskBox } from "./ask-box";
import { DeletePlantButton } from "./delete-button";
import { DeleteEventButton } from "./delete-event-button";
import { MoistureCard } from "./moisture-card";
import { effectiveTarget } from "@/lib/moisture";
import { EVENT_TYPES, type EventType } from "@/lib/types";
import { envLabels, envValue, isOutdoor } from "@/lib/environment";
import { getHomeWeather } from "@/lib/home-weather";
import { weatherAlerts, weekSummary } from "@/lib/weather";

const EVENT_LABEL: Record<EventType, string> = {
  watered: "Watered",
  "checked-soil": "Checked soil",
  moved: "Moved",
  repotted: "Repotted",
  pruned: "Pruned",
  fertilized: "Fertilised",
  treated: "Treated",
  symptom: "Symptom",
  photo: "Photo",
  "caretaker-change": "New caretaker",
  "conditions-changed": "Conditions updated",
  "moisture-reading": "Moisture reading",
  note: "Note",
};

const field = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-[15px] outline-none focus:border-leaf";

export default async function PlantPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const [bundle, settings, viewer, questions] = await Promise.all([store.getPlant(id), store.getSettings(), store.getViewer(), store.listQuestions(id, 5)]);
  if (!bundle) notFound();
  // Outdoor plants: this week's weather (cached for an hour; skipped indoors).
  const weather = isOutdoor(bundle.plant.current) ? await getHomeWeather(viewer.home) : null;
  const alerts = weather ? weatherAlerts(weather.data, viewer.home.units) : [];
  const hasMeter = settings.equipment.includes("moisture-meter");
  const target = effectiveTarget(bundle);
  const recentReadings = bundle.events
    .filter((e) => e.type === "moisture-reading" && e.reading != null)
    .slice(0, 7)
    .map((e) => ({ reading: e.reading!, date: e.occurredAt }));
  const { plant: p, latest: a, events, checks } = bundle;
  const openChecks = checks.filter((c) => !c.doneAt);
  const today = new Date().toISOString().slice(0, 10);
  // Entries logged since the last assessment → nudge to refresh the advice
  const newSinceAdvice = a ? events.filter((e) => e.loggedAt && e.loggedAt > a.createdAt).length : events.length;
  // Every photo we have of this plant (main photo first), for the Photos strip
  const photos = Array.from(new Set([p.photoUrl, ...events.map((e) => e.photoUrl)].filter((u): u is string => !!u)));
  const whereItLives = envLabels(p.current).map(([k, label]) => [label, envValue(k, p.current, viewer.home.units)] as const).filter(([, v]) => v);

  return (
    <div className="space-y-7">
      <Link href="/" className="inline-block pt-1 text-sm text-muted hover:text-leaf">← All plants</Link>

      {/* ── Identity ─────────────────────────────── */}
      <div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[10px] bg-tint sm:aspect-[16/9]">
          {p.photoUrl && <Image src={p.photoUrl} alt={p.nickname} fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" unoptimized={p.photoUrl.startsWith("/api/")} priority />}
        </div>
        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[34px] leading-none tracking-[-0.03em]">{p.nickname}</h1>
            <p className="mt-1.5 text-[15px]">
              {p.commonName} · <i className="text-muted">{p.botanicalName}</i>
            </p>
          </div>
          <StatusLine status={a?.status} className="mt-2 shrink-0" />
        </div>
        <p className="mt-1 text-[13px] text-muted">
          Owner {p.owner} · Cared for by {p.caretaker} · ID confidence {p.idConfidence}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/85">{p.description}</p>
      </div>

      {/* ── Assessment ───────────────────────────── */}
      {a ? (
        <div className={`rounded-[10px] p-5 ${STATUS[a.status].soft}`}>
          <p className="text-[19px] font-bold leading-snug tracking-tight">{a.headline}</p>
          <p className="mt-2 text-[15px] leading-relaxed">{a.diagnosis}</p>
          {a.likelyCauses.length > 0 && (
            <div className="mt-4 space-y-2.5">
              {a.likelyCauses.map((c, i) => (
                <div key={i} className="text-sm">
                  <span className="font-semibold">{c.cause}</span> <span className="text-muted">· {c.confidence} confidence</span>
                  <span className="block text-muted">{c.evidence}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-muted">
            Assessed {a.createdAt.slice(0, 10)} · {a.model}
          </p>
        </div>
      ) : (
        <p className="text-muted">No assessment yet. Tap “What should I do next?” below.</p>
      )}

      <CoachButton plantId={p.id} newSinceAdvice={newSinceAdvice} />

      {a && a.questions.length > 0 && (
        <Section title="Questions that would sharpen this" hint="Answer below, or by logging a note">
          <ul className="list-disc space-y-1 pl-5 text-[15px]">
            {a.questions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </Section>
      )}

      <AskBox plantId={p.id} nickname={p.nickname} questions={questions} />

      {/* ── Recommendations ──────────────────────── */}
      {a && (
        <Section title="What to do">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { title: "Do now", items: a.doNow, cls: "text-stressed" },
              { title: "Monitor", items: a.monitor, cls: "text-watch" },
              { title: "Longer term", items: a.longerTerm, cls: "text-healthy" },
            ].map((col) => (
              <div key={col.title}>
                <h3 className={`mb-2 flex items-center gap-2 text-[15px] ${col.cls}`}>
                  <span aria-hidden className="h-[3px] w-3.5 rounded-[1px] bg-current" />
                  {col.title}
                </h3>
                <ul className="space-y-2 text-[15px] leading-snug">
                  {col.items.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Where it lives (editable) ────────────── */}
      <Section>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-[19px]">Where it lives</h2>
          <Link href={`/plants/${p.id}/environment`} className="rounded-md border border-line px-3 py-1.5 text-[13px] font-semibold hover:border-leaf hover:text-leaf">
            Edit
          </Link>
        </div>
        <dl className="grid grid-cols-[150px_1fr] gap-x-4 gap-y-2 text-[15px]">
          {whereItLives.map(([label, v]) => (
            <div key={label} className="contents">
              <dt className="text-muted">{label}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {weather && (
          <div className="mt-4 border-t border-line pt-3 text-sm">
            <p className="text-muted">
              Weather at {weather.place.split(",")[0]} · {weekSummary(weather.data, viewer.home.units)}
            </p>
            {alerts.length > 0 && <p className="mt-1 font-semibold text-stressed">{alerts.map((x) => x.text).join(" · ")}</p>}
          </div>
        )}
      </Section>

      {/* ── Ideal vs current ─────────────────────── */}
      {a && a.mismatches.length > 0 && (
        <Section title="Ideal vs current">
          <div className="divide-y divide-line">
            {a.mismatches.map((m, i) => (
              <div key={i} className="py-3 first:pt-0">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold">{m.factor}</span>
                  <SeverityTag severity={m.severity} />
                </div>
                <div className="mt-1 grid grid-cols-2 gap-3 text-sm">
                  <div><span className="block text-xs text-muted">Likes</span>{m.ideal}</div>
                  <div><span className="block text-xs text-muted">Has</span>{m.current}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Moisture meter ───────────────────────── */}
      {hasMeter ? (
        <Section title="Moisture">
          <MoistureCard
            plantId={p.id}
            caretaker={p.caretaker}
            target={target}
            potHasDrainage={p.current.potSetup === "drainage" || p.current.potSetup === "cachepot"}
            recent={recentReadings}
          />
        </Section>
      ) : (
        <p className="text-sm text-muted">
          Have a moisture meter?{" "}
          <Link href="/settings" className="font-semibold underline hover:text-leaf">Add it to your equipment</Link> to log readings here.
        </p>
      )}

      {/* ── Checks ───────────────────────────────── */}
      <Section title="Next checks" hint="Adapts after every assessment">
        {openChecks.length === 0 && <p className="text-sm text-muted">Nothing scheduled.</p>}
        <ul className="divide-y divide-line">
          {openChecks.map((c) => {
            const d = formatDue(c.dueOn);
            return (
              <li key={c.id} className="flex items-center gap-3 py-3 first:pt-0">
                <span className={`w-16 shrink-0 text-[13px] font-semibold ${d.tone}`}>{d.text}</span>
                <span className="flex-1 text-[15px]">{c.task}</span>
                <form action={completeCheckAction}>
                  <input type="hidden" name="checkId" value={c.id} />
                  <button className="rounded-md border border-line px-3 py-1.5 text-[13px] font-semibold hover:border-leaf hover:text-leaf">Done</button>
                </form>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* ── Log something ────────────────────────── */}
      <Section title="Log something" hint="Moved or repotted? Use Edit under Where it lives">
        <form action={logEventAction} className="grid grid-cols-2 gap-3 text-sm">
          <input type="hidden" name="plantId" value={p.id} />
          <label>
            <span className="text-[13px] text-muted">What happened</span>
            <select name="type" defaultValue="watered" className={field}>
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_LABEL[t]}</option>)}
            </select>
          </label>
          <label>
            <span className="text-[13px] text-muted">Who</span>
            <input name="actor" defaultValue={p.caretaker} className={field} />
          </label>
          <label className="col-span-2">
            <span className="text-[13px] text-muted">Note</span>
            <input name="note" placeholder="e.g. Soil still damp at 5 cm, didn't water" className={field} />
          </label>
          <label>
            <span className="text-[13px] text-muted">When</span>
            <input type="date" name="occurredAt" defaultValue={today} className={field} />
          </label>
          <div className="flex items-end">
            <button className="h-[46px] w-full rounded-lg bg-leaf px-3 text-[15px] font-semibold text-white hover:bg-leaf/90">Add to timeline</button>
          </div>
        </form>
      </Section>

      {/* ── Timeline ─────────────────────────────── */}
      <Section title="Timeline">
        <ol className="space-y-4">
          {events.map((e) => (
            <li key={e.id} className="grid grid-cols-[76px_1fr] gap-3">
              <div className="text-[13px] text-muted">
                {e.approximate ? "~" : ""}
                {new Date(e.occurredAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </div>
              <div>
                <div className="flex items-start justify-between gap-2 text-[15px]">
                  <span>
                    <span className="font-semibold">{EVENT_LABEL[e.type] ?? e.type}</span> <span className="text-muted">· {e.actor}</span>
                  </span>
                  <DeleteEventButton plantId={p.id} eventId={e.id} />
                </div>
                <div className="text-sm text-ink/85">{e.note}</div>
                {e.photoUrl && (
                  <div className="relative mt-2 h-28 w-24 overflow-hidden rounded-md">
                    <Image src={e.photoUrl} alt="" fill sizes="96px" className="object-cover" unoptimized={e.photoUrl.startsWith("/api/")} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── Photos (choose the main one) ────────── */}
      {photos.length > 1 && (
        <Section title="Photos" hint="Choose which one shows in your plant list">
          <div className="grid grid-cols-3 gap-2.5">
            {photos.map((url) => {
              const isMain = url === p.photoUrl;
              return (
                <div key={url}>
                  <div className={`relative aspect-square overflow-hidden rounded-lg bg-tint ${isMain ? "ring-2 ring-leaf ring-offset-2" : ""}`}>
                    <Image src={url} alt="" fill sizes="33vw" className="object-cover" unoptimized={url.startsWith("/api/")} />
                  </div>
                  {isMain ? (
                    <p className="mt-1.5 text-[12px] font-semibold text-leaf">Main photo</p>
                  ) : (
                    <form action={setMainPhotoAction}>
                      <input type="hidden" name="plantId" value={p.id} />
                      <input type="hidden" name="photoUrl" value={url} />
                      <button className="mt-1.5 text-[12px] font-semibold text-muted underline hover:text-leaf">Make main</button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Care profile ─────────────────────────── */}
      <Section title="Care profile">
        <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2.5 text-[15px]">
          {Object.entries({
            Light: p.ideal.light,
            Temperature: p.ideal.temperature,
            Humidity: p.ideal.humidity,
            Watering: p.ideal.watering,
            Soil: p.ideal.soil,
            Drainage: p.ideal.drainage,
            "Sensitive to": p.ideal.sensitivities.join(", "),
            Toxicity: p.ideal.toxicity,
          }).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <div className="border-t border-line pt-5">
        <DeletePlantButton plantId={p.id} nickname={p.nickname} />
      </div>
    </div>
  );
}
