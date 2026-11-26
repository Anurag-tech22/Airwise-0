import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { assessRisk, levelShift, listJoin, vulnerableGroups } from "./risk";
import { profile, profileArb } from "./testing";

const calm = { infants: 0, children: 0, elders: 0, sensitive: false };

describe("levelShift", () => {
  it.each([
    [0, 3, 0],
    [2, 0, 0],
    [1, 1, 1],
    [3, 1, 1],
    [2, 3, 1],
    [3, 2, 2],
    [5, 4, 2],
  ])("base %i with %i groups shifts %i", (base, groups, shift) =>
    expect(levelShift(base, groups)).toBe(shift),
  );
});
describe("assessRisk", () => {
  it("never raises clean air", () => {
    const r = assessRisk(profile({ aqi: 40, infants: 1, sensitive: true }));
    expect(r.effectiveLevel).toBe(0);
    expect(r.guidance).toBe("ok");
    expect(r.reasons).toHaveLength(2);
  });
  it("raises a vulnerable household one step on a Moderate day", () => {
    const r = assessRisk(profile({ aqi: 150, ...calm, children: 1 }));
    expect([r.base.key, r.effective.key, r.guidance]).toEqual(["moderate", "poor", "limit"]);
    expect(r.reasons[1]).toContain("young children");
  });
  it("raises several groups two steps and caps at Severe", () => {
    const r = assessRisk(profile({ aqi: 350, children: 0, infants: 1, elders: 1, sensitive: true }));
    expect(r.effective.key).toBe("severe");
    expect(r.guidance).toBe("avoid");
    expect(r.reasons[1]).toBe(
      "Your household includes a baby under 2, older adults (60+) and someone with asthma or a heart or lung condition, so treat today as Severe for your family.",
    );
  });
  it("leaves a healthy adult household unchanged", () => {
    const r = assessRisk(profile({ aqi: 350, ...calm }));
    expect(r.effectiveLevel).toBe(r.baseLevel);
    expect(r.reasons).toHaveLength(2);
  });
  it("stays between base and Severe (property)", () =>
    fc.assert(
      fc.property(profileArb, (p) => {
        const r = assessRisk(p);
        return r.effectiveLevel >= r.baseLevel && r.effectiveLevel <= 5;
      }),
    ));
});
describe("helpers", () => {
  it("lists vulnerable groups", () => {
    expect(vulnerableGroups(calm)).toEqual([]);
    expect(vulnerableGroups({ infants: 1, children: 2, elders: 1, sensitive: true })).toHaveLength(4);
  });
  it.each([
    [[], ""],
    [["a"], "a"],
    [["a", "b"], "a and b"],
    [["a", "b", "c"], "a, b and c"],
  ])("listJoin %j", (items, out) => expect(listJoin(items)).toBe(out));
});

describe("assessRisk boundaries", () => {
  it("treats Satisfactory air as fine for a healthy household, and says what the AQI is", () => {
    const r = assessRisk(profile({ aqi: 80, ...calm }));
    expect([r.effectiveLevel, r.guidance]).toEqual([1, "ok"]);
    expect(r.reasons[0]).toBe("AQI 80 is Satisfactory.");
    expect(assessRisk(profile({ aqi: 150, ...calm })).guidance).toBe("limit");
  });
});
