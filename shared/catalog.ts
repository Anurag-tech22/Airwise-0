import { MODEL } from "./exposure";
import type { Profile } from "./household";
import type { Risk } from "./risk";

export type Area = "routine" | "indoor" | "commute" | "sustainable" | "community";
export type Effort = "easy" | "moderate" | "involved";

export interface Def {
  id: string;
  area: Area;
  title: string;
  why: string;
  effort: Effort;
  cost: string;
  when: (p: Profile, r: Risk) => boolean;
  /** How the household changes if the family adopts this; its impact is measured with the exposure model. */
  apply?: (p: Profile, r: Risk) => Profile;
  /** kg CO₂e saved per week. */
  co2?: (p: Profile) => number;
  /** Actions in the same group are alternatives, never combined. */
  group?: string;
  /** Lower comes first; default 5. */
  rank?: number;
}
const hasKids = (p: Profile) => p.infants + p.children > 0;
const outdoorCommute = (p: Profile) =>
  p.commuteMinutes > 0 && ["walk", "two-wheeler", "bus", "metro"].includes(p.commute);
const kmPerDay = (p: Profile) => (p.commuteMinutes / 60) * MODEL.commute[p.commute].kmh;
const co2Delta = (from: keyof typeof MODEL.commute, to: keyof typeof MODEL.commute) =>
  MODEL.commute[from].co2 - MODEL.commute[to].co2;

