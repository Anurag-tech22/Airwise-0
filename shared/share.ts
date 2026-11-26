import type { Analysis } from "./analysis";
import { cityName } from "./cities";

/** A short, WhatsApp-friendly summary of the family's plan. It contains no household details beyond the level. */
export function shareText(a: Analysis, url: string): string {
  const steps = a.scenario.steps.slice(0, 3).map((s, i) => `${i + 1}. ${s}`);
  return [
    `AirWise — ${cityName(a.profile.cityId)}: AQI ${a.profile.aqi} (${a.risk.base.label}). Family level: ${a.risk.effective.label}.`,
    steps.length > 0 ? `Top steps:\n${steps.join("\n")}` : "",
    a.scenario.reductionPct > 0
      ? `Together they could cut our estimated PM2.5 intake by about ${a.scenario.reductionPct}%.`
      : "",
    `Make your own plan: ${url}`,
  ]
    .filter(Boolean)
    .join("\n");
}
