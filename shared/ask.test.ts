import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { EMERGENCY_ANSWER, answerOffline, classify, isEmergency } from "./ask";
import type { BriefContext } from "./context";

const ctx = (over: Partial<BriefContext> = {}): BriefContext => ({
  cityName: "Delhi",
  aqi: 320,
  base: "Very Poor",
  effective: "Severe",
  guidance: "avoid",
  vulnerable: ["young children"],
  top: ["Wear an N95", "Run a purifier", "Shut windows", "Extra"],
  ...over,
});

describe("emergencies", () => {
  it.each([
    "my son has chest pain",
    "he can't breathe",
    "she cannot breathe properly",
    "severe wheezing",
    "blue lips!",
    "grandpa fainted",
    "asthma attack now",
    "सांस लेने में तकलीफ",
    "difficulty breathing",
  ])("detects %s", (q) => expect(isEmergency(q)).toBe(true));
  it("does not trigger on ordinary questions", () =>
    expect(isEmergency("Can my kids play cricket today?")).toBe(false));
  it("answers an emergency with the safe message, never rules advice", () =>
    expect(answerOffline("my father has chest pain, should I use a purifier?", ctx())).toEqual({
      answer: EMERGENCY_ANSWER,
      emergency: true,
    }));
});
describe("classify", () => {
  it.each([
    ["Is an N95 enough?", "mask"],
    ["Which air purifier?", "purifier"],
    ["Should I open the window?", "windows"],
    ["can I cook on a chulha", "cooking"],
    ["do tulsi plants help", "plants"],
    ["Can my son play cricket?", "outdoor"],
    ["what should we do today", "general"],
  ])("%s → %s", (q, intent) => expect(classify(q)).toBe(intent));
});
describe("answerOffline", () => {
  it("adapts outdoor advice to the level", () => {
    expect(answerOffline("can the kids play outside", ctx({ guidance: "ok", aqi: 60 })).answer).toMatch(
      /Yes/,
    );
    expect(answerOffline("can the kids play outside", ctx({ guidance: "limit" })).answer).toMatch(/midday/);
    expect(answerOffline("can the kids play outside", ctx({ guidance: "avoid" })).answer).toMatch(
      /stay indoors/,
    );
  });
  it("adapts window advice to the level", () => {
    expect(answerOffline("open windows?", ctx({ guidance: "ok" })).answer).toMatch(/Fine to ventilate/);
    expect(answerOffline("open windows?", ctx({ guidance: "limit" })).answer).toMatch(/ten minutes/);
    expect(answerOffline("open windows?", ctx({ guidance: "avoid" })).answer).toMatch(/closed/);
  });
  it("answers the fixed topics", () => {
    for (const q of ["which mask", "best purifier", "cooking tips", "do plants clean air"]) {
      const r = answerOffline(q, ctx());
      expect(r.emergency).toBe(false);
      expect(r.answer.length).toBeGreaterThan(40);
    }
  });
  it("falls back to the top steps, or a gentle default", () => {
    expect(answerOffline("what now", ctx()).answer).toContain("Wear an N95; Run a purifier; Shut windows");
    expect(answerOffline("what now", ctx({ top: [] })).answer).toBe(
      "Today’s AQI is 320. Check it each morning and adjust outdoor plans.",
    );
  });
  it("always returns a short non-empty answer (property)", () =>
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (q) => {
        const a = answerOffline(q, ctx()).answer;
        return a.length > 0 && a.length <= 700;
      }),
    ));
});

describe("answerOffline, topic by topic", () => {
  const say = (q: string, c = ctx()) => answerOffline(q, c).answer;
  it("gives the right advice for each fixed topic", () => {
    expect(say("which mask")).toContain("N95/FFP2");
    expect(say("best purifier")).toContain("HEPA purifier");
    expect(say("cooking tips")).toContain("LPG or induction");
    expect(say("do plants help")).toContain("Houseplants");
    expect(say("which mask")).not.toContain("Your best steps");
  });
  it("lists exactly the top three steps and no more", () => {
    const a = say("what now");
    expect(a).toContain("Wear an N95; Run a purifier; Shut windows.");
    expect(a).not.toContain("Extra");
  });
});
