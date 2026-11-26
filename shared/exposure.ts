import { pm25FromAqi } from "./aqi";
import type { Profile } from "./household";

/**
 * Transparent, adjustable assumptions behind every "impact" number (see docs/MODEL.md).
 * They are rounded, literature-informed approximations for education — not measurements.
 */
export const MODEL = {
  /** Share of outdoor PM2.5 that reaches indoor air. */
  infiltration: { open: 0.9, closed: 0.6 },
  /** Indoor level multiplier with a purifier sized for the room (HEPA, or a DIY Corsi–Rosenthal box). */
  purifier: { none: 1, hepa: 0.4, diy: 0.5 },
  /** Share of particles that still get through, for adults who wear the mask properly. */
  mask: { none: 1, cloth: 0.8, surgical: 0.65, n95: 0.25 },
  /** Extra µg/m³ in home air while cooking, by fuel. */
  cookingSource: { biomass: 80, lpg: 10, induction: 0 },
  cookingHours: 2,
  /** Breathing rates in m³/hour. */
  rate: { adultRest: 0.5, adultLight: 1, exercise: 2.5, childRest: 0.35, childLight: 0.7, childPlay: 1.5 },
  /** Air inside the vehicle relative to outdoors, breathing rate, whether a mask is worn, speed (km/h) and kg CO₂e per passenger-km. */
  commute: {
    wfh: { factor: 0, rate: 0, masked: false, kmh: 0, co2: 0 },
    walk: { factor: 1, rate: 1.5, masked: true, kmh: 5, co2: 0 },
    "two-wheeler": { factor: 1.3, rate: 1, masked: true, kmh: 25, co2: 0.06 },
    car: { factor: 0.5, rate: 0.6, masked: false, kmh: 22, co2: 0.17 },
    bus: { factor: 0.9, rate: 0.8, masked: true, kmh: 18, co2: 0.05 },
    metro: { factor: 0.6, rate: 0.7, masked: true, kmh: 30, co2: 0.03 },
  },
} as const;

export interface Segment {
  label: string;
  dose: number;
}
export interface Exposure {
  /** Estimated PM2.5 inhaled in a day, in µg, for the family's reference adult plus child. */
  total: number;
  adult: number;
  child: number;
  segments: Segment[];
}

export const percentDrop = (before: number, after: number) =>
  Math.round(((before - after) / (before || 1)) * 100);

const sum = (parts: Segment[]) => parts.reduce((a, s) => a + s.dose, 0);

/** Estimated PM2.5 dose for one reference adult and, if the household has children, one reference child. */
export function exposure(p: Profile): Exposure {
  const c = pm25FromAqi(p.aqi);
  const m = MODEL;
  const hasChild = p.infants + p.children > 0;
  const commute = m.commute[p.commute];
  const maskF = m.mask[p.mask];
  const purifier = m.purifier[p.purifier];
  const homeC = c * m.infiltration[p.windows] * purifier;
  const cookC = homeC + m.cookingSource[p.cooking] * purifier;
  const commuteH = p.commute === "wfh" ? 0 : p.commuteMinutes / 60;
  const exerciseH = p.exerciseMinutes / 60;
  const kidsH = hasChild ? p.kidsOutdoorMinutes / 60 : 0;
  const cookH = m.cookingHours;
  const adult: Segment[] = [
    { label: "Commute", dose: commuteH * c * commute.factor * (commute.masked ? maskF : 1) * commute.rate },
    { label: "Outdoor exercise", dose: exerciseH * c * maskF * m.rate.exercise },
    { label: "Cooking fumes at home", dose: cookH * cookC * m.rate.adultLight },
    {
      label: "Time at home and work",
      dose: Math.max(0, 24 - commuteH - exerciseH - cookH) * homeC * m.rate.adultRest,
    },
  ];
  const child: Segment[] = hasChild
    ? [
        { label: "Children’s outdoor time", dose: kidsH * c * m.rate.childPlay },
        { label: "Cooking fumes at home", dose: cookH * cookC * m.rate.childLight },
        {
          label: "Time at home and school",
          dose: Math.max(0, 24 - kidsH - cookH) * homeC * m.rate.childRest,
        },
      ]
    : [];
  const byLabel = new Map<string, number>();
  for (const s of [...adult, ...child]) byLabel.set(s.label, (byLabel.get(s.label) ?? 0) + s.dose);
  const segments = [...byLabel].map(([label, dose]) => ({ label, dose })).sort((a, b) => b.dose - a.dose);
  return { total: sum(adult) + sum(child), adult: sum(adult), child: sum(child), segments };
}
