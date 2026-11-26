# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.2.0]

### Added

- **Room-by-room air check:** the CADR a room needs for four air changes an hour, what a purifier delivers, minutes to clear 90% of smoke, and DIY Corsi–Rosenthal build steps.
- **Commute comparison table:** time, PM2.5 breathed in and weekly CO₂e for every way of travelling over the same daily distance, consistent with the exposure model.
- Mutation testing (Stryker) of the decision engine (98.86%, all survivors equivalent), a throughput benchmark, and evidence documents for every evaluation area (`CODE_QUALITY`, `TESTING`, `EFFICIENCY`, `PROBLEM_ALIGNMENT`).
- README restructured around the required submission sections: chosen vertical, approach and logic, how the solution works, assumptions made.
- OWASP Top 10 mapping in `SECURITY.md`.

### Changed

- **Strict Content-Security-Policy:** no `unsafe-inline` for styles, no `eval`, `frame-ancestors 'none'`, `connect-src 'self'`; zero violations in a real browser.
- The bundle-size budget script is now TypeScript (`scripts/check-size.ts`).

## [1.1.0]

### Added

- **Location-aware routines:** "Use my location" resolves the nearest listed city entirely in the browser (coordinates are never sent or stored), and the live hourly forecast shows the best and worst two hours outdoors today.
- **Community actions** (school and neighbours), a **Share this plan** button (share sheet or copy for WhatsApp) and **Read aloud** for the briefing in English, Hindi and Marathi.
- `Permissions-Policy` now allows geolocation for the app's own origin only.
- 275 unit tests at 100% coverage and 40 real-browser tests, including one that proves no request carries the device's coordinates.

## [1.0.0]

### Added

- Urban air-quality assistant for families in winter smog: India's CPCB AQI categories, a household-aware family level, a transparent exposure model, and ranked actions that each state their measured impact on the family's daily PM2.5 intake.
- Live indicative AQI for 21 Indian cities (Open-Meteo) with manual entry and quick scenarios as fallback.
- Low-emission day plan, indoor-air hacks (HEPA, DIY Corsi–Rosenthal box, windows, cooking), sustainable alternatives with weekly CO₂e savings, and myths versus facts.
- Ask AirWise: grounded Q&A with rule-based fallback, emergency detection before any AI call, and Hindi and Marathi AI briefings.
- Gemini on Vertex AI with no API key, one-command Google Cloud Run deployment, structured Cloud Logging output, installable offline PWA.
- 243 tests at 100% coverage, 30 real-browser tests, axe and contrast checks for light and dark themes, bundle budget, CI, CodeQL and Dependabot.
