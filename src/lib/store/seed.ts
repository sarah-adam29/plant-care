/**
 * seed.ts — your five Phase 0 plants, so the app has real data on day one.
 *
 * 📘 LEARN: This is the same content as the plant records in the project,
 * translated into the app's data model (see types.ts). These also double as
 * test cases: when we change a prompt, we re-assess these plants and check the
 * AI still reaches the diagnoses we agreed on by hand.
 */
import type { Check, Plant, PlantEvent, StoredAssessment } from "@/lib/types";

const HOME = "Sarah — Dubai flat";
const ASSESSED = "2026-09-28T09:00:00.000Z";

const plants: Plant[] = [
  {
    id: "rapunzel",
    nickname: "Rapunzel",
    commonName: "Satin pothos",
    botanicalName: "Scindapsus pictus 'Exotica'",
    idConfidence: "high",
    description:
      "A trailing climber from Southeast Asia with silver-splashed, matte leaves. Easy-going, but sulks when roots stay wet. Leaves curl inward when thirsty — a built-in moisture signal.",
    owner: "Sarah",
    caretaker: "Sarah",
    home: HOME,
    photoUrl: "/seed/rapunzel.jpg",
    ideal: {
      light: "Bright indirect; tolerates gentle sun",
      temperature: "18–29°C; avoid cold drafts",
      humidity: "40–60%+",
      watering: "Water when the top half of the soil is dry",
      soil: "Chunky, airy aroid mix",
      drainage: "Essential — no standing water",
      sensitivities: ["soggy roots"],
      toxicity: "Toxic to pets if eaten",
    },
    current: {
      room: "Living room (bookshelf)",
      windowDirection: "S",
      distanceFromWindowCm: 20,
      directSun: "brief",
      nearAc: "no",
      potSetup: "cachepot",
      waterSource: "tap",
      wateringHabit: "Was weekly; now reducing",
      notes: "Sheer curtain nearby; AC on opposite wall",
    },
    createdAt: "2026-09-28T08:00:00.000Z",
  },
  {
    id: "spike",
    nickname: "Spike",
    commonName: "Corn plant",
    botanicalName: "Dracaena fragrans (possibly 'Limelight')",
    idConfidence: "high",
    description:
      "Tough and slow-growing, happiest when left alone. Dislikes wet roots, being moved, and salty or fluoride-heavy water.",
    owner: "Partner",
    caretaker: "Sarah",
    home: HOME,
    photoUrl: "/seed/spike.jpg",
    ideal: {
      light: "Medium–bright indirect; no direct sun on leaves",
      temperature: "18–29°C",
      humidity: "40%+",
      watering: "Let the top ½–¾ of the soil dry out",
      soil: "Well-draining potting mix with perlite",
      drainage: "Essential",
      sensitivities: ["being moved", "salts/fluoride in tap water", "wet roots"],
      toxicity: "Toxic to cats and dogs",
    },
    current: {
      room: "Study",
      windowDirection: "S",
      distanceFromWindowCm: 30,
      directSun: "brief",
      nearAc: "unknown",
      potSetup: "no-drainage",
      waterSource: "tap",
      wateringHabit: "Irregular; was waterlogged",
      notes: "Rootbound; moved repeatedly in recent weeks",
    },
    createdAt: "2026-09-28T08:01:00.000Z",
  },
  {
    id: "birdie",
    nickname: "Birdie",
    commonName: "Bird of paradise",
    botanicalName: "Strelitzia reginae",
    idConfidence: "medium",
    description:
      "A full-sun plant outdoors, but indoor plants scorch under sudden or intense sun and heat. Fast-growing, gets large, and leaf splits are normal.",
    owner: "Sarah",
    caretaker: "Sarah",
    home: HOME,
    photoUrl: "/seed/birdie.jpg",
    ideal: {
      light: "Very bright, with some direct sun it's used to",
      temperature: "18–30°C",
      humidity: "40%+",
      watering: "Water when the top 5 cm is dry; must drain",
      soil: "Chunky, well-draining",
      drainage: "Essential",
      sensitivities: ["sudden light/heat increases", "sitting in water"],
      toxicity: "Mildly toxic to pets",
    },
    current: {
      room: "Living room (window ledge)",
      windowDirection: "S",
      distanceFromWindowCm: 15,
      directSun: "several-hours",
      nearAc: "no",
      potSetup: "no-drainage",
      waterSource: "tap",
      wateringHabit: "Weekly",
      notes: "High floor, floor-to-ceiling glass, no external shading",
    },
    createdAt: "2026-09-28T08:02:00.000Z",
  },
  {
    id: "big-spike",
    nickname: "Big Spike",
    commonName: "Corn plant (multi-cane)",
    botanicalName: "Dracaena fragrans ('Lemon Lime' / 'Dorado' type)",
    idConfidence: "high",
    description:
      "Spike's bigger sibling. Tolerates low light and neglect; dislikes wet roots, salty tap water and very dry air (which invites spider mites).",
    owner: "Partner",
    caretaker: "Sarah",
    home: HOME,
    photoUrl: "/seed/big-spike.jpg",
    ideal: {
      light: "Medium–bright indirect",
      temperature: "18–29°C",
      humidity: "40%+",
      watering: "Let the top ½–¾ of the soil dry out",
      soil: "Well-draining potting mix",
      drainage: "Essential",
      sensitivities: ["salts/fluoride in tap water", "dry air", "wet roots"],
      toxicity: "Toxic to cats and dogs",
    },
    current: {
      room: "Living room (by TV)",
      windowDirection: "S",
      distanceFromWindowCm: 400,
      directSun: "none",
      nearAc: "yes",
      potSetup: "no-drainage",
      waterSource: "tap",
      wateringHabit: "Unknown — recently switched from bottled to tap",
      notes: "~1.5 m from AC",
    },
    createdAt: "2026-09-28T08:03:00.000Z",
  },
  {
    id: "ruby",
    nickname: "Ruby",
    commonName: "Anthurium",
    botanicalName: "Anthurium andraeanum",
    idConfidence: "high",
    description:
      "A tropical epiphyte with waxy red spathes. Wants airy soil, even moisture, humidity and bright indirect light. Each 'flower' lasts 6–8 weeks, then fades.",
    owner: "Sarah",
    caretaker: "Sarah",
    home: HOME,
    photoUrl: "/seed/ruby.jpg",
    ideal: {
      light: "Bright indirect; no direct sun",
      temperature: "18–29°C",
      humidity: "50%+",
      watering: "Keep lightly moist; water when the top 2–3 cm is dry",
      soil: "Chunky aroid mix (soil + orchid bark + perlite)",
      drainage: "Essential",
      sensitivities: ["soggy roots", "dry air"],
      toxicity: "Toxic to pets if eaten",
    },
    current: {
      room: "Study (desk)",
      windowDirection: "S",
      distanceFromWindowCm: 50,
      directSun: "none",
      nearAc: "no",
      potSetup: "no-drainage",
      waterSource: "tap",
      wateringHabit: "Weekly",
      notes: "Mostly shaded by curtain and wall",
    },
    createdAt: "2026-09-28T08:04:00.000Z",
  },
];

