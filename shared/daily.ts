import type { Profile } from "./household";
import type { Risk } from "./risk";

export type Window = "best" | "caution" | "avoid";
export interface Block {
  when: string;
  window: Window;
  text: string;
}
type Tier = "low" | "mid" | "high";

const BASE: Record<Tier, Block[]> = {
  low: [
    {
      when: "Early morning (before 9 am)",
      window: "best",
      text: "Air is good — a fine time for a walk or the school run on foot.",
    },
    { when: "Midday (11 am–3 pm)", window: "best", text: "Great for outdoor play and errands." },
    {
      when: "Evening (5–9 pm)",
      window: "best",
      text: "Evening walks are fine; open windows to freshen rooms.",
    },
    { when: "Night", window: "best", text: "Open windows for fresh air if it is quiet outside." },
  ],
  mid: [
    {
      when: "Early morning (before 9 am)",
      window: "caution",
      text: "Smog often peaks now, as cold air traps pollution. Keep outdoor effort light and avoid busy roads.",
    },
    {
      when: "Midday (11 am–3 pm)",
      window: "best",
      text: "Usually the cleanest part of the day — the best time for outdoor errands and short play.",
    },
    {
      when: "Evening (5–9 pm)",
      window: "caution",
      text: "Traffic and cooling air push pollution back up. Keep outdoor time short.",
    },
    {
      when: "Night",
      window: "caution",
      text: "Keep windows closed overnight and run a purifier in the bedroom if you have one.",
    },
  ],
  high: [
    {
      when: "Early morning (before 9 am)",
      window: "avoid",
      text: "The worst time of day. Stay indoors if you can and delay non-essential trips.",
    },
    {
      when: "Midday (11 am–3 pm)",
      window: "caution",
      text: "The best window for essential errands: keep them to 20–30 minutes.",
    },
    {
      when: "Evening (5–9 pm)",
      window: "avoid",
      text: "Pollution climbs again after sunset. Stay in with windows closed.",
    },
    {
      when: "Night",
      window: "caution",
      text: "Seal one clean room (door closed, purifier on) for sleeping, especially for babies and elders.",
    },
  ],
};

const tierOf = (r: Risk): Tier => (r.effectiveLevel <= 1 ? "low" : r.effectiveLevel <= 3 ? "mid" : "high");
const append = (b: Block, extra: string) => ({ ...b, text: `${b.text} ${extra}` });

/** A four-part day plan for today's level, tailored to the household's children, exercise, commute and purifier. */
export function dailyPlan(p: Profile, r: Risk): Block[] {
  const tier = tierOf(r);
  const blocks = BASE[tier].map((b) => ({ ...b }));
  if (tier === "low") return blocks;
  if (p.exerciseMinutes > 0) blocks[0] = append(blocks[0], "Move your workout indoors today.");
  if (tier === "high" && ["walk", "two-wheeler", "bus", "metro"].includes(p.commute)) {
    blocks[1] = append(blocks[1], "Wear a fitted N95 on the way.");
  }
  if (p.infants + p.children > 0) {
    blocks[2] = append(blocks[2], "Swap outdoor play for indoor games.");
  }
  if (p.purifier === "none") {
    blocks[3] = append(blocks[3], "A purifier or DIY filter box in the bedroom helps most.");
  }
  return blocks;
}
