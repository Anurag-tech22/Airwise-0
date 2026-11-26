# Efficiency

AirWise is used on phones, on patchy networks, in the worst air days of the year, so it avoids work instead of optimising it.

## Where the resources go

| Decision                                                                               | Effect                                                                                                                                 |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| The decision engine runs **in the browser**                                            | Results update instantly on every tap with no network round trip, work offline, and the server does almost nothing per user            |
| **No charting library**; bars and tables are plain HTML/CSS                            | The whole app is **104 kB gzipped** JavaScript including React 19 and Zod 4, with the first-load budget (105 kB) enforced in the build |
| Server calls only where they add value                                                 | Live AQI (cached 15 minutes per city), the optional AI, and nothing else; household details never go to the server                     |
| Requests are **cancelled** when superseded and **time-boxed**                          | AI 10 s per attempt and 25 s overall, live air data 5 s, so a slow dependency never holds a connection                                 |
| Memoised analysis                                                                      | `useMemo` recomputes the plan only when the AQI, city or household changes                                                             |
| Static assets: gzip, immutable hashes, `no-cache` only for the HTML and service worker | Repeat visits download almost nothing; the PWA works offline                                                                           |
| Compiled server (`esbuild`), production dependencies only                              | Fast cold starts and a small container                                                                                                 |
| Cloud Run with scale-to-zero, concurrency 80, 512 MiB, max 3 instances                 | Pay for use; bounded cost                                                                                                              |
| One fixed outbound host, allow-listed cities                                           | No wasted or abusable calls                                                                                                            |

## Measured

| Measure                      | Result                                                                                                                    | How                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| First-load JavaScript        | 104 kB gzipped (budget 105 kB)                                                                                            | `npm run build && npx tsx scripts/check-size.ts`                     |
| Lighthouse (desktop, local)  | Performance 100 · LCP 0.4 s · TBT 0 ms · CLS 0                                                                            | see [QUALITY.md](QUALITY.md)                                         |
| Server throughput and memory | about 2,000 requests a second at a median of 3 ms (99th percentile 19 ms), 0 errors; memory 42 MB idle, 128 MB under load | `npx autocannon` against `POST /api/ask` (rules path), 1 CPU sandbox |

Benchmarks used 10 connections for 8 seconds on a small shared single-CPU sandbox and exclude the AI; real numbers on Cloud Run depend on region and instance size.
