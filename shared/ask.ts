import type { BriefContext } from "./context";
import type { Guidance } from "./risk";

export const EMERGENCY_ANSWER =
  "If someone is struggling to breathe, has chest pain, blue lips or feels faint, get medical help now: call 112 (India) or go to the nearest hospital. This assistant cannot give medical advice.";
const EMERGENCY =
  /chest pain|(can['’]?t|cannot|unable to) breathe|trouble breathing|difficulty breathing|shortness of breath|breathless|wheez|blue lips|faint|unconscious|asthma attack|heart attack|सांस|सीने में दर्द/i;
/** Checked before any AI call: a possible medical emergency always gets the same safe answer. */
export const isEmergency = (question: string) => EMERGENCY.test(question);

export type Intent = "mask" | "purifier" | "windows" | "cooking" | "plants" | "outdoor" | "general";
const INTENTS: readonly [Intent, RegExp][] = [
  ["mask", /mask|n95|ffp2|respirator/i],
  ["purifier", /purifier|filter|hepa|corsi/i],
  ["windows", /window|ventilat|fresh air/i],
  ["cooking", /cook|chulha|stove|kitchen|lpg|induction/i],
  ["plants", /plant|tulsi|snake plant|money plant/i],
  [
    "outdoor",
    /outdoor|outside|play|cricket|football|park|walk|jog|run|exercise|workout|gym|yoga|school|cycl/i,
  ],
];
export const classify = (question: string): Intent =>
  INTENTS.find(([, re]) => re.test(question))?.[0] ?? "general";

const OUTDOOR: Record<Guidance, (c: BriefContext) => string> = {
  ok: (c) =>
    `Yes — at AQI ${c.aqi}, outdoor play and exercise are fine. Check the AQI again before the evening.`,
  limit: () =>
    "Keep it short and light: aim for around midday, avoid busy roads and skip hard exercise. Adults can wear a fitted N95 for errands.",
  avoid: (c) =>
    `Better to stay indoors today. At AQI ${c.aqi} (${c.effective} for your family), hard breathing outdoors pulls in far more fine particles. Choose indoor games or a workout; if you must go out, keep it brief at midday with an N95 (adults only).`,
};
const WINDOWS: Record<Guidance, string> = {
  ok: "Fine to ventilate: open windows for fresh air, ideally when traffic is light.",
  limit:
    "Keep windows mostly closed. If the AQI dips around midday, open them for about ten minutes, then close up.",
  avoid: "Keep windows and vents closed while the air is this bad, and run a purifier if you have one.",
};
const FIXED: Record<Exclude<Intent, "outdoor" | "windows" | "general">, string> = {
  mask: "A well-fitted N95/FFP2 is the one mask that works against smog — cloth and surgical masks leak. It must seal over the nose and chin. Never for babies under 2, and children need a child-sized respirator.",
  purifier:
    "A HEPA purifier sized for your room cuts indoor fine particles sharply. A DIY box (box fan plus four MERV-13 filters, around ₹3,000–4,500) is a cheaper option. Keep windows closed and run it where your family spends most time.",
  cooking:
    "Cook on LPG or induction rather than wood or coal, and use a vented chimney or exhaust fan while cooking. Keep little ones out of the kitchen.",
  plants:
    "Houseplants remove very little air pollution at home scale — lovely, but they will not beat smog. Filters and sealing the home do the real work.",
};

/** Rules-based answers, so questions are answered sensibly with no AI at all. */
export function answerOffline(question: string, c: BriefContext): { answer: string; emergency: boolean } {
  if (isEmergency(question)) return { answer: EMERGENCY_ANSWER, emergency: true };
  const intent = classify(question);
  let answer: string;
  if (intent === "outdoor") {
    answer = OUTDOOR[c.guidance](c);
  } else if (intent === "windows") {
    answer = WINDOWS[c.guidance];
  } else if (intent === "general") {
    answer = c.top.length
      ? `Today’s AQI is ${c.aqi} (${c.effective} for your family). Your best steps: ${c.top.slice(0, 3).join("; ")}.`
      : `Today’s AQI is ${c.aqi}. Check it each morning and adjust outdoor plans.`;
  } else {
    answer = FIXED[intent];
  }
  return { answer, emergency: false };
}
