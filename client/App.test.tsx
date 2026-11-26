// @vitest-environment jsdom
import axe from "axe-core";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const HOURLY = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((hour) => ({
  hour,
  aqi: hour >= 12 && hour <= 14 ? 180 : 320,
}));
const reading = {
  cityId: "delhi",
  aqi: 300,
  category: "Poor",
  pm25: 120,
  pm10: 200,
  observedAt: "2026-11-17T08:00",
  hourly: HOURLY,
  source: "Open-Meteo test",
};
const res = (body: unknown, ok = true) => ({ ok, json: async () => body });
const stub = (handler: (url: string, init?: RequestInit) => unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => handler(String(url), init)),
  );
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const scenario = async (name: string) => {
  click(name);
  await screen.findByRole("heading", { name: "Your family’s level today" });
};
const actionsPanel = () =>
  within(
    screen
      .getByRole("heading", { name: "What to do, and what it changes" })
      .closest("section") as HTMLElement,
  );

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("getting started", () => {
  it("asks for today’s AQI before showing a plan", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Set today’s AQI to see your plan" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Your family’s level today" })).toBeNull();
  });
  it("shows a full, accessible plan from a quick scenario", async () => {
    const { container } = render(<App />);
    await scenario("Very Poor (350)");
    expect(screen.getByRole("heading", { name: "Your family’s level today" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "What to do, and what it changes" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Your low-emission day" })).toBeTruthy();
    expect(screen.getAllByText(/the WHO daily PM2.5 guideline/).length).toBeGreaterThan(0);
    const r = await axe.run(container, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
  it("accepts a typed AQI, clamps it and returns to the start when cleared", async () => {
    render(<App />);
    type(/enter today’s AQI/, "250");
    expect(await screen.findByRole("heading", { name: "Your family’s level today" })).toBeTruthy();
    type(/enter today’s AQI/, "999");
    expect((screen.getByLabelText(/enter today’s AQI/) as HTMLInputElement).value).toBe("500");
    type(/enter today’s AQI/, "");
    expect(screen.getByRole("heading", { name: "Set today’s AQI to see your plan" })).toBeTruthy();
  });
});
describe("a dynamic assistant", () => {
  it("raises the level and adds safety advice when a baby joins the household", async () => {
    render(<App />);
    await scenario("Moderate (150)");
    expect(screen.queryByText("Keep babies under 2 indoors — and never put a mask on them")).toBeNull();
    type("Babies under 2", "1");
    expect(screen.getByText("Keep babies under 2 indoors — and never put a mask on them")).toBeTruthy();
    expect(screen.getByText(/so treat today as Poor for your family/)).toBeTruthy();
  });
  it("changes recommendations with the household’s choices", async () => {
    render(<App />);
    await scenario("Very Poor (350)");
    expect(actionsPanel().getByText("Run a HEPA air purifier in the room you use most")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("HEPA purifier"));
    expect(actionsPanel().queryByText("Run a HEPA air purifier in the room you use most")).toBeNull();
    fireEvent.click(screen.getByLabelText("Car"));
    expect(screen.getByText(/Share rides or take the metro/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Wood, dung or coal"));
    expect(screen.getByText(/Cook on LPG or induction/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Someone has asthma, or a heart or lung condition"));
    expect(screen.getByText(/Set up one clean-air room/)).toBeTruthy();
  });
  it("filters actions by area and says when a group is empty", async () => {
    render(<App />);
    await scenario("Very Poor (350)");
    click("Sustainable");
    expect(screen.getByRole("button", { name: "Sustainable" }).getAttribute("aria-pressed")).toBe("true");
    expect(actionsPanel().getByText(/Never burn leaves/)).toBeTruthy();
    expect(actionsPanel().queryByText(/Wear a well-fitted N95/)).toBeNull();
    fireEvent.click(screen.getByLabelText("Work from home"));
    click("Commute");
    expect(screen.getByText("No actions in this group today.")).toBeTruthy();
    click("All");
    expect(actionsPanel().getByText(/Wear a well-fitted N95/)).toBeTruthy();
  });
  it("shows the impact of the top steps in numbers", async () => {
    render(<App />);
    await scenario("Severe (450)");
    expect(screen.getByRole("img", { name: /As you live today: about/ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /With your top steps: about/ })).toBeTruthy();
    expect(screen.getAllByText(/% PM2.5 intake/).length).toBeGreaterThan(0);
  });
  it("remembers the household in this browser only, and can forget it", async () => {
    const first = render(<App />);
    await scenario("Severe (450)");
    type("Babies under 2", "2");
    first.unmount();
    render(<App />);
    expect((screen.getByLabelText("Babies under 2") as HTMLInputElement).value).toBe("2");
    expect(await screen.findByRole("heading", { name: "Your family’s level today" })).toBeTruthy();
    click("Clear my saved details");
    expect(screen.getByRole("heading", { name: "Set today’s AQI to see your plan" })).toBeTruthy();
    expect(screen.getByText("Your saved details were cleared from this browser.")).toBeTruthy();
    expect((screen.getByLabelText("Babies under 2") as HTMLInputElement).value).toBe("0");
  });
  it("ignores corrupted saved data", async () => {
    localStorage.setItem("airwise.v1", "{bad");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Set today’s AQI to see your plan" })).toBeTruthy();
  });
});
describe("live air data", () => {
  it("loads a live reading and fills in today’s AQI", async () => {
    stub(() => res(reading));
    render(<App />);
    click("Get live AQI");
    await screen.findByText("Live air data loaded for Delhi: AQI 300 (Poor).");
    expect((screen.getByLabelText(/enter today’s AQI/) as HTMLInputElement).value).toBe("300");
    expect(screen.getByText(/Open-Meteo test/)).toBeTruthy();
  });
  it("explains a failure and leaves manual entry available", async () => {
    stub(() => res({ error: "Live air data is unavailable right now. Enter today’s AQI manually." }, false));
    render(<App />);
    click("Get live AQI");
    await screen.findByText(/Enter today’s AQI manually/);
    await scenario("Moderate (150)");
    expect(screen.getByRole("heading", { name: "Your family’s level today" })).toBeTruthy();
  });
  it("forgets the live reading when the city changes", async () => {
    stub(() => res(reading));
    render(<App />);
    click("Get live AQI");
    await screen.findByText(/Open-Meteo test/);
    type("City", "pune");
    expect(screen.queryByText(/Open-Meteo test/)).toBeNull();
  });
  it("shows n/a for a pollutant the provider did not report", async () => {
    stub(() => res({ ...reading, pm25: null, pm10: null }));
    render(<App />);
    click("Get live AQI");
    await screen.findByText(/PM2.5 n\/a µg\/m³, PM10 n\/a/);
  });
});
describe("asking questions", () => {
  const answer = (over = {}) => ({
    answer: "Keep the kids indoors today.",
    source: "ai",
    emergency: false,
    ...over,
  });
  it("shows an AI answer with its source", async () => {
    stub(() => res(answer()));
    render(<App />);
    await scenario("Very Poor (350)");
    click("Do I need a mask?");
    await screen.findByText("Keep the kids indoors today.");
    expect(screen.getByText(/AI answer, based only on today’s numbers/)).toBeTruthy();
    expect((screen.getByLabelText("Your question about today’s air") as HTMLInputElement).value).toBe(
      "Do I need a mask?",
    );
  });
  it("labels rule-based answers honestly, and works with the Enter key", async () => {
    stub(() => res(answer({ source: "rules" })));
    render(<App />);
    await scenario("Severe (450)");
    const box = screen.getByLabelText("Your question about today’s air");
    fireEvent.change(box, { target: { value: "windows?" } });
    fireEvent.keyDown(box, { key: "Tab" });
    fireEvent.keyDown(box, { key: "Enter" });
    await screen.findByText(/Rule-based answer \(AI not used\)/);
  });
  it("shows a possible emergency as an alert", async () => {
    stub(() => res(answer({ answer: "Call 112.", source: "rules", emergency: true })));
    render(<App />);
    await scenario("Severe (450)");
    type("Your question about today’s air", "my son has chest pain");
    click("Ask");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Call 112.");
    expect(screen.getByText("Possible emergency — please read the safety message.")).toBeTruthy();
  });
  it("asks for a question first and survives network failures", async () => {
    stub(() => {
      throw new Error("");
    });
    render(<App />);
    await scenario("Severe (450)");
    click("Ask");
    expect(screen.getByText("Type a question first.")).toBeTruthy();
    type("Your question about today’s air", "hello");
    click("Ask");
    await screen.findByText("Network error — please try again.");
  });
  it("cancels an older request when a newer one starts, without showing an error", async () => {
    const hang = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_ok, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
        ),
    );
    vi.stubGlobal("fetch", hang);
    render(<App />);
    await scenario("Severe (450)");
    const box = screen.getByLabelText("Your question about today’s air");
    fireEvent.change(box, { target: { value: "hello" } });
    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(hang).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/aborted|Network error/)).toBeNull();
  });
});
describe("AI briefing in other languages", () => {
  it("shows a Hindi briefing marked with its language", async () => {
    stub(() => res({ summary: "आज हवा बहुत खराब है।", language: "hi" }));
    render(<App />);
    await scenario("Very Poor (350)");
    type("Explain with AI in", "hi");
    click("Explain");
    const text = await screen.findByText("आज हवा बहुत खराब है।");
    expect(text.getAttribute("lang")).toBe("hi");
  });
  it("tells the family when the explainer is unavailable", async () => {
    stub(() =>
      res(
        { error: "The AI explainer is unavailable right now. The English summary is shown instead." },
        false,
      ),
    );
    render(<App />);
    await scenario("Very Poor (350)");
    click("Explain");
    await screen.findByText(/explainer is unavailable/);
  });
});

describe("location and today’s forecast", () => {
  const withGeo = (getCurrentPosition: unknown) =>
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
  const at = (latitude: number, longitude: number) => (ok: (p: unknown) => void) =>
    ok({ coords: { latitude, longitude } });
  afterEach(() => Reflect.deleteProperty(navigator, "geolocation"));

  it("picks the nearest city on the device and says nothing leaves it", async () => {
    withGeo(at(18.52, 73.85));
    render(<App />);
    click("Use my location");
    await screen.findByText(/Nearest listed city: Pune \(1 km away\)\. Your location stays on this device\./);
    expect((screen.getByLabelText("City") as HTMLSelectElement).value).toBe("pune");
  });
  it("asks the family to choose when no listed city is near", async () => {
    withGeo(at(0, 0));
    render(<App />);
    click("Use my location");
    await screen.findByText("No listed city within 150 km — please choose one from the list.");
  });
  it("is kind when permission is denied or location is unsupported", async () => {
    withGeo((_ok: unknown, fail: (e: unknown) => void) => fail({ code: 1 }));
    render(<App />);
    click("Use my location");
    await screen.findByText(/permission was denied/);
    Reflect.deleteProperty(navigator, "geolocation");
    click("Use my location");
    await screen.findByText(/Couldn’t get your location/);
  });
  it("shows the best and worst hours from the live forecast, and nothing for a typed AQI", async () => {
    stub(() => res(reading));
    render(<App />);
    click("Get live AQI");
    expect(
      await screen.findByText(/Best time outdoors today: 12 pm–2 pm \(AQI ≈ 180\)\. Worst: 8 am–10 am/),
    ).toBeTruthy();
    expect(screen.getByText("Tailored to your city today:")).toBeTruthy();
    type(/enter today’s AQI/, "250");
    await screen.findByRole("heading", { name: "Your low-emission day" });
    expect(screen.queryByText("Tailored to your city today:")).toBeNull();
  });
});
describe("community actions", () => {
  it("offers a community filter with actions for schools and neighbours", async () => {
    render(<App />);
    await scenario("Very Poor (350)");
    click("Community");
    expect(actionsPanel().getByText(/Ask your child’s school/)).toBeTruthy();
    expect(actionsPanel().getByText(/Share this plan with neighbours/)).toBeTruthy();
    expect(actionsPanel().queryByText(/Wear a well-fitted N95/)).toBeNull();
  });
});
describe("sharing and reading aloud", () => {
  const define = (name: string, value: unknown) =>
    Object.defineProperty(navigator, name, { value, configurable: true });
  afterEach(() => {
    Reflect.deleteProperty(navigator, "share");
    Reflect.deleteProperty(navigator, "clipboard");
    vi.unstubAllGlobals();
  });
  it("uses the phone share sheet when there is one", async () => {
    const share = vi.fn(async () => undefined);
    define("share", share);
    render(<App />);
    await scenario("Very Poor (350)");
    click("Share this plan");
    await screen.findByText("Shared.");
    expect(String((share.mock.calls[0] as unknown[])[0] && JSON.stringify(share.mock.calls[0]))).toContain(
      "AirWise — Delhi: AQI 350",
    );
  });
  it("copies the plan for WhatsApp otherwise, and handles failure", async () => {
    const writeText = vi.fn(async () => undefined);
    define("clipboard", { writeText });
    render(<App />);
    await scenario("Very Poor (350)");
    click("Share this plan");
    await screen.findByText(/Plan copied/);
    expect(String(writeText.mock.calls[0])).toContain("Make your own plan: ");
    define("clipboard", { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) });
    click("Share this plan");
    await screen.findByText(/Sharing was cancelled or isn’t available here/);
  });
  it("hides read-aloud when the browser has no speech support", async () => {
    render(<App />);
    await scenario("Very Poor (350)");
    expect(screen.queryByRole("button", { name: "Read aloud" })).toBeNull();
  });
  it("reads the briefing aloud in the right language and can stop", async () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        lang = "";
        onend: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    render(<App />);
    await scenario("Very Poor (350)");
    click("Read aloud");
    const first = speak.mock.calls[0]?.[0] as { text: string; lang: string; onend: () => void };
    expect(first.lang).toBe("en-IN");
    expect(first.text).toContain("Today’s AQI in Delhi is 350");
    expect(screen.getByRole("button", { name: "Stop reading" }).getAttribute("aria-pressed")).toBe("true");
    first.onend();
    await screen.findByRole("button", { name: "Read aloud" });
    click("Read aloud");
    click("Stop reading");
    expect(cancel).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("button", { name: "Read aloud" })).toBeTruthy();
  });
  it("reads a Hindi briefing with a Hindi voice, and stays hidden without utterances", async () => {
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn() });
    const hidden = render(<App />);
    await scenario("Very Poor (350)");
    expect(screen.queryByRole("button", { name: "Read aloud" })).toBeNull();
    hidden.unmount();
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        lang = "";
        onend = null;
        constructor(public text: string) {}
      },
    );
    stub(() => res({ summary: "आज हवा बहुत खराब है।", language: "hi" }));
    render(<App />);
    type("Explain with AI in", "hi");
    click("Explain");
    await screen.findByText("आज हवा बहुत खराब है।");
    click("Read aloud");
    expect((speak.mock.calls[0]?.[0] as { lang: string; text: string }).lang).toBe("hi-IN");
  });
});

