import { expect, test } from "@playwright/test";

/** Regenerates the README screenshots: `npm run screenshots` (needs a build). Skipped in normal runs. */
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to regenerate docs/assets");

/** Illustrative winter-day forecast so the screenshots show the "best time outdoors" feature. */
const live = {
  cityId: "delhi",
  aqi: 350,
  category: "Very Poor",
  pm25: 185,
  pm10: 290,
  observedAt: "2026-11-17T07:00",
  hourly: Array.from({ length: 17 }, (_, i) => i + 7).map((hour) => ({
    hour,
    aqi: hour >= 12 && hour <= 15 ? 250 : hour >= 18 ? 380 : 340,
  })),
  source: "Open-Meteo (CAMS model) — an indicative estimate, not an official CPCB reading",
};

const shots = [
  { file: "desktop-light", scheme: "light", viewport: { width: 1280, height: 1000 } },
  { file: "desktop-dark", scheme: "dark", viewport: { width: 1280, height: 1000 } },
  { file: "mobile", scheme: "light", viewport: { width: 390, height: 844 } },
] as const;

for (const s of shots) {
  test(`screenshot ${s.file}`, async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: s.scheme,
      viewport: s.viewport,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.route(/\/api\/aqi\?city=delhi/, (route) => route.fulfill({ json: live }));
    await page.goto("/");
    await page.getByLabel("Babies under 2").fill("1");
    await page.getByRole("button", { name: "Get live AQI" }).click();
    await expect(page.getByRole("heading", { name: "Your family’s level today" })).toBeVisible();
    await page.screenshot({ path: `docs/assets/${s.file}.jpg`, type: "jpeg", quality: 80 });
    await context.close();
  });
}
