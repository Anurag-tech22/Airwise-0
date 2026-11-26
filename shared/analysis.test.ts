import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { analyse } from "./analysis";
import { BriefContextSchema } from "./context";
import { profile, profileArb } from "./testing";

describe("analyse", () => {
  it("assembles a consistent picture from one profile", () => {
    const a = analyse(profile({ aqi: 350, infants: 1 }));
    expect(a.risk.effective.key).toBe("severe");
    expect(a.actions[0]?.id).toBe("babies-indoors");
    expect(a.scenario.after).toBeLessThan(a.scenario.before);
    expect(a.exposure.total).toBeCloseTo(a.scenario.before, 6);
    expect(a.plan).toHaveLength(4);
    expect(a.summary).toContain("350");
    expect(a.pm25).toBeGreaterThan(120);
  });
  it("always yields a valid, privacy-safe context (property)", () =>
    fc.assert(fc.property(profileArb, (p) => BriefContextSchema.safeParse(analyse(p).context).success)));
});
