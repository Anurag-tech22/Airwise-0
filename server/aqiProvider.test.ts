import { afterEach, describe, expect, it, vi } from "vitest";
import { openMeteo } from "./aqiProvider";

const sample = { time: "2026-11-17T08:00", pm2_5: 120, pm10: 200 };
const HOURLY = {
  time: ["2026-11-17T07:00", "2026-11-17T12:00", "2026-11-17T13:00", "2026-11-17T20:00", "2026-11-18T09:00"],
  pm2_5: [150, 60, null, null, 300],
  pm10: [200, null, 100, null, 400],
};
const ok = (current: object, hourly: object = HOURLY) =>
  vi.fn<typeof fetch>(
    async () => ({ ok: true, status: 200, json: async () => ({ current, hourly }) }) as Response,
  );
afterEach(() => vi.useRealTimers());

describe("openMeteo provider", () => {
  it("returns an indicative Indian AQI for a known city", async () => {
    const fetchImpl = ok(sample);
    const r = await openMeteo({ fetchImpl }).forCity("delhi");
    expect(r).toMatchObject({
      cityId: "delhi",
      aqi: 300,
      category: "Poor",
      pm25: 120,
      pm10: 200,
      observedAt: sample.time,
    });
    expect(r.source).toContain("not an official CPCB reading");
    const url = String(fetchImpl.mock.calls[0]?.[0]);
    expect(
      url.startsWith(
        "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=28.6139&longitude=77.209",
      ),
    ).toBe(true);
    expect(url).toContain("hourly=pm2_5,pm10&forecast_days=1");
  });
  it("keeps only today's hours that have data, as indicative AQI", async () => {
    const r = await openMeteo({ fetchImpl: ok(sample) }).forCity("delhi");
    expect(r.hourly.map((h) => h.hour)).toEqual([7, 12, 13]);
    expect(r.hourly[1]?.aqi).toBe(100);
    expect(r.hourly[0]?.aqi).toBeGreaterThan(300);
  });
  it("works with only one pollutant", async () => {
    expect((await openMeteo({ fetchImpl: ok({ ...sample, pm10: null }) }).forCity("pune")).aqi).toBe(300);
    expect(
      (await openMeteo({ fetchImpl: ok({ ...sample, pm2_5: null, pm10: 350 }) }).forCity("pune")).aqi,
    ).toBe(300);
  });
  it("refuses cities we do not list (no user-controlled URLs)", async () => {
    const fetchImpl = ok(sample);
    await expect(openMeteo({ fetchImpl }).forCity("http://evil.example")).rejects.toThrow("unknown city");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("rejects bad upstream answers", async () => {
    await expect(
      openMeteo({
        fetchImpl: vi.fn<typeof fetch>(async () => ({ ok: false, status: 500 }) as Response),
      }).forCity("delhi"),
    ).rejects.toThrow("status 500");
    await expect(
      openMeteo({ fetchImpl: ok({ ...sample, pm2_5: null, pm10: null }) }).forCity("delhi"),
    ).rejects.toThrow("no readings");
    await expect(openMeteo({ fetchImpl: ok({ nope: 1 }) }).forCity("delhi")).rejects.toThrow();
    await expect(
      openMeteo({ fetchImpl: ok(sample, { ...HOURLY, pm10: [1] }) }).forCity("delhi"),
    ).rejects.toThrow("align");
  });
  it("caches for the TTL, then refreshes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fetchImpl = ok(sample);
    const provider = openMeteo({ fetchImpl, ttlMs: 60_000 });
    await provider.forCity("delhi");
    await provider.forCity("delhi");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 61_000);
    await provider.forCity("delhi");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it("gives up when the upstream hangs", async () => {
    const hang = ((_url: string, init: RequestInit) =>
      new Promise((_res, rej) =>
        init.signal?.addEventListener("abort", () => rej(init.signal?.reason)),
      )) as unknown as typeof fetch;
    await expect(openMeteo({ fetchImpl: hang, timeoutMs: 20 }).forCity("delhi")).rejects.toBeTruthy();
  });
});
