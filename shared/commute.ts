import { pm25FromAqi } from "./aqi";
import { MODEL } from "./exposure";
import type { Profile } from "./household";

export type TravelMode = Exclude<Profile["commute"], "wfh">;
export const MODES: readonly { mode: TravelMode; label: string }[] = [
  { mode: "walk", label: "Walk" },
  { mode: "two-wheeler", label: "Two-wheeler" },
  { mode: "car", label: "Car, windows up" },
  { mode: "bus", label: "Bus" },
  { mode: "metro", label: "Metro" },
];
/** Walking is not offered as an alternative beyond this many minutes a day. */
export const MAX_WALK_MINUTES = 90;

export interface ModeRow {
  mode: TravelMode;
  label: string;
  minutes: number | null;
  /** PM2.5 breathed in during the trips, µg per day (same model as the day's exposure). */
  doseUg: number | null;
  co2KgPerWeek: number;
  current: boolean;
}

/**
 * The same daily distance travelled every way: time, fine particles breathed in and weekly carbon.
 * Null when there is no commute to compare.
 */
export function compareModes(p: Profile): ModeRow[] | null {
  if (p.commute === "wfh" || p.commuteMinutes === 0) return null;
  const km = (p.commuteMinutes / 60) * MODEL.commute[p.commute].kmh;
  const c = pm25FromAqi(p.aqi);
  const maskF = MODEL.mask[p.mask];
  return MODES.map(({ mode, label }) => {
    const m = MODEL.commute[mode];
    const exact = (km / m.kmh) * 60;
    const tooFar = mode === "walk" && exact > MAX_WALK_MINUTES;
    return {
      mode,
      label,
      minutes: tooFar ? null : Math.round(exact),
      doseUg: tooFar ? null : (exact / 60) * c * m.factor * (m.masked ? maskF : 1) * m.rate,
      co2KgPerWeek: Math.round(5 * km * m.co2 * 10) / 10,
      current: mode === p.commute,
    };
  });
}
