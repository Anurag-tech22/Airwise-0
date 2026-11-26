import { describe, expect, it } from "vitest";
import { fmtHour, outdoorWindows, windowsText, type Hour } from "./windows";

const day = (f: (h: number) => number): Hour[] =>
  Array.from({ length: 24 }, (_, hour) => ({ hour, aqi: f(hour) }));
// A winter-style day: worst at dawn and evening, cleanest in the afternoon.
const winter = day((h) => (h >= 13 && h <= 15 ? 200 : h < 10 || h > 18 ? 340 : 260));

describe("fmtHour", () => {
  it.each([
    [0, "12 am"],
    [6, "6 am"],
    [11, "11 am"],
    [12, "12 pm"],
    [13, "1 pm"],
    [22, "10 pm"],
  ])("%i → %s", (h, text) => expect(fmtHour(h)).toBe(text));
});
describe("outdoorWindows", () => {
  it("finds the cleanest and dirtiest two-hour windows", () => {
    const w = outdoorWindows(winter);
    expect(w?.best).toEqual({ from: 13, to: 15, aqi: 200 });
    expect(w?.worst).toMatchObject({ from: 6, aqi: 340 });
  });
  it("ignores hours that have already passed", () => {
    const w = outdoorWindows(winter, 16);
    expect(w?.best.from).toBeGreaterThanOrEqual(16);
    expect(outdoorWindows(winter, 21)).toBeNull();
    expect(outdoorWindows(winter, Number.NaN)).toBeNull();
  });
  it("needs two consecutive hours of data", () => {
    expect(outdoorWindows([{ hour: 12, aqi: 100 }])).toBeNull();
    expect(outdoorWindows([])).toBeNull();
    expect(
      outdoorWindows([
        { hour: 12, aqi: 100 },
        { hour: 14, aqi: 300 },
      ]),
    ).toBeNull();
    expect(
      outdoorWindows([
        { hour: 12, aqi: 100 },
        { hour: 13, aqi: 301 },
      ])?.best,
    ).toEqual({ from: 12, to: 14, aqi: 201 });
  });
  it("only considers daytime hours", () =>
    expect(outdoorWindows(day((h) => (h < 6 || h > 21 ? 10 : 300)))?.best.aqi).toBe(300));
  it("prefers the earliest window on ties", () => expect(outdoorWindows(day(() => 150))?.best.from).toBe(6));
});
describe("windowsText", () => {
  it("describes best and worst", () =>
    expect(windowsText(outdoorWindows(winter) as never)).toBe(
      "Best time outdoors today: 1 pm–3 pm (AQI ≈ 200). Worst: 6 am–8 am (AQI ≈ 340).",
    ));
  it("says so when the day is flat", () =>
    expect(windowsText(outdoorWindows(day(() => 150)) as never)).toBe(
      "Air stays about the same through the day (AQI ≈ 150).",
    ));
});

describe("outdoorWindows edges", () => {
  it("includes the last window of the evening (8–10 pm)", () => {
    const w = outdoorWindows(day((h) => (h === 20 || h === 21 ? 50 : 300)));
    expect(w?.best).toEqual({ from: 20, to: 22, aqi: 50 });
  });
  it("finds a worst window that is not the first one", () => {
    const w = outdoorWindows(day((h) => (h === 18 || h === 19 ? 400 : 200)));
    expect(w?.worst).toEqual({ from: 18, to: 20, aqi: 400 });
    expect(w?.worst.from).toBeGreaterThan(w?.best.from ?? 99);
  });
});
