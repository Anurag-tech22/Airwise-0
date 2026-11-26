export interface Hour {
  hour: number;
  aqi: number;
}
export interface Span {
  from: number;
  to: number;
  aqi: number;
}
export interface Windows {
  best: Span;
  worst: Span;
}

/** "1 pm", "12 pm", "9 am". */
export const fmtHour = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;

/**
 * The cleanest and dirtiest two-hour windows for outdoor time between 6 am and 10 pm,
 * looking only at hours that have not passed yet (`fromHour`). Null when the forecast leaves no full window.
 */
export function outdoorWindows(hourly: Hour[], fromHour = 0): Windows | null {
  const aqiAt = new Map(hourly.map((h) => [h.hour, h.aqi]));
  const spans: Span[] = [];
  for (let from = Math.max(6, fromHour); from <= 20; from++) {
    const a = aqiAt.get(from);
    const b = aqiAt.get(from + 1);
    if (a !== undefined && b !== undefined) {
      spans.push({ from, to: from + 2, aqi: Math.round((a + b) / 2) });
    }
  }
  if (spans.length === 0) return null;
  return {
    best: spans.reduce((m, s) => (s.aqi < m.aqi ? s : m)),
    worst: spans.reduce((m, s) => (s.aqi > m.aqi ? s : m)),
  };
}

/** One plain-language sentence for the day plan. */
export function windowsText(w: Windows): string {
  const span = (s: Span) => `${fmtHour(s.from)}–${fmtHour(s.to)} (AQI ≈ ${s.aqi})`;
  return w.best.aqi === w.worst.aqi
    ? `Air stays about the same through the day (AQI ≈ ${w.best.aqi}).`
    : `Best time outdoors today: ${span(w.best)}. Worst: ${span(w.worst)}.`;
}