const assessments: StoredAssessment[] = [
  {
    id: "a-rapunzel",
    plantId: "rapunzel",
    createdAt: ASSESSED,
    model: "manual (Phase 0)",
    status: "watch",
    headline: "Recovering from overwatering — new growth is a good sign.",
    diagnosis:
      "Yellowing started on older leaves near the base ~4 weeks ago, with a nursery pot inside a cachepot and weekly watering in an AC room. You've already reduced watering, which fits the likely cause.",
    likelyCauses: [
      { cause: "Overwatering / water pooling in cachepot", confidence: "high", evidence: "Older-leaf yellowing; cachepot; weekly schedule" },
      { cause: "Localised sun stress", confidence: "low", evidence: "One pale lime leaf" },
    ],
    mismatches: [
      { factor: "Light", ideal: "Bright indirect", current: "20 cm from south window", severity: "minor" },
      { factor: "Watering", ideal: "When top half is dry", current: "Was weekly", severity: "major" },
      { factor: "Drainage", ideal: "No standing water", current: "Cachepot", severity: "minor" },
      { factor: "Humidity", ideal: "40–60%+", current: "AC-dried air", severity: "minor" },
    ],
    doNow: [
      "Check the cachepot for standing water and empty it",
      "Water only when soil is dry halfway down or leaves curl slightly",
      "Root the 2 cuttings in water, then plant them back into the top of the pot",
    ],
    monitor: ["Days for soil to dry at 5 cm", "Any new yellowing", "Bleaching on window-facing leaves through October"],
    longerTerm: [
      "Oct–Mar: sheer curtain at midday or move ~50 cm back",
      "Fertilise monthly at half strength Mar–Oct once stable",
      "Rotate every 2–3 weeks",
    ],
    nextChecks: [],
    questions: [],
  },
  {
    id: "a-spike",
    plantId: "spike",
    createdAt: ASSESSED,
    model: "manual (Phase 0)",
    status: "stressed",
    headline: "Waterlogged and rootbound — roots and crown are healthy, so it should recover.",
    diagnosis:
      "Decline began around the time a new caretaker took over watering and watering increased, in a pot with no drainage. Recent moves and a switch to tap water added stress. Roots are mostly firm orange/tan and the crown is firm.",
    likelyCauses: [
      { cause: "Waterlogging in undrained, rootbound pot", confidence: "high", evidence: "Water squeezed from soil 27 Sep; no holes" },
      { cause: "Change of caretaker changed watering", confidence: "medium", evidence: "Decline since ~Jun–Jul, when the caretaker changed" },
      { cause: "Sun scorch during moves", confidence: "medium", evidence: "Papery tan mid-leaf patches" },
    ],
    mismatches: [
      { factor: "Drainage", ideal: "Essential", current: "No holes", severity: "major" },
      { factor: "Watering", ideal: "Top ½–¾ dry", current: "Waterlogged", severity: "major" },
      { factor: "Stability", ideal: "Same spot", current: "Moved repeatedly", severity: "major" },
      { factor: "Water quality", ideal: "Filtered", current: "Tap", severity: "minor" },
    ],
    doNow: [
      "Repot one size up into a pot with drainage; tease out circling roots",
      "No water for ~7 days after repotting",
      "Pick one bright spot out of the sun patches and stop moving it",
      "Agree one person waters Spike; use bottled/filtered water",
    ],
    monitor: ["Stem-base firmness weekly", "New crown leaves over 3–6 weeks"],
    longerTerm: ["Water when top ½–¾ is dry", "Flush soil every few months", "Trim brown areas once new growth is healthy"],
    nextChecks: [],
    questions: [],
  },
  {
    id: "a-birdie",
    plantId: "birdie",
    createdAt: ASSESSED,
    model: "manual (Phase 0)",
    status: "stressed",
    headline: "Heat and sun scorch at the glass, made worse by no drainage.",
    diagnosis:
      "Scorch on outer, window-facing leaves since the late-July move into peak summer, sitting ~15 cm from unshaded high-floor glass. Weekly watering into a pot without holes likely weakened the roots. New central leaves are clean.",
    likelyCauses: [
      { cause: "Heat/sun stress at the glass", confidence: "high", evidence: "Damage on window-facing leaves; timing" },
      { cause: "Root stress from no drainage", confidence: "medium", evidence: "Yellow halos; weekly watering, no holes" },
    ],
    mismatches: [
      { factor: "Light / heat", ideal: "Bright, acclimatised sun", current: "15 cm from hot glass", severity: "major" },
      { factor: "Drainage", ideal: "Essential", current: "No holes", severity: "major" },
    ],
    doNow: [
      "Move into a nursery pot with holes; check roots",
      "Pull back 30–50 cm from the glass",
      "Cut the two dead lower leaves at the base",
    ],
    monitor: ["New scorch patches after 7 days", "Next leaf unfurls clean"],
    longerTerm: ["Fertilise monthly Mar–Oct", "Repot up each spring", "Watch for scorch as winter sun gets lower"],
    nextChecks: [],
    questions: [],
  },
  {
    id: "a-big-spike",
    plantId: "big-spike",
    createdAt: ASSESSED,
    model: "manual (Phase 0)",
    status: "watch",
    headline: "Salt build-up from tap water, plus possible spider mites and leaf spot.",
    diagnosis:
      "Brown tips began after the switch from bottled to tap water; with no drainage, salts can't flush out. Yellow stippling suggests spider mites (test pending) and round halo spots suggest leaf spot. New tufts look healthy.",
    likelyCauses: [
      { cause: "Tap-water salts accumulating in undrained pot", confidence: "high", evidence: "Brown tips since water switch" },
      { cause: "Spider mites", confidence: "medium", evidence: "Stippling in dry AC air" },
      { cause: "Leaf spot", confidence: "medium", evidence: "Round brown spots with yellow halos" },
    ],
    mismatches: [
      { factor: "Water quality", ideal: "Filtered/bottled", current: "Tap", severity: "major" },
      { factor: "Drainage", ideal: "Essential", current: "No holes", severity: "major" },
      { factor: "Light", ideal: "Medium–bright indirect", current: "4 m from window", severity: "minor" },
      { factor: "Humidity", ideal: "40%+", current: "1.5 m from AC", severity: "minor" },
    ],
    doNow: [
      "Tissue test under a speckled leaf for mites",
      "Switch back to bottled/filtered water",
      "Add drainage and flush the soil once",
      "Remove the fully yellow leaf",
    ],
    monitor: ["Speckling spreading to new leaves?", "Soil check before watering (~2–3 weeks)"],
    longerTerm: ["Move to ~1.5–2 m from a window if possible", "Wipe leaves monthly"],
    nextChecks: [],
    questions: ["Did the tissue test show reddish smears or webbing?"],
  },
  {
    id: "a-ruby",
    plantId: "ruby",
    createdAt: ASSESSED,
    model: "manual (Phase 0)",
    status: "healthy",
    headline: "Healthy — the 'burn' is mostly spathes ageing naturally.",
    diagnosis:
      "Spathes last 6–8 weeks; it's been ~2 months since the move, so browning fits normal ageing. Leaves are glossy and new growth is emerging. Only risk is the lack of drainage.",
    likelyCauses: [{ cause: "Natural spathe ageing", confidence: "high", evidence: "Timing; healthy leaves" }],
    mismatches: [
      { factor: "Light", ideal: "Bright indirect", current: "50 cm from window, shaded", severity: "ok" },
      { factor: "Drainage", ideal: "Essential", current: "No holes", severity: "major" },
      { factor: "Humidity", ideal: "50%+", current: "AC room", severity: "minor" },
    ],
    doNow: ["Cut spent spathes at the base of their stem", "Add a nursery pot with drainage"],
    monitor: ["Leaf spot on one lower leaf", "New spathes come in bright red"],
    longerTerm: ["Half-strength bloom fertiliser every 4–6 weeks Mar–Oct", "Group with other plants for humidity"],
    nextChecks: [],
    questions: [],
  },
];