describe("commute comparison", () => {
  const table = () => screen.getByRole("table", { name: /Same daily distance/ });
  it("compares every way of travelling and marks the current commute", async () => {
    render(<App />);
    await scenario("Very Poor (350)");
    expect(screen.getByRole("heading", { name: "How your commute choices compare" })).toBeTruthy();
    expect(within(table()).getAllByRole("row")).toHaveLength(6);
    expect(within(table()).getByText("your commute").closest("th")?.textContent).toContain("Two-wheeler");
  });
  it("explains when walking is too far, and disappears for people who work from home", async () => {
    render(<App />);
    await scenario("Very Poor (350)");
    fireEvent.click(screen.getByLabelText("Car"));
    type("Commute minutes per day (both ways)", "200");
    expect(within(table()).getByText("too far to walk")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Work from home"));
    expect(screen.queryByRole("heading", { name: "How your commute choices compare" })).toBeNull();
  });
});
describe("room-by-room air check", () => {
  it("tells a family what their room needs and how to build a cheap purifier", async () => {
    render(<App />);
    await scenario("Very Poor (350)");
    type("Floor area (m²)", "20");
    type("Ceiling height (cm)", "250");
    expect(screen.getByText(/You have no purifier yet/)).toBeTruthy();
    type("Purifier CADR (m³/h)", "100");
    expect(screen.getByText(/That is a little low/)).toBeTruthy();
    type("Purifier CADR (m³/h)", "300");
    expect(screen.getByText(/clear about 90% of smoke in ≈ \d+ minutes/)).toBeTruthy();
    type("Floor area (m²)", "0");
    expect(screen.getByText(/Enter your room’s floor area and ceiling height/)).toBeTruthy();
    expect(screen.getByText("How to build a DIY filter box (Corsi–Rosenthal)")).toBeTruthy();
    expect(screen.getByText(/four 20×20×1 in/)).toBeTruthy();
  });
});
