import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ACH_TARGET, roomCheck, roomMessage } from "./iaq";

describe("roomCheck", () => {
  it("computes volume, the CADR for 4 air changes an hour, and the clean-up time", () => {
    const r = roomCheck({ areaM2: 15, heightCm: 270, cadrM3h: 200 });
    expect(r).toMatchObject({ volumeM3: 41, requiredCadr: 162, verdict: "enough" });
    expect(r?.achNow).toBeCloseTo(200 / 40.5, 6);
    expect(r?.minutesTo90).toBe(28); // ln(10) × 40.5 m³ / 200 m³/h = 0.466 h
  });
  it("tells no purifier, a small purifier and a big enough purifier apart", () => {
    const at = (cadrM3h: number) => roomCheck({ areaM2: 20, heightCm: 250, cadrM3h });
    expect([at(0)?.verdict, at(100)?.verdict, at(200)?.verdict, at(500)?.verdict]).toEqual([
      "none",
      "short",
      "enough",
      "enough",
    ]);
    expect(at(0)?.minutesTo90).toBeNull();
    expect(at(0)?.requiredCadr).toBe(ACH_TARGET * 50);
  });
  it("waits for a complete room size", () => {
    expect(roomCheck({ areaM2: 0, heightCm: 270, cadrM3h: 100 })).toBeNull();
    expect(roomCheck({ areaM2: 12, heightCm: 0, cadrM3h: 100 })).toBeNull();
  });
  it("cleans faster with a stronger purifier and needs more for bigger rooms (property)", () =>
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 200 }),
        fc.integer({ min: 200, max: 500 }),
        fc.integer({ min: 20, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        (areaM2, heightCm, cadr, extra) => {
          const a = roomCheck({ areaM2, heightCm, cadrM3h: cadr });
          const b = roomCheck({ areaM2, heightCm, cadrM3h: cadr + extra });
          const bigger = roomCheck({ areaM2: areaM2 + 10, heightCm, cadrM3h: cadr });
          return (
            (b?.minutesTo90 ?? 0) <= (a?.minutesTo90 ?? 0) &&
            (bigger?.requiredCadr ?? 0) >= (a?.requiredCadr ?? 0)
          );
        },
      ),
    ));
});
describe("roomMessage", () => {
  const msg = (cadrM3h: number) => roomMessage(roomCheck({ areaM2: 20, heightCm: 250, cadrM3h }) as never);
  it("explains each situation in plain words", () => {
    expect(msg(0)).toContain("You have no purifier yet");
    expect(msg(100)).toContain("That is a little low");
    expect(msg(300)).toMatch(/clear about 90% of smoke in ≈ \d+ minutes/);
    expect(msg(300)).not.toContain("a little low");
    expect(msg(0)).toContain("Room volume ≈ 50 m³");
  });
});
