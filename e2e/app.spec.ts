import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const AXE = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const reading = {
  cityId: "delhi",
  aqi: 300,
  category: "Poor",
  pm25: 120,
  pm10: 200,
  observedAt: "2026-11-17T08:00",
  hourly: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((hour) => ({
    hour,
    aqi: hour >= 12 && hour <= 14 ? 180 : 320,
  })),
  source: "Open-Meteo test",
};

async function withScenario(page: Page, scenario = "Very Poor (350)") {
  await page.goto("/");
  await page.getByRole("button", { name: scenario }).click();
  await expect(page.getByRole("heading", { name: "Your family’s level today" })).toBeVisible();
}

test("starts by asking for today’s AQI, then builds a personalised plan", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Set today’s AQI to see your plan" })).toBeVisible();
  await page.getByRole("button", { name: "Very Poor (350)" }).click();
  await expect(page.getByRole("heading", { name: "What to do, and what it changes" })).toBeVisible();
  await expect(page.getByRole("img", { name: /As you live today/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Wear a well-fitted N95/FFP2 for commutes and errands" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your low-emission day" })).toBeVisible();
});

test("recommendations react to the household", async ({ page }) => {
  await withScenario(page, "Moderate (150)");
  await expect(page.getByRole("heading", { name: /Keep babies under 2 indoors/ })).toHaveCount(0);
  await page.getByLabel("Babies under 2").fill("1");
  await expect(page.getByRole("heading", { name: /Keep babies under 2 indoors/ })).toBeVisible();
  await page.getByLabel("Wood, dung or coal").check();
  await expect(
    page.getByRole("heading", { name: "Cook on LPG or induction instead of wood, dung or coal" }),
  ).toBeVisible();
});

test("loads a live AQI reading when the provider answers", async ({ page }) => {
  await page.route(/\/api\/aqi\?city=delhi/, (route) => route.fulfill({ json: reading }));
  await page.goto("/");
  await page.getByRole("button", { name: "Get live AQI" }).click();
  await expect(page.getByText("Live air data loaded for Delhi: AQI 300 (Poor).")).toBeVisible();
  await expect(page.getByLabel(/enter today’s AQI/)).toHaveValue("300");
});

test("falls back gracefully when live data is unavailable", async ({ page }) => {
  await page.route(/\/api\/aqi\?city=delhi/, (route) =>
    route.fulfill({
      status: 502,
      json: { error: "Live air data is unavailable right now. Enter today’s AQI manually." },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Get live AQI" }).click();
  await expect(page.getByText(/Enter today’s AQI manually/)).toBeVisible();
  await page.getByLabel(/enter today’s AQI/).fill("280");
  await expect(page.getByRole("heading", { name: "Your family’s level today" })).toBeVisible();
});

test("answers questions with rules when no AI is configured, and says so", async ({ page }) => {
  await withScenario(page);
  await page.getByRole("button", { name: "Can my kids play outside today?" }).click();
  await expect(page.getByText(/stay indoors today/)).toBeVisible();
  await expect(page.getByText("Rule-based answer (AI not used).")).toBeVisible();
});

test("treats a possible emergency as an emergency", async ({ page }) => {
  await withScenario(page);
  await page.getByLabel("Your question about today’s air").fill("my child has chest pain");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "call 112" })).toBeVisible();
});

test("is honest when the AI explainer is unavailable", async ({ page }) => {
  await withScenario(page);
  await page.getByRole("button", { name: "Explain" }).click();
  await expect(page.getByText(/AI explainer is unavailable/)).toBeVisible();
});

test("remembers the household in this browser and can forget it", async ({ page }) => {
  await withScenario(page);
  await page.getByLabel("Babies under 2").fill("2");
  await page.reload();
  await expect(page.getByLabel("Babies under 2")).toHaveValue("2");
  await expect(page.getByRole("heading", { name: "Your family’s level today" })).toBeVisible();
  await page.getByRole("button", { name: "Clear my saved details" }).click();
  await expect(page.getByRole("heading", { name: "Set today’s AQI to see your plan" })).toBeVisible();
  await expect(page.getByLabel("Babies under 2")).toHaveValue("0");
});

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme, bypassCSP: true });
    test("has no WCAG 2.2 A/AA violations (real colour contrast)", async ({ page }) => {
      await withScenario(page, "Severe (450)");
      await page.addScriptTag({ content: AXE });
      const violations = await page.evaluate(async (tags) => {
        const axe = (
          window as unknown as {
            axe: { run: (c: Document, o: object) => Promise<{ violations: { id: string }[] }> };
          }
        ).axe;
        return (await axe.run(document, { runOnly: tags })).violations.map((v) => v.id);
      }, TAGS);
      expect(violations).toEqual([]);
    });
  });
}

