import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ gemini: vi.fn(), vertex: vi.fn(), opts: [] as unknown[] }));
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: h.gemini };
    }
  },
}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: h.vertex };
    constructor(o: unknown) {
      h.opts.push(o);
    }
  },
}));
import type { BriefContext } from "../shared/context";
import { geminiAi, vertexAi } from "./ai";

const ctx: BriefContext = {
  cityName: "Pune",
  aqi: 150,
  base: "Moderate",
  effective: "Poor",
  guidance: "limit",
  vulnerable: [],
  top: [],
};
beforeEach(() => {
  h.gemini.mockReset();
  h.vertex.mockReset();
  h.opts.length = 0;
});

describe("provider adapters", () => {
  it("Gemini API: calls the model and returns validated text", async () => {
    h.gemini.mockResolvedValue({ response: { text: () => '{"text":"Hello"}' } });
    expect(await geminiAi("key-123456789").brief(ctx, "en")).toBe("Hello");
  });
  it("Vertex AI: authenticates by project and location, not a key, and asks for JSON", async () => {
    h.vertex.mockResolvedValue({ text: '{"text":"Namaste"}' });
    expect(await vertexAi("my-proj", "us-central1", "gemini-x").ask(ctx, "ok?")).toBe("Namaste");
    expect(h.opts[0]).toEqual({ vertexai: true, project: "my-proj", location: "us-central1" });
    expect(h.vertex.mock.calls[0]?.[0]).toMatchObject({
      model: "gemini-x",
      config: { responseMimeType: "application/json" },
    });
  });
  it("Vertex AI: treats an empty reply as unavailable", async () => {
    h.vertex.mockResolvedValue({ text: undefined });
    expect(await vertexAi("p", "l").brief(ctx, "en")).toBeNull();
  });
});
