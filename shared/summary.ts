import type { Scenario } from "./actions";
import { pm25FromAqi, whoMultiple } from "./aqi";
import { cityName } from "./cities";
import type { Profile } from "./household";
import type { Risk } from "./risk";

/** Plain-language briefing built from the rules, so the app explains itself even when no AI is available. */
export function summarize(p: Profile, r: Risk, sc: Scenario): string {
  const parts = [
    `Today’s AQI in ${cityName(p.cityId)} is ${p.aqi} (${r.base.label}) — about ${whoMultiple(pm25FromAqi(p.aqi))}× the WHO daily PM2.5 guideline.`,
  ];
  if (r.effectiveLevel > r.baseLevel) {
    parts.push(`For your family it counts as ${r.effective.label}.`);
  }
  parts.push(r.reasons[r.reasons.length - 1]);
  if (sc.reductionPct > 0) {
    const n = sc.steps.length;
    parts.push(
      `Taking your top ${n === 1 ? "step" : `${n} steps`} could cut your estimated PM2.5 intake by about ${sc.reductionPct}%.`,
    );
  }
  return parts.join(" ");
}
