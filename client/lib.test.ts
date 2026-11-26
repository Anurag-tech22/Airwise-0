// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_HOUSEHOLD } from "../shared/household";
import {
  clearSaved,
  currentPosition,
  DEFAULT_SAVED,
  fetchAir,
  geoMessage,
  loadSaved,
  postAsk,
  postBrief,
  saveSaved,
} from "./lib";

const signal = new AbortController().signal;
const reply = (ok: boolean, body: unknown) =>
  vi.fn<typeof fetch>(async () => ({ ok, json: async () => body }) as Response);
const reading = {
  cityId: "delhi",
  aqi: 300,
  category: "Poor",
  pm25: 120,
  pm10: null,
  observedAt: "t",
  hourly: [{ hour: 8, aqi: 300 }],
  source: "s",
};
const ctx = {
  cityName: "Delhi",
  aqi: 300,
  base: "Poor",
  effective: "Poor",
  guidance: "limit" as const,
  vulnerable: [],
  top: [],
};
beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("saved details", () => {
  it("round-trips, clears, and falls back to defaults", () => {
    expect(loadSaved()).toEqual(DEFAULT_SAVED);
    const saved = { household: { ...DEFAULT_HOUSEHOLD, infants: 1 }, cityId: "pune", aqi: 250 };
    saveSaved(saved);
    expect(loadSaved()).toEqual(saved);
    clearSaved();
    expect(loadSaved()).toEqual(DEFAULT_SAVED);
  });
  it("ignores corrupted or invalid data", () => {
    localStorage.setItem("airwise.v1", "{oops");
    expect(loadSaved()).toEqual(DEFAULT_SAVED);
    localStorage.setItem("airwise.v1", JSON.stringify({ household: { infants: 99 }, cityId: "x", aqi: 1 }));
    expect(loadSaved()).toEqual(DEFAULT_SAVED);
  });
  it("never throws when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => saveSaved(DEFAULT_SAVED)).not.toThrow();
    expect(() => clearSaved()).not.toThrow();
  });
});
describe("API calls", () => {
  it("fetches live air for an encoded city id", async () => {
    const f = reply(true, reading);
    vi.stubGlobal("fetch", f);
    expect(await fetchAir("new delhi", signal)).toEqual(reading);
    expect(f.mock.calls[0]?.[0]).toBe("/api/aqi?city=new%20delhi");
  });
  it("posts briefing and question requests as JSON", async () => {
    const f = reply(true, { summary: "S", language: "hi" });
    vi.stubGlobal("fetch", f);
    expect(await postBrief(ctx, "hi", signal)).toEqual({ summary: "S", language: "hi" });
    expect(JSON.parse(String(f.mock.calls[0]?.[1]?.body))).toEqual({ context: ctx, language: "hi" });
    vi.stubGlobal("fetch", reply(true, { answer: "A", source: "ai", emergency: false }));
    expect((await postAsk(ctx, "q", signal)).answer).toBe("A");
  });
  it("surfaces server errors, with a generic fallback", async () => {
    vi.stubGlobal("fetch", reply(false, { error: "Nope." }));
    await expect(fetchAir("delhi", signal)).rejects.toThrow("Nope.");
    vi.stubGlobal("fetch", reply(false, {}));
    await expect(fetchAir("delhi", signal)).rejects.toThrow("Request failed");
  });
  it("rejects responses of the wrong shape", async () => {
    vi.stubGlobal("fetch", reply(true, { hello: "world" }));
    await expect(postAsk(ctx, "q", signal)).rejects.toThrow("Unexpected response");
  });
});

describe("device location", () => {
  const withGeo = (value: unknown) =>
    Object.defineProperty(navigator, "geolocation", { value, configurable: true });
  afterEach(() => Reflect.deleteProperty(navigator, "geolocation"));
  it("resolves with the position when the browser supports it", async () => {
    const position = { coords: { latitude: 18.5, longitude: 73.8 } };
    withGeo({ getCurrentPosition: (ok: (p: unknown) => void) => ok(position) });
    expect(await currentPosition()).toBe(position);
  });
  it("rejects when geolocation is unsupported", async () => {
    await expect(currentPosition()).rejects.toThrow("unsupported");
  });
  it("explains denial and other failures kindly", () => {
    expect(geoMessage({ code: 1 })).toContain("permission was denied");
    expect(geoMessage({ code: 3 })).toContain("Couldn’t get your location");
    expect(geoMessage(new Error("x"))).toContain("Couldn’t get your location");
  });
});
