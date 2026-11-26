import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AirReading } from "../shared/api";
import { EMERGENCY_ANSWER } from "../shared/ask";
import type { BriefContext } from "../shared/context";
import { offlineAi, type Ai } from "./ai";
import type { AirProvider } from "./aqiProvider";
import { createApp, type Deps } from "./app";

const context: BriefContext = {
  cityName: "Delhi",
  aqi: 320,
  base: "Very Poor",
  effective: "Severe",
  guidance: "avoid",
  vulnerable: ["young children"],
  top: ["Wear an N95", "Run a purifier"],
};
const reading: AirReading = {
  cityId: "delhi",
  aqi: 300,
  category: "Poor",
  pm25: 120,
  pm10: 200,
  observedAt: "2026-11-17T08:00",
  hourly: [{ hour: 8, aqi: 300 }],
  source: "test",
};
const makeAi = (over: Partial<Ai> = {}): Ai => ({
  brief: vi.fn(async () => "Summary."),
  ask: vi.fn(async () => "AI answer."),
  ...over,
});
const makeAir = (over: Partial<AirProvider> = {}): AirProvider => ({
  forCity: vi.fn(async () => reading),
  ...over,
});
const app = (deps: Partial<Deps> = {}, opts = {}) =>
  createApp({ ai: makeAi(), air: makeAir(), ...deps }, opts);

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("health", () => {
  it("reports liveness and the provider", async () => {
    expect((await request(app({}, { provider: "vertex" })).get("/api/health")).body).toEqual({
      ok: true,
      ai: "vertex",
    });
    expect((await request(app()).get("/api/health")).body).toEqual({ ok: true, ai: "offline" });
  });
  it("deep-checks the model and caches the probe for a minute", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const ai = makeAi();
    const a = app({ ai });
    expect((await request(a).get("/api/health/ai")).body).toMatchObject({ ok: true, working: true });
    await request(a).get("/api/health/ai");
    expect(ai.brief).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 61_000);
    await request(a).get("/api/health/ai");
    vi.useRealTimers();
    expect(ai.brief).toHaveBeenCalledTimes(2);
    expect((await request(app({ ai: offlineAi })).get("/api/health/ai")).body.working).toBe(false);
  });
});
describe("GET /api/aqi", () => {
  it("returns live air for a known city", async () => {
    const r = await request(app()).get("/api/aqi?city=delhi");
    expect(r.status).toBe(200);
    expect(r.body).toEqual(reading);
  });
  it("404s for unknown cities and never calls the provider", async () => {
    const air = makeAir();
    expect((await request(app({ air })).get("/api/aqi?city=atlantis")).status).toBe(404);
    expect(air.forCity).not.toHaveBeenCalled();
  });
  it("rejects a missing or oversized city", async () => {
    expect((await request(app()).get("/api/aqi")).status).toBe(400);
    expect((await request(app()).get(`/api/aqi?city=${"x".repeat(40)}`)).status).toBe(400);
  });
  it("answers 502 with a helpful message when the provider fails, without leaking details", async () => {
    const air = makeAir({
      forCity: vi.fn(async () => {
        throw new Error("secret upstream detail");
      }),
    });
    const r = await request(app({ air })).get("/api/aqi?city=delhi").set("X-Cloud-Trace-Context", "t1/1");
    expect(r.status).toBe(502);
    expect(r.body.error).toContain("Enter today’s AQI manually");
    expect(JSON.stringify(r.body)).not.toContain("secret");
  });
});
describe("POST /api/brief", () => {
  it("returns the AI briefing in the requested language", async () => {
    const r = await request(app()).post("/api/brief").send({ context, language: "hi" });
    expect(r.body).toEqual({ summary: "Summary.", language: "hi" });
  });
  it("is 503 when the model is unavailable", async () => {
    const r = await request(app({ ai: offlineAi }))
      .post("/api/brief")
      .send({ context, language: "en" });
    expect(r.status).toBe(503);
    expect(r.body.error).toContain("unavailable");
  });
  it("validates strictly", async () => {
    expect((await request(app()).post("/api/brief").send({ context, language: "fr" })).status).toBe(400);
    expect((await request(app()).post("/api/brief").send({ context, language: "en", extra: 1 })).status).toBe(
      400,
    );
    expect(
      (
        await request(app())
          .post("/api/brief")
          .send({ context: { ...context, aqi: 900 }, language: "en" })
      ).status,
    ).toBe(400);
  });
});
describe("POST /api/ask", () => {
  it("returns the AI answer when available", async () => {
    const r = await request(app()).post("/api/ask").send({ context, question: "Can we play outside?" });
    expect(r.body).toEqual({ answer: "AI answer.", source: "ai", emergency: false });
  });
  it("falls back to rules when the AI is unavailable", async () => {
    const r = await request(app({ ai: offlineAi }))
      .post("/api/ask")
      .send({ context, question: "Can we play outside?" });
    expect(r.body).toMatchObject({ source: "rules", emergency: false });
    expect(r.body.answer).toMatch(/stay indoors/);
  });
  it("answers a possible emergency with the safe message and never calls the AI", async () => {
    const ai = makeAi();
    const r = await request(app({ ai }))
      .post("/api/ask")
      .send({ context, question: "my son has chest pain" });
    expect(r.body).toEqual({ answer: EMERGENCY_ANSWER, source: "rules", emergency: true });
    expect(ai.ask).not.toHaveBeenCalled();
  });
  it("rejects empty, oversized and unknown-field requests", async () => {
    for (const body of [
      { context, question: "  " },
      { context, question: "x".repeat(301) },
      { context, question: "ok", admin: true },
    ]) {
      expect((await request(app()).post("/api/ask").send(body)).status).toBe(400);
    }
  });
});
describe("hardening", () => {
  it("sends security headers and never caches API responses", async () => {
    const r = await request(app()).get("/api/health");
    const csp = String(r.headers["content-security-policy"]);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self';");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self'");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.headers["permissions-policy"]).toBe(
      "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
    );
    expect(r.headers["x-powered-by"]).toBeUndefined();
    expect(r.headers["x-dns-prefetch-control"]).toBe("off");
    expect(r.headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(r.headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(r.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(r.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("rate-limits only the API", async () => {
    const a = app({}, { limit: 2 });
    for (let i = 0; i < 5; i++) await request(a).get("/index.html");
    await request(a).get("/api/health");
    await request(a).get("/api/health");
    expect((await request(a).get("/api/health")).status).toBe(429);
  });
  it("returns JSON 404 for unknown API routes", async () => {
    const r = await request(app()).get("/api/nope");
    expect([r.status, r.body]).toEqual([404, { error: "Not found." }]);
  });
  it("rejects malformed and oversized JSON", async () => {
    expect(
      (await request(app()).post("/api/ask").set("Content-Type", "application/json").send("{bad")).status,
    ).toBe(400);
    expect(
      (
        await request(app())
          .post("/api/ask")
          .send({ context, question: "a", pad: "x".repeat(40000) })
      ).status,
    ).toBe(413);
  });
  it("hides internals on a 500 and logs a structured, trace-linked entry", async () => {
    process.env.GOOGLE_CLOUD_PROJECT = "demo";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ai = makeAi({
      ask: vi.fn(async () => {
        throw new Error("secret");
      }),
    });
    const r = await request(app({ ai }))
      .post("/api/ask")
      .set("X-Cloud-Trace-Context", "t123/1;o=1")
      .send({ context, question: "hello" });
    delete process.env.GOOGLE_CLOUD_PROJECT;
    expect([r.status, JSON.stringify(r.body)]).toEqual([500, '{"error":"Something went wrong."}']);
    expect(JSON.parse(String(spy.mock.calls[0]?.[0]))).toMatchObject({
      severity: "ERROR",
      status: 500,
      "logging.googleapis.com/trace": "projects/demo/traces/t123",
    });
  });
  it("controls CORS and proxy trust", async () => {
    expect(
      (await request(app()).get("/api/health").set("Origin", "https://evil.example")).headers[
        "access-control-allow-origin"
      ],
    ).toBeUndefined();
    expect(
      (
        await request(app({}, { origin: "https://ok.example" }))
          .get("/api/health")
          .set("Origin", "https://ok.example")
      ).headers["access-control-allow-origin"],
    ).toBe("https://ok.example");
    expect(
      (
        await request(app({}, { trustProxy: true }))
          .get("/api/health")
          .set("X-Forwarded-For", "1.2.3.4")
      ).status,
    ).toBe(200);
  });
});