let n = 0;
const ev = (plantId: string, occurredAt: string, type: PlantEvent["type"], actor: string, note: string, approximate = false): PlantEvent => ({
  id: `e${++n}`,
  plantId,
  occurredAt,
  type,
  actor,
  note,
  approximate,
});

const events: PlantEvent[] = [
  ev("rapunzel", "2026-08-31", "symptom", "Sarah", "Yellowing leaves started", true),
  ev("rapunzel", "2026-09-10", "note", "Sarah", "Worst yellow leaves removed; watering reduced from weekly", true),
  ev("rapunzel", "2026-09-21", "pruned", "Sarah", "Cut back leggy vines; new growth appearing", true),
  ev("rapunzel", "2026-09-28", "note", "Sarah", "2 cuttings started rooting in water; named Rapunzel"),

  ev("spike", "2026-06-15", "caretaker-change", "Helper", "New caretaker took over watering; amount likely changed", true),
  ev("spike", "2026-09-01", "caretaker-change", "Sarah", "Sarah took over care; tap water instead of bottled", true),
  ev("spike", "2026-09-15", "moved", "Sarah", "Moved several times trying to find a better spot", true),
  ev("spike", "2026-09-27", "symptom", "Sarah", "Removed worst leaves; unpotted — soil waterlogged, roots firm orange/tan and circling"),

  ev("birdie", "2026-07-25", "moved", "Sarah", "Moved home; now ~15 cm from south-facing glass", true),
  ev("birdie", "2026-08-15", "symptom", "Sarah", "Scorch patches appearing on outer leaves", true),
  ev("birdie", "2026-09-27", "moved", "Helper", "Pushed against the glass while cleaning"),

  ev("big-spike", "2026-09-01", "caretaker-change", "Sarah", "Sarah took over care; switched from bottled to tap water", true),
  ev("big-spike", "2026-09-15", "symptom", "Sarah", "Yellowing and brown tips appearing", true),

  ev("ruby", "2026-07-25", "moved", "Sarah", "Moved home; 50 cm from south window, mostly shaded", true),
  ev("ruby", "2026-09-01", "symptom", "Sarah", "Spathes browning; new leaves emerging", true),
];

