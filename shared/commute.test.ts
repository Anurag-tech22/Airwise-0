import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compareModes, MODES } from "./commute";
import { exposure } from "./exposure";
import { profile, profileArb } from "./testing";

const rows = (over = {}) => compareModes(profile({ aqi: 350, mask: "none", ...over })) ?? [];
const row = (mode: string, over = {}) => rows(over).find((r) => r.mode === mode);

describe("compareModes", () => {
  it("has nothing to compare for people who work from home or do not commute", () => {
    expect(compareModes(profile({ commute: "wfh" }))).toBeNull();
    expect(compareModes(profile({ commute: "metro", commuteMinutes: 0 }))).toBeNull();
  });
  it("covers every way of travelling and marks the current one", () => {
    const r = rows({ commute: "two-wheeler" });
    expect(r.map((x) => x.mode)).toEqual(MODES.map((m) => m.mode));
    expect(r.filter((x) => x.current).map((x) => x.mode)).toEqual(["two-wheeler"]);
  });
  it("matches the day's exposure model for the current commute", () => {
    for (const commute of ["two-wheeler", "car", "bus", "metro", "walk"] as const) {
      const p = profile({ commute, commuteMinutes: 60, aqi: 300, mask: "surgical" });
      const commuteDose = exposure(p).segments.find((s) => s.label === "Commute")?.dose;
      expect((compareModes(p) ?? []).find((r) => r.current)?.doseUg).toBeCloseTo(commuteDose as number, 6);
    }
  });
  it("shows the metro as cleaner than a two-wheeler, and carbon falling from car to bus to metro", () => {
    expect(row("metro", { commute: "two-wheeler" })?.doseUg).toBeLessThan(
      row("two-wheeler", { commute: "two-wheeler" })?.doseUg as number,
    );
    const co2 = (m: string) => row(m, { commute: "car" })?.co2KgPerWeek as number;
    expect(co2("car")).toBeGreaterThan(co2("bus"));
    expect(co2("bus")).toBeGreaterThan(co2("metro"));
    expect(co2("walk")).toBe(0);
  });
  it("applies the household's mask only where a mask is worn", () => {
    const none = row("two-wheeler", { commute: "two-wheeler", mask: "none" })?.doseUg as number;
    const n95 = row("two-wheeler", { commute: "two-wheeler", mask: "n95" })?.doseUg as number;
    expect(n95).toBeCloseTo(none * 0.25, 6);
    expect(row("car", { commute: "car", mask: "n95" })?.doseUg).toBeCloseTo(
      row("car", { commute: "car", mask: "none" })?.doseUg as number,
      6,
    );
  });
  it("does not suggest walking a long way", () => {
    const far = row("walk", { commute: "car", commuteMinutes: 120 });
    expect(far).toMatchObject({ minutes: null, doseUg: null });
    expect(row("walk", { commute: "car", commuteMinutes: 10 })?.minutes).toBeGreaterThan(0);
  });
  it("never returns negative or non-finite values (property)", () =>
    fc.assert(
      fc.property(profileArb, (p) =>
        (compareModes(p) ?? []).every(
          (r) => r.co2KgPerWeek >= 0 && (r.doseUg === null || (Number.isFinite(r.doseUg) && r.doseUg >= 0)),
        ),
      ),
    ));
});

describe("compareModes details", () => {
  it("reports carbon to one decimal, exactly", () => {
    expect(row("car", { commute: "car", commuteMinutes: 60 })?.co2KgPerWeek).toBe(18.7);
    expect(row("two-wheeler", { commute: "car", commuteMinutes: 60 })?.co2KgPerWeek).toBe(6.6);
    expect(row("metro", { commute: "car", commuteMinutes: 60 })?.co2KgPerWeek).toBe(3.3);
  });
  it("keeps long trips for every mode except walking", () => {
    const bus = row("bus", { commute: "car", commuteMinutes: 200 });
    expect(bus?.minutes).toBe(244);
    expect(bus?.doseUg).not.toBeNull();
  });
  it("allows walking up to exactly 90 minutes", () => {
    expect(row("walk", { commute: "two-wheeler", commuteMinutes: 18 })?.minutes).toBe(90);
    expect(row("walk", { commute: "two-wheeler", commuteMinutes: 19 })?.minutes).toBeNull();
  });
});
