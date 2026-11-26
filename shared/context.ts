import { z } from "zod";
import type { Action } from "./actions";
import { cityName } from "./cities";
import type { Profile } from "./household";
import type { Risk } from "./risk";

/** The only facts about a family that ever leave the browser: counts-free, free-text-free and name-free. */
export const BriefContextSchema = z
  .object({
    cityName: z.string().trim().min(1).max(40),
    aqi: z.number().min(0).max(500),
    base: z.string().max(20),
    effective: z.string().max(20),
    guidance: z.enum(["ok", "limit", "avoid"]),
    vulnerable: z.array(z.string().max(60)).max(4),
    top: z.array(z.string().max(140)).max(5),
  })
  .strict();
export type BriefContext = z.infer<typeof BriefContextSchema>;

export function buildContext(p: Profile, r: Risk, actions: Action[]): BriefContext {
  return {
    cityName: cityName(p.cityId),
    aqi: p.aqi,
    base: r.base.label,
    effective: r.effective.label,
    guidance: r.guidance,
    vulnerable: r.vulnerable,
    top: actions.slice(0, 5).map((a) => a.title),
  };
}
