import { CATEGORIES, levelOf, type Category } from "./aqi";
import type { Profile } from "./household";

export type Guidance = "ok" | "limit" | "avoid";
export interface Risk {
  base: Category;
  effective: Category;
  baseLevel: number;
  effectiveLevel: number;
  guidance: Guidance;
  vulnerable: string[];
  reasons: string[];
}

const GUIDANCE_TEXT: Record<Guidance, string> = {
  ok: "Normal outdoor activity is fine.",
  limit: "Limit time and effort outdoors, especially at peak traffic hours.",
  avoid: "Avoid outdoor exercise and children’s outdoor play; keep essential trips short.",
};

export function vulnerableGroups(
  p: Pick<Profile, "infants" | "children" | "elders" | "sensitive">,
): string[] {
  const out: string[] = [];
  if (p.infants > 0) {
    out.push("a baby under 2");
  }
  if (p.children > 0) {
    out.push("young children");
  }
  if (p.elders > 0) {
    out.push("older adults (60+)");
  }
  if (p.sensitive) {
    out.push("someone with asthma or a heart or lung condition");
  }
  return out;
}

export const listJoin = (items: string[]) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/**
 * How many steps worse today counts for this family. Vulnerable members raise the level by one step,
 * or two when several groups are present and the air is already Poor or worse. Clean air is never raised.
 */
export function levelShift(baseLevel: number, groups: number): number {
  if (baseLevel < 1 || groups === 0) return 0;
  return groups === 1 || baseLevel <= 2 ? 1 : 2;
}

export function assessRisk(p: Profile): Risk {
  const baseLevel = levelOf(p.aqi);
  const vulnerable = vulnerableGroups(p);
  const effectiveLevel = Math.min(
    CATEGORIES.length - 1,
    baseLevel + levelShift(baseLevel, vulnerable.length),
  );
  const guidance: Guidance = effectiveLevel <= 1 ? "ok" : effectiveLevel <= 3 ? "limit" : "avoid";
  const base = CATEGORIES[baseLevel];
  const effective = CATEGORIES[effectiveLevel];
  const reasons = [`AQI ${p.aqi} is ${base.label}.`];
  if (effectiveLevel > baseLevel) {
    reasons.push(
      `Your household includes ${listJoin(vulnerable)}, so treat today as ${effective.label} for your family.`,
    );
  }
  reasons.push(GUIDANCE_TEXT[guidance]);
  return { base, effective, baseLevel, effectiveLevel, guidance, vulnerable, reasons };
}
