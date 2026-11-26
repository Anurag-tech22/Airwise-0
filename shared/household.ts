import { z } from "zod";

const count = (max: number) => z.number().int().min(0).max(max);

/** Everything the assistant needs to know about a family's day. Counts and habits only — no names, no free text. */
export const HouseholdSchema = z
  .object({
    infants: count(5), // babies under 2
    children: count(8), // 2–12
    elders: count(6), // 60+
    sensitive: z.boolean(), // someone with asthma, or a heart or lung condition
    purifier: z.enum(["none", "hepa", "diy"]),
    windows: z.enum(["open", "closed"]),
    cooking: z.enum(["lpg", "induction", "biomass"]),
    commute: z.enum(["wfh", "walk", "two-wheeler", "car", "bus", "metro"]),
    commuteMinutes: count(300), // total per day, both ways
    kidsOutdoorMinutes: count(300), // school run plus outdoor play
    exerciseMinutes: count(240), // adults' outdoor exercise
    mask: z.enum(["none", "cloth", "surgical", "n95"]),
  })
  .strict();
export type Household = z.infer<typeof HouseholdSchema>;

export const ProfileSchema = HouseholdSchema.extend({
  cityId: z.string().min(1).max(30),
  aqi: z.number().min(0).max(500),
}).strict();
/** A household plus today's air: the single input to every calculation. */
export type Profile = z.infer<typeof ProfileSchema>;

export const DEFAULT_HOUSEHOLD: Household = {
  infants: 0,
  children: 1,
  elders: 0,
  sensitive: false,
  purifier: "none",
  windows: "open",
  cooking: "lpg",
  commute: "two-wheeler",
  commuteMinutes: 60,
  kidsOutdoorMinutes: 60,
  exerciseMinutes: 30,
  mask: "none",
};
