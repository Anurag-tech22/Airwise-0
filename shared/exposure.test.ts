import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { exposure, percentDrop } from "./exposure";
import { profile, profileArb } from "./testing";

const total = (over = {}) => exposure(profile(over)).total;
const seg = (over: object, label: string) =>
  exposure(profile(over)).segments.find((s) => s.label === label)?.dose ?? 0;

describe("exposure model", () => {
  it("is zero in clean air and grows with the AQI", () => {
    expect(total({ aqi: 0, cooking: "induction" })).toBe(0);
    fc.assert(
      fc.property(
        profileArb,
        fc.integer({ min: 0, max: 499 }),
        (p, aqi) => exposure({ ...p, aqi }).total <= exposure({ ...p, aqi: aqi + 1 }).total + 1e-9,
      ),
    );
  });
  it("is lower with a better mask, purifier and shut windows", () => {
    expect(seg({ mask: "n95" }, "Commute")).toBeLessThan(seg({ mask: "surgical" }, "Commute"));
    expect(seg({ mask: "surgical" }, "Commute")).toBeLessThan(seg({ mask: "cloth" }, "Commute"));
    expect(seg({ mask: "cloth" }, "Commute")).toBeLessThan(seg({ mask: "none" }, "Commute"));
    expect(total({ purifier: "hepa" })).toBeLessThan(total({ purifier: "diy" }));
    expect(total({ purifier: "diy" })).toBeLessThan(total({ purifier: "none" }));
    expect(total({ windows: "closed" })).toBeLessThan(total({ windows: "open" }));
  });
  it("ranks cooking fuels", () => {
    expect(total({ cooking: "induction" })).toBeLessThan(total({ cooking: "lpg" }));
    expect(total({ cooking: "lpg" })).toBeLessThan(total({ cooking: "biomass" }));
  });
  it("counts no commute when working from home", () =>
    expect(seg({ commute: "wfh", commuteMinutes: 90 }, "Commute")).toBe(0));
  it("does not apply a mask inside a car", () =>
    expect(seg({ commute: "car", mask: "n95" }, "Commute")).toBe(
      seg({ commute: "car", mask: "none" }, "Commute"),
    ));
  it("only models a child when the household has one", () => {
    const solo = exposure(profile({ children: 0, infants: 0, kidsOutdoorMinutes: 200 }));
    expect(solo.child).toBe(0);
    expect(solo.segments.some((s) => s.label.startsWith("Children"))).toBe(false);
    const family = exposure(profile({ children: 1 }));
    expect(family.child).toBeGreaterThan(0);
    expect(family.segments.some((s) => s.label.startsWith("Children"))).toBe(true);
  });
  it("sorts segments largest first and they add up to the total", () => {
    const e = exposure(profile());
    expect(e.segments.map((s) => s.dose)).toEqual([...e.segments.map((s) => s.dose)].sort((a, b) => b - a));
    expect(e.segments.reduce((a, s) => a + s.dose, 0)).toBeCloseTo(e.total, 6);
    expect(e.adult + e.child).toBeCloseTo(e.total, 6);
  });
  it("never goes negative even with an impossible schedule", () =>
    expect(
      total({ commuteMinutes: 300, exerciseMinutes: 240, kidsOutdoorMinutes: 300, children: 1 }),
    ).toBeGreaterThan(0));
  it("percentDrop handles zero", () => {
    expect(percentDrop(0, 0)).toBe(0);
    expect(percentDrop(200, 50)).toBe(75);
  });
});

describe("exposure model, worked by hand", () => {
  // AQI 350 → 185 µg/m³. Windows open (×0.9) → home 166.5; LPG adds 10 while cooking → 176.5.
  const family = () =>
    exposure(
      profile({
        aqi: 350,
        infants: 0,
        children: 1,
        purifier: "none",
        windows: "open",
        cooking: "lpg",
        commute: "car",
        commuteMinutes: 60,
        kidsOutdoorMinutes: 60,
        exerciseMinutes: 30,
        mask: "none",
      }),
    );
  const dose = (label: string) => family().segments.find((s) => s.label === label)?.dose;
  it("matches the hand calculation for every part of the day", () => {
    expect(dose("Commute")).toBeCloseTo(1 * 185 * 0.5 * 0.6, 6); // 55.5
    expect(dose("Outdoor exercise")).toBeCloseTo(0.5 * 185 * 2.5, 6); // 231.25
    expect(dose("Cooking fumes at home")).toBeCloseTo(2 * 176.5 * 1 + 2 * 176.5 * 0.7, 6); // adult + child, 600.1
    expect(dose("Time at home and work")).toBeCloseTo(20.5 * 166.5 * 0.5, 6); // 1,706.625
    expect(dose("Children’s outdoor time")).toBeCloseTo(1 * 185 * 1.5, 6); // 277.5
    expect(dose("Time at home and school")).toBeCloseTo(21 * 166.5 * 0.35, 6); // 1,223.775
  });
  it("adds up to the adult, child and family totals", () => {
    const e = family();
    expect(e.adult).toBeCloseTo(2346.375, 6);
    expect(e.child).toBeCloseTo(1748.375, 6);
    expect(e.total).toBeCloseTo(4094.75, 6);
  });
  it("applies the same arithmetic with a purifier and wood cooking", () => {
    // AQI 200 → 90 µg/m³; closed windows ×0.6 and HEPA ×0.4 → home 21.6; wood adds 80 × 0.4 = 32 → cooking 53.6.
    const e = exposure(
      profile({
        aqi: 200,
        infants: 0,
        children: 1,
        purifier: "hepa",
        windows: "closed",
        cooking: "biomass",
        commute: "wfh",
        commuteMinutes: 0,
        kidsOutdoorMinutes: 0,
        exerciseMinutes: 0,
        mask: "none",
      }),
    );
    const part = (label: string) => e.segments.find((s) => s.label === label)?.dose;
    expect(part("Cooking fumes at home")).toBeCloseTo(2 * 53.6 * 1 + 2 * 53.6 * 0.7, 6);
    expect(part("Time at home and work")).toBeCloseTo(22 * 21.6 * 0.5, 6);
    expect(part("Time at home and school")).toBeCloseTo(22 * 21.6 * 0.35, 6);
  });
});
