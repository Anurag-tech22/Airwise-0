import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { recommend, scenario } from "./actions";
import { exposure, percentDrop } from "./exposure";
import { assessRisk } from "./risk";
import { profile, profileArb } from "./testing";

const ids = (over = {}) => recommend(profile(over)).map((a) => a.id);
const find = (over: object, id: string) => recommend(profile(over)).find((a) => a.id === id);

describe("recommend", () => {
  it("only gives everyday habits in clean air", () =>
    expect(ids({ aqi: 40 })).toEqual(["check-aqi", "no-burning"]));
  it("puts safety first and then the biggest modelled wins", () => {
    const actions = recommend(profile({ aqi: 380, infants: 1, children: 0 }));
    expect(actions[0]?.id).toBe("babies-indoors");
    const modelled = actions.filter((a) => a.reductionPct !== null).map((a) => a.reductionPct as number);
    expect(modelled).toEqual([...modelled].sort((a, b) => b - a));
    expect(modelled.every((x) => x >= 1 && x <= 100)).toBe(true);
  });
  it("halves children’s outdoor time on a borderline day and removes it on a bad one", () => {
    const moderate = profile({ aqi: 150, kidsOutdoorMinutes: 60 });
    const before = exposure(moderate).total;
    expect(find({ aqi: 150 }, "kids-play")?.reductionPct).toBe(
      percentDrop(before, exposure({ ...moderate, kidsOutdoorMinutes: 30 }).total),
    );
    const bad = profile({ aqi: 350 });
    expect(find({ aqi: 350 }, "kids-play")?.reductionPct).toBe(
      percentDrop(exposure(bad).total, exposure({ ...bad, kidsOutdoorMinutes: 0 }).total),
    );
  });
  it("tailors to the household", () => {
    expect(ids({ commute: "car" })).toContain("car-share");
    expect(find({ commute: "car" }, "car-share")).toMatchObject({ reductionPct: null });
    expect(find({ commute: "car" }, "car-share")?.co2SavedKgPerWeek).toBeGreaterThan(0);
    expect(find({ commute: "two-wheeler" }, "two-wheeler-metro")?.co2SavedKgPerWeek).toBeGreaterThan(0);
    expect(ids({ cooking: "biomass" })).toContain("cooking-switch");
    expect(ids({ cooking: "lpg" })).toContain("kitchen-vent");
    expect(ids({ mask: "n95" })).toContain("mask-fit");
    expect(ids({ mask: "n95" })).not.toContain("n95");
    expect(ids({ purifier: "hepa", sensitive: true })).toContain("clean-room");
    expect(ids({ purifier: "hepa", sensitive: false, infants: 0, elders: 0 })).not.toContain("clean-room");
    expect(ids({ aqi: 480, commute: "two-wheeler" })).toContain("wfh");
    expect(ids({ aqi: 320, commute: "metro" })).not.toContain("wfh");
  });
  it("adds community actions only where they apply", () => {
    expect(ids({ aqi: 350 })).toEqual(expect.arrayContaining(["school-indoors", "neighbours"]));
    expect(ids({ aqi: 350, children: 0, infants: 0 })).not.toContain("school-indoors");
    expect(ids({ aqi: 150, children: 0, infants: 0 })).toContain("neighbours");
    expect(ids({ aqi: 40 })).not.toContain("neighbours");
  });
  it("drops modelled actions with no real effect, unless they save carbon", () => {
    const tiny = { aqi: 350, children: 0, commute: "wfh" as const, exerciseMinutes: 1 };
    expect(ids(tiny)).not.toContain("n95");
    const brief = recommend(profile({ aqi: 350, commute: "two-wheeler", commuteMinutes: 1 }));
    expect(brief.find((a) => a.id === "two-wheeler-metro")?.co2SavedKgPerWeek).toBeGreaterThan(0);
  });
  it("is stable for any profile (property)", () =>
    fc.assert(
      fc.property(profileArb, (p) =>
        recommend(p).every((a) => a.reductionPct === null || (a.reductionPct >= 0 && a.reductionPct <= 100)),
      ),
    ));
});
describe("scenario", () => {
  it("combines the top modelled actions and never doubles up on alternatives", () => {
    const p = profile({ aqi: 350, infants: 1 });
    const actions = recommend(p);
    const sc = scenario(p, actions);
    expect(sc.steps.length).toBeGreaterThan(0);
    expect(sc.steps.length).toBeLessThanOrEqual(3);
    expect(sc.steps.filter((s) => /HEPA|DIY air cleaner/.test(s)).length).toBeLessThanOrEqual(1);
    expect(sc.after).toBeLessThan(sc.before);
    expect(sc.reductionPct).toBeGreaterThan(0);
  });
  it("respects the limit and handles nothing to apply", () => {
    const p = profile({ aqi: 350 });
    expect(scenario(p, recommend(p), assessRisk(p), 1).steps).toHaveLength(1);
    const none = scenario(profile({ aqi: 40 }), recommend(profile({ aqi: 40 })));
    expect(none).toMatchObject({ steps: [], reductionPct: 0 });
  });
  it("never makes things worse (property)", () =>
    fc.assert(
      fc.property(profileArb, (p) => {
        const sc = scenario(p, recommend(p));
        return sc.after <= sc.before + 1e-9 && sc.reductionPct >= 0 && sc.reductionPct <= 100;
      }),
    ));
});

describe("recommend, exact behaviour", () => {
  it("ranks a family with a baby in a fixed, explainable order", () => {
    expect(ids({ aqi: 350, infants: 1, children: 1 })).toEqual([
      "babies-indoors",
      "purifier-hepa",
      "purifier-diy",
      "windows",
      "n95",
      "kids-play",
      "exercise-indoors",
      "two-wheeler-metro",
      "wfh",
      "kitchen-vent",
      "midday-errands",
      "damp-mop",
      "school-indoors",
      "neighbours",
      "check-aqi",
      "no-burning",
    ]);
  });
  it("reports carbon savings to one decimal", () => {
    expect(
      find({ aqi: 350, commute: "two-wheeler", commuteMinutes: 60 }, "two-wheeler-metro")?.co2SavedKgPerWeek,
    ).toBe(3.8);
    expect(find({ aqi: 150, commute: "car", commuteMinutes: 60 }, "car-share")?.co2SavedKgPerWeek).toBe(6.2);
  });
  it("keeps an action that helps by exactly 1%, and drops one that helps by less", () => {
    const small = {
      aqi: 350,
      children: 0,
      infants: 0,
      commute: "wfh" as const,
      cooking: "induction" as const,
    };
    expect(find({ ...small, exerciseMinutes: 2 }, "n95")?.reductionPct).toBe(1);
    expect(find({ ...small, exerciseMinutes: 1 }, "n95")).toBeUndefined();
  });
  it("combines exactly one purifier when two alternatives are on offer", () => {
    const p = profile({ aqi: 350, infants: 1 });
    const steps = scenario(p, recommend(p)).steps;
    expect(steps.filter((s) => /HEPA|DIY air cleaner/.test(s))).toHaveLength(1);
  });
});

describe("recommend, ordering of small effects", () => {
  it("ranks a modelled action ahead of everyday habits even when it only saves carbon", () => {
    const list = ids({ aqi: 350, commute: "two-wheeler", commuteMinutes: 1, children: 0, infants: 0 });
    expect(list.indexOf("two-wheeler-metro")).toBeGreaterThan(-1);
    expect(list.indexOf("two-wheeler-metro")).toBeLessThan(list.indexOf("midday-errands"));
  });
});
