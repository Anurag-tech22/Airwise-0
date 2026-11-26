import { describe, expect, it } from "vitest";
import { recommend, scenario } from "./actions";
import { AirReadingSchema, AskRequestSchema, BriefRequestSchema } from "./api";
import { CITIES, cityById, cityName } from "./cities";
import { BriefContextSchema, buildContext } from "./context";
import { DEFAULT_HOUSEHOLD, HouseholdSchema, ProfileSchema } from "./household";
import { MYTHS } from "./myths";
import { assessRisk } from "./risk";
import { summarize } from "./summary";
import { profile } from "./testing";

describe("household schemas", () => {
  it("accepts the defaults and rejects unknown or out-of-range fields", () => {
    expect(HouseholdSchema.safeParse(DEFAULT_HOUSEHOLD).success).toBe(true);
    expect(HouseholdSchema.safeParse({ ...DEFAULT_HOUSEHOLD, name: "Asha" }).success).toBe(false);
    expect(HouseholdSchema.safeParse({ ...DEFAULT_HOUSEHOLD, infants: 9 }).success).toBe(false);
    expect(ProfileSchema.safeParse(profile({ aqi: 501 })).success).toBe(false);
    expect(ProfileSchema.safeParse(profile()).success).toBe(true);
  });
});
describe("cities", () => {
  it("has unique ids and plausible coordinates inside India", () => {
    expect(new Set(CITIES.map((c) => c.id)).size).toBe(CITIES.length);
    expect(CITIES.every((c) => c.lat > 6 && c.lat < 37 && c.lon > 68 && c.lon < 98)).toBe(true);
  });
  it("looks cities up", () => {
    expect(cityById("pune")?.name).toBe("Pune");
    expect(cityById("atlantis")).toBeUndefined();
    expect(cityName("delhi")).toBe("Delhi");
    expect(cityName("atlantis")).toBe("your area");
  });
});
describe("context and summary", () => {
  const p = profile({ aqi: 350, children: 1 });
  const r = assessRisk(p);
  const actions = recommend(p);
  it("builds a context that passes its own schema and is capped at five steps", () => {
    const c = buildContext(p, r, actions);
    expect(BriefContextSchema.safeParse(c).success).toBe(true);
    expect(c.top.length).toBeLessThanOrEqual(5);
    expect(c).not.toHaveProperty("children");
  });
  it("summarises in plain language", () => {
    const text = summarize(p, r, scenario(p, actions));
    expect(text).toContain("AQI in Delhi is 350 (Very Poor)");
    expect(text).toContain("WHO daily PM2.5 guideline");
    expect(text).toMatch(/could cut your estimated PM2.5 intake by about \d+%/);
  });
  it("mentions the family level only when it differs, and a single step in the singular", () => {
    const calm = profile({ aqi: 350, children: 0, infants: 0 });
    expect(summarize(calm, assessRisk(calm), scenario(calm, recommend(calm)))).not.toContain(
      "For your family",
    );
    expect(summarize(p, r, { before: 10, after: 5, reductionPct: 50, steps: ["x"] })).toContain(
      "top step could",
    );
    expect(summarize(p, r, { before: 10, after: 10, reductionPct: 0, steps: [] })).not.toContain("could cut");
  });
});
describe("static content and API schemas", () => {
  it("ships myths with facts", () => {
    expect(MYTHS.length).toBeGreaterThanOrEqual(5);
    expect(MYTHS.every((m) => m.myth.length > 10 && m.fact.length > 20)).toBe(true);
  });
  it("validates requests strictly", () => {
    const context = buildContext(profile(), assessRisk(profile()), []);
    expect(BriefRequestSchema.safeParse({ context, language: "hi" }).success).toBe(true);
    expect(BriefRequestSchema.safeParse({ context, language: "fr" }).success).toBe(false);
    expect(AskRequestSchema.safeParse({ context, question: "ok?" }).success).toBe(true);
    expect(AskRequestSchema.safeParse({ context, question: "   " }).success).toBe(false);
    expect(AskRequestSchema.safeParse({ context, question: "x".repeat(301) }).success).toBe(false);
    expect(AskRequestSchema.safeParse({ context, question: "ok", admin: true }).success).toBe(false);
    expect(
      AirReadingSchema.safeParse({
        cityId: "delhi",
        aqi: 300,
        category: "Poor",
        pm25: null,
        pm10: 200,
        observedAt: "t",
        hourly: [{ hour: 8, aqi: 310 }],
        source: "s",
      }).success,
    ).toBe(true);
  });
});

import { distanceKm, nearestCity } from "./cities";
describe("location", () => {
  it("measures great-circle distance", () => {
    expect(distanceKm(28.6139, 77.209, 28.6139, 77.209)).toBe(0);
    const delhiMumbai = distanceKm(28.6139, 77.209, 19.076, 72.8777);
    expect(delhiMumbai).toBeGreaterThan(1100);
    expect(delhiMumbai).toBeLessThan(1200);
  });
  it("finds the nearest listed city, or none when too far", () => {
    expect(nearestCity(18.52, 73.85)?.city.id).toBe("pune");
    expect(nearestCity(28.7, 77.1)?.city.id).toBe("delhi");
    expect(nearestCity(0, 0)).toBeNull();
    expect(nearestCity(18.9, 73.9, 10)).toBeNull();
    expect(nearestCity(18.9, 73.9, 100)?.city.id).toBe("pune");
  });
});

describe("summary wording", () => {
  const steps = (n: number) => ({
    before: 100,
    after: 100 - n,
    reductionPct: 10 * n,
    steps: Array.from({ length: n }, (_, i) => `s${i}`),
  });
  it("reads as one clear paragraph when the family level equals the air", () => {
    const p = profile({ aqi: 350, children: 0, infants: 0 });
    expect(summarize(p, assessRisk(p), steps(3))).toBe(
      "Today’s AQI in Delhi is 350 (Very Poor) — about 12.3× the WHO daily PM2.5 guideline. Avoid outdoor exercise and children’s outdoor play; keep essential trips short. Taking your top 3 steps could cut your estimated PM2.5 intake by about 30%.",
    );
  });
  it("adds the family-level sentence, in the right place, when the household raises it", () => {
    const p = profile({ aqi: 350, children: 1 });
    expect(summarize(p, assessRisk(p), steps(2))).toBe(
      "Today’s AQI in Delhi is 350 (Very Poor) — about 12.3× the WHO daily PM2.5 guideline. For your family it counts as Severe. Avoid outdoor exercise and children’s outdoor play; keep essential trips short. Taking your top 2 steps could cut your estimated PM2.5 intake by about 20%.",
    );
  });
  it("says 'step' for one step and 'N steps' for several", () => {
    const p = profile({ aqi: 350 });
    expect(summarize(p, assessRisk(p), steps(1))).toContain("Taking your top step could cut");
    expect(summarize(p, assessRisk(p), steps(2))).toContain("Taking your top 2 steps could cut");
  });
});
