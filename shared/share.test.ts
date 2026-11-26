import { describe, expect, it } from "vitest";
import { analyse } from "./analysis";
import { shareText } from "./share";
import { profile } from "./testing";

describe("shareText", () => {
  it("summarises the plan without household details", () => {
    const text = shareText(analyse(profile({ aqi: 350, infants: 1 })), "https://airwise.example");
    expect(text).toContain("AirWise — Delhi: AQI 350 (Very Poor). Family level: Severe.");
    expect(text).toContain("Top steps:\n1. ");
    expect(text).toMatch(/cut our estimated PM2.5 intake by about \d+%/);
    expect(text.endsWith("Make your own plan: https://airwise.example")).toBe(true);
    expect(text).not.toMatch(/infant|baby under|asthma/i);
  });
  it("leaves out sections that do not apply on a clean day", () => {
    const text = shareText(analyse(profile({ aqi: 30, cooking: "induction", commute: "wfh" })), "u");
    expect(text).not.toContain("Top steps");
    expect(text).not.toContain("estimated PM2.5 intake");
    expect(text.split("\n")).toHaveLength(2);
  });
});

describe("shareText layout", () => {
  it("lists at most three steps, one per line, in order", () => {
    const a = analyse(profile({ aqi: 350 }));
    const text = shareText({ ...a, scenario: { ...a.scenario, steps: ["a", "b", "c", "d"] } }, "u");
    expect(text).toContain("Top steps:\n1. a\n2. b\n3. c\n");
    expect(text).not.toContain("4. d");
  });
});
