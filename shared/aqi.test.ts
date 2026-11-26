import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { aqiFromPm10, aqiFromPm25, categoryOf, indianAqi, pm25FromAqi, whoMultiple } from "./aqi";

describe("categories", () => {
  it.each([
    [0, "good"],
    [50, "good"],
    [51, "satisfactory"],
    [100, "satisfactory"],
    [101, "moderate"],
    [200, "moderate"],
    [201, "poor"],
    [300, "poor"],
    [301, "veryPoor"],
    [400, "veryPoor"],
    [401, "severe"],
    [500, "severe"],
    [999, "severe"],
  ])("AQI %i is %s", (aqi, key) => expect(categoryOf(aqi).key).toBe(key));
});
describe("CPCB sub-indices", () => {
  it.each([
    [-5, 0],
    [0, 0],
    [30, 50],
    [45, 75],
    [60, 100],
    [90, 200],
    [120, 300],
    [250, 400],
    [380, 500],
    [1000, 500],
  ])("PM2.5 %f µg/m³ → AQI %f", (c, aqi) => expect(aqiFromPm25(c)).toBeCloseTo(aqi, 6));
  it.each([
    [0, 0],
    [50, 50],
    [100, 100],
    [250, 200],
    [350, 300],
    [430, 400],
    [510, 500],
    [9999, 500],
  ])("PM10 %f µg/m³ → AQI %f", (c, aqi) => expect(aqiFromPm10(c)).toBeCloseTo(aqi, 6));
  it("is monotonic (property)", () =>
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 600, noNaN: true }),
        fc.double({ min: 0, max: 600, noNaN: true }),
        (a, b) => {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          return aqiFromPm25(lo) <= aqiFromPm25(hi) && aqiFromPm10(lo) <= aqiFromPm10(hi);
        },
      ),
    ));
});
describe("indianAqi", () => {
  it("uses whichever pollutant is worse", () => {
    expect(indianAqi({ pm25: 120 })).toBe(300);
    expect(indianAqi({ pm10: 350 })).toBe(300);
    expect(indianAqi({ pm25: 30, pm10: 350 })).toBe(300);
    expect(indianAqi({ pm25: 120, pm10: 50 })).toBe(300);
  });
  it("is 0 with no readings", () => expect(indianAqi({})).toBe(0));
});
describe("pm25FromAqi", () => {
  it.each([0, 50, 75, 100, 150, 200, 250, 300, 350, 400, 450, 500])("round-trips AQI %i", (aqi) =>
    expect(aqiFromPm25(pm25FromAqi(aqi))).toBeCloseTo(aqi, 6),
  );
  it("clamps out-of-range input", () => {
    expect(pm25FromAqi(-10)).toBe(0);
    expect(pm25FromAqi(900)).toBe(380);
  });
});
describe("whoMultiple", () => {
  it.each([
    [15, 1],
    [150, 10],
    [22.5, 1.5],
  ])("%f µg/m³ is %f× the guideline", (c, x) => expect(whoMultiple(c)).toBe(x));
});
