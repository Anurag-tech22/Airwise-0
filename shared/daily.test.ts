import { describe, expect, it } from "vitest";
import { dailyPlan } from "./daily";
import { assessRisk } from "./risk";
import { profile } from "./testing";

const plan = (over: object) => {
  const p = profile(over);
  return dailyPlan(p, assessRisk(p));
};
const quiet = {
  children: 0,
  infants: 0,
  exerciseMinutes: 0,
  purifier: "hepa" as const,
  commute: "wfh" as const,
};

describe("dailyPlan", () => {
  it("is four parts for every level", () =>
    [40, 150, 250, 450].forEach((aqi) => expect(plan({ aqi, ...quiet })).toHaveLength(4)));
  it("is relaxed in clean air, whatever the household", () => {
    const p = plan({ aqi: 40, children: 2, exerciseMinutes: 60, purifier: "none" });
    expect(p.every((b) => b.window === "best")).toBe(true);
    expect(p.map((b) => b.text).join(" ")).not.toContain("indoors");
  });
  it("points to midday as the best window when smog is moderate", () => {
    const p = plan({ aqi: 220, ...quiet });
    expect(p.map((b) => b.window)).toEqual(["caution", "best", "caution", "caution"]);
  });
  it("avoids early morning and evening on the worst days", () => {
    const p = plan({ aqi: 450, ...quiet });
    expect(p.map((b) => b.window)).toEqual(["avoid", "caution", "avoid", "caution"]);
  });
  it("adds household-specific advice", () => {
    const text = plan({ aqi: 450, children: 1, exerciseMinutes: 30, purifier: "none", commute: "metro" })
      .map((b) => b.text)
      .join(" ");
    expect(text).toContain("Move your workout indoors");
    expect(text).toContain("fitted N95");
    expect(text).toContain("indoor games");
    expect(text).toContain("DIY filter box");
  });
  it("skips the N95 tip for car or home commutes and when the day is only moderate", () => {
    expect(
      plan({ aqi: 450, commute: "car" })
        .map((b) => b.text)
        .join(" "),
    ).not.toContain("on the way");
    expect(
      plan({ aqi: 220, commute: "metro", children: 0 })
        .map((b) => b.text)
        .join(" "),
    ).not.toContain("on the way");
  });
});

describe("dailyPlan, level by level", () => {
  const calm = {
    children: 0,
    infants: 0,
    elders: 0,
    sensitive: false,
    exerciseMinutes: 0,
    purifier: "hepa" as const,
    commute: "wfh" as const,
  };
  const windows = (aqi: number) => plan({ aqi, ...calm }).map((b) => b.window);
  it("moves from relaxed to cautious to strict at the right levels", () => {
    expect(windows(80)).toEqual(["best", "best", "best", "best"]);
    expect(windows(150)).toEqual(["caution", "best", "caution", "caution"]);
    expect(windows(250)).toEqual(["caution", "best", "caution", "caution"]);
    expect(windows(350)).toEqual(["avoid", "caution", "avoid", "caution"]);
  });
  it("adds each household tip only when it applies, in the right part of the day", () => {
    const text = (over: object, part: number) => plan({ aqi: 450, ...calm, ...over })[part]?.text ?? "";
    expect(text({ exerciseMinutes: 30 }, 0).endsWith(" Move your workout indoors today.")).toBe(true);
    expect(text({ exerciseMinutes: 0 }, 0)).not.toContain("workout");
    expect(text({ children: 1 }, 2).endsWith(" Swap outdoor play for indoor games.")).toBe(true);
    expect(text({ infants: 1 }, 2)).toContain("indoor games");
    expect(text({}, 2)).not.toContain("indoor games");
    expect(
      text({ purifier: "none" }, 3).endsWith(" A purifier or DIY filter box in the bedroom helps most."),
    ).toBe(true);
    expect(text({ purifier: "diy" }, 3)).not.toContain("DIY filter box");
  });
  it("suggests an N95 for walking, two-wheeler, bus and metro commutes only", () => {
    const tip = (commute: string) =>
      plan({ aqi: 450, ...calm, commute: commute as never })[1]?.text.endsWith(
        " Wear a fitted N95 on the way.",
      );
    expect(["walk", "two-wheeler", "bus", "metro"].map(tip)).toEqual([true, true, true, true]);
    expect(["car", "wfh"].map(tip)).toEqual([false, false]);
  });
});
