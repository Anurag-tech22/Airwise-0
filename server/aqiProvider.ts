import { z } from "zod";
import type { AirReading } from "../shared/api";
import { categoryOf, indianAqi } from "../shared/aqi";
import { cityById } from "../shared/cities";
import type { Hour } from "../shared/windows";

export interface AirProvider {
  /** Live indicative air quality and today's forecast hours for a known city; throws if the data cannot be fetched or understood. */
  forCity(cityId: string): Promise<AirReading>;
}

const Hourly = z
  .object({
    time: z.array(z.string()),
    pm2_5: z.array(z.number().nullable()),
    pm10: z.array(z.number().nullable()),
  })
  .refine(
    (h) => h.pm2_5.length === h.time.length && h.pm10.length === h.time.length,
    "hourly arrays must align",
  );
const Response = z.object({
  current: z.object({ time: z.string(), pm2_5: z.number().nullable(), pm10: z.number().nullable() }),
  hourly: Hourly,
});
const HOST = "https://air-quality-api.open-meteo.com/v1/air-quality";
const SOURCE = "Open-Meteo (CAMS model) — an indicative estimate, not an official CPCB reading";

/** The forecast hours that fall on the same local date as the current reading, as indicative AQI values. */
function todaysHours(currentTime: string, h: z.infer<typeof Hourly>): Hour[] {
  const day = currentTime.slice(0, 10);
  return h.time.flatMap((t, i): Hour[] => {
    const pm25 = h.pm2_5[i];
    const pm10 = h.pm10[i];
    if (!t.startsWith(day) || (pm25 === null && pm10 === null)) return [];
    return [
      { hour: Number(t.slice(11, 13)), aqi: indianAqi({ pm25: pm25 ?? undefined, pm10: pm10 ?? undefined }) },
    ];
  });
}

interface Options {
  fetchImpl?: typeof fetch;
  ttlMs?: number;
  timeoutMs?: number;
}

/**
 * Open-Meteo air quality, called only for cities on our own list (so the URL can never be steered by a user),
 * with a hard timeout, strict response validation and a short cache.
 */
export function openMeteo({
  fetchImpl = fetch,
  ttlMs = 15 * 60_000,
  timeoutMs = 5000,
}: Options = {}): AirProvider {
  const cache = new Map<string, { at: number; reading: AirReading }>();
  return {
    async forCity(cityId) {
      const city = cityById(cityId);
      if (!city) throw new Error("unknown city");
      const hit = cache.get(cityId);
      if (hit && Date.now() - hit.at < ttlMs) return hit.reading;
      const url = `${HOST}?latitude=${city.lat}&longitude=${city.lon}&current=pm2_5,pm10&hourly=pm2_5,pm10&forecast_days=1&timezone=auto`;
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`provider status ${res.status}`);
      const { current, hourly } = Response.parse(await res.json());
      if (current.pm2_5 === null && current.pm10 === null) throw new Error("provider returned no readings");
      const aqi = indianAqi({ pm25: current.pm2_5 ?? undefined, pm10: current.pm10 ?? undefined });
      const reading: AirReading = {
        cityId,
        aqi,
        category: categoryOf(aqi).label,
        pm25: current.pm2_5,
        pm10: current.pm10,
        observedAt: current.time,
        hourly: todaysHours(current.time, hourly),
        source: SOURCE,
      };
      cache.set(cityId, { at: Date.now(), reading });
      return reading;
    },
  };
}