let c = 0;
const ck = (plantId: string, dueOn: string, task: string): Check => ({ id: `c${++c}`, plantId, dueOn, task, doneAt: null });

const checks: Check[] = [
  ck("rapunzel", "2026-10-01", "Check soil moisture 5 cm down — water only if dry halfway"),
  ck("rapunzel", "2026-10-05", "Any new yellow leaves?"),
  ck("rapunzel", "2026-10-12", "Progress photo + check cutting roots"),
  ck("spike", "2026-09-29", "Squeeze stem base — still firm?"),
  ck("spike", "2026-09-30", "Repot one size up into a pot with drainage"),
  ck("spike", "2026-10-05", "Soil moisture check (don't water before)"),
  ck("spike", "2026-10-19", "Progress photo — new crown leaves green?"),
  ck("birdie", "2026-09-30", "Nursery pot with drainage; pull back from glass; remove dead leaves"),
  ck("birdie", "2026-10-05", "Any new scorch? Check soil before watering"),
  ck("big-spike", "2026-09-29", "Tissue test for spider mites"),
  ck("big-spike", "2026-10-01", "Add drainage + flush soil with bottled water"),
  ck("big-spike", "2026-10-05", "Speckling or spots spreading?"),
  ck("ruby", "2026-09-30", "Cut spent spathes; add drainage"),
  ck("ruby", "2026-10-05", "Leaf spot spreading?"),
];

export const seed = { plants, assessments, events, checks };