test("is keyboard operable from the first Tab", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("City")).toBeFocused();
});

test("reflows at 320 px without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await withScenario(page, "Severe (450)");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
});

test("sends hardened headers in a real browser response", async ({ page }) => {
  const res = await page.request.get("/api/health");
  expect(res.headers()["content-security-policy"]).toContain("default-src 'self'");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["cache-control"]).toBe("no-store");
  expect(res.headers()["x-powered-by"]).toBeUndefined();
  expect(res.headers()["cross-origin-opener-policy"]).toBe("same-origin");
  expect(res.headers()["cross-origin-resource-policy"]).toBe("same-origin");
  expect(res.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(res.headers()["x-dns-prefetch-control"]).toBe("off");
});

test("keeps working offline after the first visit (PWA)", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "AirWise" })).toBeVisible();
  await page.getByRole("button", { name: "Very Poor (350)" }).click();
  await expect(page.getByRole("heading", { name: "Your family’s level today" })).toBeVisible();
});

test("runs with no console problems and no browser security or CSP issues", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "uses the Chrome DevTools Protocol");
  const client = await page.context().newCDPSession(page);
  const issues: string[] = [];
  const problems: string[] = [];
  client.on("Audits.issueAdded", (e) => issues.push(`${e.issue.code}: ${JSON.stringify(e.issue.details)}`));
  await client.send("Audits.enable");
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(e.message));
  await withScenario(page);
  await page.waitForTimeout(300);
  expect(issues).toEqual([]);
  expect(problems).toEqual([]);
});

test.describe("location, privately", () => {
  test.use({ geolocation: { latitude: 18.52, longitude: 73.85 }, permissions: ["geolocation"] });
  test("finds the nearest city on the device and sends no coordinates anywhere", async ({ page }) => {
    const urls: string[] = [];
    page.on("request", (r) => urls.push(r.url() + (r.postData() ?? "")));
    await page.goto("/");
    await page.getByRole("button", { name: "Use my location" }).click();
    await expect(page.getByText(/Nearest listed city: Pune/)).toBeVisible();
    await expect(page.getByLabel("City")).toHaveValue("pune");
    expect(urls.filter((u) => /18\.5|73\.8|latitude|longitude/i.test(u))).toEqual([]);
  });
});

test("tailors the day to the live forecast", async ({ page }) => {
  await page.route(/\/api\/aqi\?city=delhi/, (route) => route.fulfill({ json: reading }));
  await page.goto("/");
  await page.getByRole("button", { name: "Get live AQI" }).click();
  await expect(page.getByText(/Best time outdoors today: 12 pm–2 pm \(AQI ≈ 180\)/)).toBeVisible();
  await expect(page.getByText("Tailored to your city today:")).toBeVisible();
});

test("offers community actions", async ({ page }) => {
  await withScenario(page);
  await page.getByRole("button", { name: "Community" }).click();
  await expect(page.getByRole("heading", { name: /Ask your child’s school/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Share this plan with neighbours/ })).toBeVisible();
});

test.describe("sharing", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });
  test("copies a WhatsApp-ready summary without household details", async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true }),
    );
    await withScenario(page);
    await page.getByLabel("Babies under 2").fill("1");
    await page.getByRole("button", { name: "Share this plan" }).click();
    await expect(page.getByText(/Plan copied/)).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("AirWise — Delhi: AQI 350 (Very Poor). Family level: Severe.");
    expect(text).not.toMatch(/baby|infant|asthma/i);
  });
});

test("offers to read the plan aloud where the browser can", async ({ page }) => {
  await withScenario(page);
  await expect(page.getByRole("button", { name: "Read aloud" })).toBeVisible();
});

test("compares commute choices and checks a room, with strict CSP and no violations", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(m.text());
  });
  await withScenario(page);
  const table = page.getByRole("table", { name: /Same daily distance/ });
  await expect(table).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(6);
  await page.getByLabel("Floor area (m²)").fill("20");
  await page.getByLabel("Ceiling height (cm)").fill("250");
  await page.getByLabel("Purifier CADR (m³/h)").fill("300");
  await expect(page.getByText(/clear about 90% of smoke in ≈ \d+ minutes/)).toBeVisible();
  await page.getByText("How to build a DIY filter box (Corsi–Rosenthal)").click();
  await expect(page.getByText(/four 20×20×1 in/)).toBeVisible();
  expect(problems).toEqual([]);
});
