export type CategoryKey = "good" | "satisfactory" | "moderate" | "poor" | "veryPoor" | "severe";
export interface Category {
  key: CategoryKey;
  label: string;
  min: number;
  max: number;
}

/** India's National Air Quality Index categories (CPCB). */
export const CATEGORIES: readonly Category[] = [
  { key: "good", label: "Good", min: 0, max: 50 },
  { key: "satisfactory", label: "Satisfactory", min: 51, max: 100 },
  { key: "moderate", label: "Moderate", min: 101, max: 200 },
  { key: "poor", label: "Poor", min: 201, max: 300 },
  { key: "veryPoor", label: "Very Poor", min: 301, max: 400 },
  { key: "severe", label: "Severe", min: 401, max: 500 },
];

/** [concentration low, concentration high, index low, index high] — CPCB breakpoints in µg/m³. */
type Breakpoint = readonly [number, number, number, number];
// The top bands are open-ended in the CPCB table; 380 and 510 are the upper bounds used for interpolation.
const PM25: readonly Breakpoint[] = [
  [0, 30, 0, 50],
  [30, 60, 50, 100],
  [60, 90, 100, 200],
  [90, 120, 200, 300],
  [120, 250, 300, 400],
  [250, 380, 400, 500],
];
const PM10: readonly Breakpoint[] = [
  [0, 50, 0, 50],
  [50, 100, 50, 100],
  [100, 250, 100, 200],
  [250, 350, 200, 300],
  [350, 430, 300, 400],
  [430, 510, 400, 500],
];

/** WHO 2021 24-hour PM2.5 guideline, µg/m³. */
export const WHO_PM25_24H = 15;

export const levelOf = (aqi: number): number => {
  const i = CATEGORIES.findIndex((c) => aqi <= c.max);
  return i === -1 ? CATEGORIES.length - 1 : i;
};
export const categoryOf = (aqi: number): Category => CATEGORIES[levelOf(aqi)];

function subIndex(c: number, table: readonly Breakpoint[]): number {
  if (c <= 0) return 0;
  const bp = table.find(([, hi]) => c <= hi);
  if (!bp) return 500;
  const [lo, hi, iLo, iHi] = bp;
  return iLo + ((iHi - iLo) * (c - lo)) / (hi - lo);
}
export const aqiFromPm25 = (c: number) => subIndex(c, PM25);
export const aqiFromPm10 = (c: number) => subIndex(c, PM10);

/** Indicative Indian AQI: the worse of the PM2.5 and PM10 sub-indices that are available. */
export function indianAqi({ pm25, pm10 }: { pm25?: number; pm10?: number }): number {
  const a = pm25 === undefined ? 0 : aqiFromPm25(pm25);
  const b = pm10 === undefined ? 0 : aqiFromPm10(pm10);
  return Math.round(Math.max(a, b));
}

/** Inverse of the PM2.5 sub-index: the concentration implied by an AQI when PM2.5 is the main pollutant (typical in winter smog). */
export function pm25FromAqi(aqi: number): number {
  const a = Math.min(500, Math.max(0, aqi));
  const [lo, hi, iLo, iHi] = PM25.find(([, , , top]) => a <= top) as Breakpoint;
  return lo + ((hi - lo) * (a - iLo)) / (iHi - iLo);
}
/** How many times the WHO guideline a PM2.5 concentration is, to one decimal. */
export const whoMultiple = (pm25: number) => Math.round((pm25 / WHO_PM25_24H) * 10) / 10;
