/** mock.ts — canned AI answers for building screens without API credit (PLANT_AI_MOCK=1). */
import type { Assessment, Identification } from "@/lib/types";

export const mockIdentification: Identification = {
  commonName: "Golden pothos",
  botanicalName: "Epipremnum aureum",
  confidence: "medium",
  alternatives: ["Heartleaf philodendron (Philodendron hederaceum)"],
  confirmationTip:
    "Look where the leaf meets the stem: pothos has a groove along the leaf stalk; philodendron's new leaves emerge from a thin papery sheath.",
  description:
    "A forgiving trailing vine with glossy heart-shaped leaves. Grows fast in bright indirect light and tells you when it's thirsty by drooping slightly.",
  ideal: {
    light: "Bright indirect; tolerates medium light",
    temperature: "18–30°C; keep away from direct AC airflow",
    humidity: "40%+",
    watering: "Water when the top half of the soil is dry",
    soil: "Airy potting mix with perlite",
    drainage: "Essential",
    sensitivities: ["soggy roots", "cold AC drafts"],
    toxicity: "Toxic to cats and dogs if eaten",
  },
};

export const mockAssessment: Assessment = {
  status: "watch",
  headline: "(Mock) Mostly fine — watch the watering.",
  diagnosis: "(Mock assessment — set ANTHROPIC_API_KEY and remove PLANT_AI_MOCK to get a real one.)",
  likelyCauses: [{ cause: "Watering routine", confidence: "medium", evidence: "Mock evidence" }],
  mismatches: [{ factor: "Drainage", ideal: "Essential", current: "Unknown", severity: "unknown" }],
  doNow: ["Check whether the pot has drainage holes"],
  monitor: ["Check soil 5 cm down in 3 days"],
  longerTerm: ["Rotate every 2–3 weeks"],
  nextChecks: [{ inDays: 3, task: "Check soil moisture" }],
  questions: ["Does the pot have drainage holes?"],
  moisture: { waterAtOrBelow: 3, reason: "(Mock) Lets the top of the root zone dry out between waterings." },
};
