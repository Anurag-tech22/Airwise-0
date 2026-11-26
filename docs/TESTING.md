# Testing

The aim is not a coverage number but confidence that the _behaviour_ is right: the maths, the safety rules, the API contract, and what a family actually sees in a real browser.

| Layer                    | Tooling                                     | What it proves                                                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                     | Vitest                                      | Every rule of the engine: CPCB breakpoints, family level, exposure model, actions, day plan, forecast windows, room check, commute table, emergency detection                                                                                 |
| Property-based           | fast-check                                  | Invariants hold for thousands of random households: AQI is monotonic, exposure grows with AQI, applying the recommended steps never makes things worse, shares never leak household details, the commute table agrees with the exposure model |
| API                      | Supertest                                   | Every route and failure path: validation, 404/413/429/502/503, security headers, CORS, rate limit, emergency short-circuit, no stack traces                                                                                                   |
| Provider and AI adapters | Vitest with mocks                           | Live-data parsing and hourly forecast, caching, time-outs, SSRF refusal, retries, prompt-injection fencing, Vertex and Gemini adapters                                                                                                        |
| Component and flow       | Testing Library + axe-core                  | Whole user journeys in jsdom: scenarios, household changes, filters, location, sharing, read-aloud, error and offline paths                                                                                                                   |
| Contract                 | Real React app against the real Express app | A mismatch between the UI and the API fails the build                                                                                                                                                                                         |
| Contrast                 | Reads the shipped CSS                       | WCAG contrast for all text pairs and all six AQI colours, light and dark                                                                                                                                                                      |
| **Real browser**         | Playwright (desktop and a Pixel 5 profile)  | The built app: scenarios, forecast windows, location privacy (no coordinates in any request), axe WCAG 2.2 with true contrast in both themes, keyboard order, 320 px reflow, offline PWA, strict-CSP with zero violations                     |
| **Mutation**             | Stryker                                     | The tests actually catch bugs: **98.9%** of 528 deliberate code changes to the decision engine are detected                                                                                                                                   |

## Enforced

`npm run coverage` fails the build below **100% of statements, branches, functions and lines**, over `shared/`, `server/` and `client/`. CI runs it on every push and pull request.

## Determinism

No test touches the network: the live-air provider and the AI are replaced by fakes or mocks, time-dependent code uses fake timers, and browser tests mock `/api/aqi` with Playwright routes. The same suite passes offline.

## Run

```bash
npm test                      # unit, API, component, contract, contrast
npm run coverage              # the same, with 100% thresholds enforced
npx playwright install chromium && npm run test:e2e
npx stryker run               # mutation testing (see below)
```

## Mutation testing

`stryker.config.json` mutates the decision engine (`shared/`, excluding static data) and re-runs the tests for every mutant. A mutant that survives means a behaviour change no test noticed. Stryker is not a project dependency (install with `npm i --no-save @stryker-mutator/core @stryker-mutator/vitest-runner`) so it never ships.

**Result:** 98.86% (521 mutants killed, 1 timed out, 6 survived, 0 uncovered) over all 17 non-static files of `shared/`.

What it found and what changed: the first full run scored lower on the exposure model, the day plan, the summary and the action ranking, because those tests checked _relationships_ ("more purifier means less exposure") but not exact values, wording or order. I added hand-calculated golden tests (the exposure model is verified against a worked example done by hand: 4,094.75 µg for the reference family), exact-wording assertions, boundary cases (for example a window that starts at 8 pm, or an action that helps by exactly 1%) and a pinned ranking for a reference family. A rarely-hit sort tie-breaker was removed because JavaScript's sort is already stable.

The 6 survivors are **equivalent mutants**: changing the code cannot change behaviour.

| Mutant                                                                    | Why it is equivalent                                                                                           |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `c <= 0` → `c < 0` and `c <= hi` → `c < hi` in the CPCB interpolation (2) | At an exact breakpoint the two adjacent bands give the same index, because the formula is continuous           |
| `items.join("")` with another separator in `listJoin`                     | A separator is invisible when there are fewer than two items                                                   |
| `if (def.group) used.add(...)` always true                                | It only adds `undefined`, which is never looked up                                                             |
| `cookH * cookC * adultLight` → `/`                                        | The adult light-activity breathing rate is exactly 1                                                           |
| `?? -1` → `?? +1` in the ranking comparator                               | Only matters for a modelled 0% action placed after a habit in the catalogue; no catalogue entry has that shape |