export const CATALOG: readonly Def[] = [
  {
    id: "babies-indoors",
    area: "routine",
    rank: 0,
    effort: "easy",
    cost: "Free",
    title: "Keep babies under 2 indoors — and never put a mask on them",
    why: "Babies breathe fast and cannot wear masks safely. A clean-air room with the door closed is their best protection.",
    when: (p, r) => p.infants > 0 && r.effectiveLevel >= 3,
  },
  {
    id: "n95",
    area: "routine",
    effort: "easy",
    cost: "₹60–150 per mask",
    title: "Wear a well-fitted N95/FFP2 for commutes and errands",
    why: "Cloth and surgical masks leak; a sealed N95 blocks most fine particles. For adults only — children need child-sized respirators.",
    when: (p, r) => r.effectiveLevel >= 3 && p.mask !== "n95" && (outdoorCommute(p) || p.exerciseMinutes > 0),
    apply: (p) => ({ ...p, mask: "n95" }),
  },
  {
    id: "purifier-hepa",
    area: "indoor",
    effort: "moderate",
    cost: "₹8,000–20,000",
    group: "purifier",
    title: "Run a HEPA air purifier in the room you use most",
    why: "Fine particles slip indoors through gaps. A purifier sized for the room filters the air you breathe for most of the day.",
    when: (p, r) => p.purifier === "none" && r.effectiveLevel >= 2,
    apply: (p) => ({ ...p, purifier: "hepa" }),
  },
  {
    id: "purifier-diy",
    area: "indoor",
    effort: "involved",
    cost: "₹3,000–4,500",
    group: "purifier",
    title: "Build a DIY air cleaner (box fan + four MERV-13 filters)",
    why: "A Corsi–Rosenthal box is a low-cost, well-studied way to clean a room’s air when a purifier is out of budget.",
    when: (p, r) => p.purifier === "none" && r.effectiveLevel >= 2,
    apply: (p) => ({ ...p, purifier: "diy" }),
  },
  {
    id: "windows",
    area: "indoor",
    effort: "easy",
    cost: "Free",
    title: "Keep windows and vents shut through the day",
    why: "Smog seeps in through open windows. Shut, your home’s air stays cleaner; open them briefly around midday only if the AQI dips.",
    when: (p, r) => p.windows === "open" && r.effectiveLevel >= 2,
    apply: (p) => ({ ...p, windows: "closed" }),
  },
  {
    id: "kids-play",
    area: "routine",
    effort: "easy",
    cost: "Free",
    title: "Move children’s outdoor play indoors, or keep it short and at midday",
    why: "Children breathe more air for their size and play hard, so outdoor time on smoggy days adds the most to their dose.",
    when: (p, r) => hasKids(p) && p.kidsOutdoorMinutes > 0 && r.effectiveLevel >= 3,
    apply: (p, r) => ({
      ...p,
      kidsOutdoorMinutes: r.effectiveLevel >= 4 ? 0 : Math.floor(p.kidsOutdoorMinutes / 2),
    }),
  },
  {
    id: "exercise-indoors",
    area: "routine",
    effort: "easy",
    cost: "Free",
    title: "Do today’s workout indoors",
    why: "Hard breathing outdoors pulls in far more fine particles; an indoor session cuts that dose sharply.",
    when: (p, r) => p.exerciseMinutes > 0 && r.effectiveLevel >= 3,
    apply: (p) => ({ ...p, exerciseMinutes: 0 }),
  },
  {
    id: "two-wheeler-metro",
    area: "commute",
    effort: "moderate",
    cost: "₹0–150 a day",
    title: "Swap the two-wheeler for the metro or a bus",
    why: "On a two-wheeler you ride in the traffic stream. A metro cabin has lower exposure and takes a tailpipe off the road.",
    when: (p, r) => p.commute === "two-wheeler" && p.commuteMinutes > 0 && r.effectiveLevel >= 3,
    apply: (p) => ({ ...p, commute: "metro" }),
    co2: (p) => 5 * kmPerDay(p) * co2Delta("two-wheeler", "metro"),
  },
  {
    id: "car-share",
    area: "sustainable",
    effort: "moderate",
    cost: "Saves fuel",
    title: "Share rides or take the metro on two commute days a week",
    why: "Your own air barely changes, but fewer cars means less tailpipe smoke for the whole neighbourhood.",
    when: (p) => p.commute === "car" && p.commuteMinutes > 0,
    co2: (p) => 2 * kmPerDay(p) * co2Delta("car", "metro"),
  },
  {
    id: "wfh",
    area: "commute",
    effort: "easy",
    cost: "Free",
    title: "Work from home on the worst days",
    why: "Skipping the commute removes your longest stretch in traffic-heavy air.",
    when: (p, r) => p.commute !== "wfh" && p.commuteMinutes > 0 && r.effectiveLevel >= 5,
    apply: (p) => ({ ...p, commute: "wfh" }),
  },
  {
    id: "cooking-switch",
    area: "sustainable",
    effort: "moderate",
    cost: "₹3,000–6,000 (induction hob)",
    title: "Cook on LPG or induction instead of wood, dung or coal",
    why: "Burning solid fuel indoors fills the home with fine particles and adds to the smog outside.",
    when: (p) => p.cooking === "biomass",
    apply: (p) => ({ ...p, cooking: "lpg" }),
  },
  {
    id: "kitchen-vent",
    area: "indoor",
    effort: "easy",
    cost: "₹0–8,000",
    title: "Use a vented chimney or exhaust fan while cooking",
    why: "Cooking is a main source of particles inside homes; venting it outdoors keeps it out of your lungs.",
    when: (p, r) => p.cooking === "lpg" && r.effectiveLevel >= 2,
  },
  {
    id: "clean-room",
    area: "indoor",
    effort: "easy",
    cost: "Free",
    title: "Set up one clean-air room for babies, elders and anyone with asthma",
    why: "Close the door, run your purifier there and let them rest and sleep in it, so most of their day gets the cleanest air.",
    when: (p, r) =>
      p.purifier !== "none" && r.effectiveLevel >= 3 && p.infants + p.elders + (p.sensitive ? 1 : 0) > 0,
  },
  {
    id: "mask-fit",
    area: "routine",
    effort: "easy",
    cost: "Free",
    title: "Check your N95 seal every time",
    why: "A mask that leaks around the nose or chin protects little. Press it flat, and know that a beard breaks the seal.",
    when: (p, r) => p.mask === "n95" && r.effectiveLevel >= 3,
  },
  {
    id: "midday-errands",
    area: "routine",
    effort: "easy",
    cost: "Free",
    title: "Run outdoor errands around midday",
    why: "In winter, cold air traps smog near the ground at dawn and dusk; it usually thins a little in the afternoon sun.",
    when: (_p, r) => r.effectiveLevel >= 2,
  },
  {
    id: "damp-mop",
    area: "indoor",
    effort: "easy",
    cost: "Free",
    title: "Damp-mop instead of sweeping; skip incense, candles and mosquito coils",
    why: "Dry sweeping and smoke from incense or coils put particles straight back into indoor air.",
    when: (_p, r) => r.effectiveLevel >= 1,
  },
  {
    id: "school-indoors",
    area: "community",
    effort: "moderate",
    cost: "Free",
    title: "Ask your child’s school to move assemblies and sports indoors on smoggy days",
    why: "Many schools keep outdoor routines on bad-air days. A polite request from several parents often changes the schedule for every child.",
    when: (p, r) => hasKids(p) && r.effectiveLevel >= 3,
  },
  {
    id: "neighbours",
    area: "community",
    effort: "easy",
    cost: "Free",
    title:
      "Share this plan with neighbours and relatives, especially anyone with a baby, an older adult or asthma",
    why: "Clean-air habits spread by word of mouth, and the people at greatest risk are often the least likely to check the AQI.",
    when: (_p, r) => r.effectiveLevel >= 2,
  },
  {
    id: "check-aqi",
    area: "routine",
    rank: 8,
    effort: "easy",
    cost: "Free",
    title: "Check the AQI each morning and before evening plans",
    why: "Smog changes day to day; a ten-second check lets you pick the right routine.",
    when: () => true,
  },
  {
    id: "no-burning",
    area: "sustainable",
    rank: 8,
    effort: "easy",
    cost: "Free",
    title: "Never burn leaves, plastic or garbage — and skip firecrackers",
    why: "Open burning is one of the quickest ways a neighbourhood’s air turns from bad to dangerous.",
    when: () => true,
  },
];
