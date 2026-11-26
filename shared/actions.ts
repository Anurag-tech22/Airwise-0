import { exposure, percentDrop } from "./exposure";
import type { Profile } from "./household";
import { assessRisk, type Risk } from "./risk";
import { CATALOG, type Area, type Def, type Effort } from "./catalog";

export type { Area, Effort };

export interface Action {
  id: string;
  area: Area;
  title: string;
  why: string;
  effort: Effort;
  cost: string;
  /** Estimated drop in the family's daily PM2.5 intake, or null when the benefit is not modelled. */
  reductionPct: number | null;
  co2SavedKgPerWeek: number | null;
}
export interface Scenario {
  before: number;
  after: number;
  reductionPct: number;
  steps: string[];
}

const BY_ID = new Map(CATALOG.map((d) => [d.id, d]));

/**
 * Personalised actions for today, best first. Modelled actions carry the estimated drop in the family's
 * PM2.5 intake from adopting them; the rest are qualitative. Actions with no meaningful effect are dropped.
 * Ties keep catalogue order, because Array.prototype.sort is stable.
 */
export function recommend(p: Profile, risk: Risk = assessRisk(p)): Action[] {
  const before = exposure(p).total;
  return CATALOG.flatMap((d) => {
    if (!d.when(p, risk)) return [];
    const reductionPct = d.apply ? percentDrop(before, exposure(d.apply(p, risk)).total) : null;
    const co2 = d.co2 ? Math.round(d.co2(p) * 10) / 10 : null;
    if (reductionPct !== null && reductionPct < 1 && !co2) return [];
    const { id, area, title, why, effort, cost } = d;
    const action: Action = { id, area, title, why, effort, cost, reductionPct, co2SavedKgPerWeek: co2 };
    return [{ rank: d.rank ?? 5, action }];
  })
    .sort((a, b) => a.rank - b.rank || (b.action.reductionPct ?? -1) - (a.action.reductionPct ?? -1))
    .map((x) => x.action);
}

/** What the day looks like if the family adopts their top modelled actions (alternatives are never combined). */
export function scenario(p: Profile, actions: Action[], risk: Risk = assessRisk(p), limit = 3): Scenario {
  const used = new Set<string>();
  const steps: string[] = [];
  let next = p;
  for (const a of actions) {
    if (steps.length === limit) break;
    const def = BY_ID.get(a.id) as Def;
    if (!def.apply || (def.group && used.has(def.group))) continue;
    next = def.apply(next, risk);
    if (def.group) used.add(def.group);
    steps.push(a.title);
  }
  const before = exposure(p).total;
  const after = exposure(next).total;
  return { before, after, reductionPct: percentDrop(before, after), steps };
}
