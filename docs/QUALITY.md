# Quality evidence

Everything below is reproducible with the command shown. Numbers are from the production build.

| Area                                     | Result                                                                                                       | How to reproduce                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Unit, API, component and contract tests  | 313 passing                                                                                                  | `npm test`                                            |
| Coverage                                 | 100% statements, branches, functions, lines (the build fails below 100%)                                     | `npm run coverage`                                    |
| Real-browser end-to-end                  | 42 passing (21 scenarios on desktop and a Pixel 5 profile)                                                   | `npx playwright install chromium && npm run test:e2e` |
| WCAG 2.2 A/AA (axe-core, real contrast)  | 0 violations, light and dark themes                                                                          | `npm run test:e2e`                                    |
| Lighthouse (desktop, unthrottled, local) | Performance 100 · Accessibility 100 · Best Practices 100 · SEO 100; LCP about 0.4 s, TBT 0 ms, CLS 0         | see below                                             |
| Browser console and CSP                  | 0 errors, 0 warnings, 0 inspector issues                                                                     | `npm run test:e2e`                                    |
| JavaScript size                          | about 104 kB gzipped (first-load budget 105 kB, enforced)                                                    | `npm run build && node scripts/check-size.mjs`        |
| Dependency audit (production)            | 0 vulnerabilities                                                                                            | `npm audit --omit=dev`                                |
| Static analysis                          | Strict TypeScript; ESLint with accessibility rules, complexity ≤ 12, functions ≤ 90 lines, files ≤ 260 lines | `npm run lint && npm run typecheck`                   |
| Supply chain                             | GitHub Actions pinned to commit SHAs, Dependabot, CodeQL                                                     | `.github/`                                            |

## Reproducing the Lighthouse run

```bash
npm run build && npm start &
npx lighthouse http://127.0.0.1:8787/ --only-categories=performance,accessibility,best-practices,seo \
  --throttling-method=provided --chrome-flags="--headless"
```

Scores were measured on a local server without network throttling and were identical across three consecutive runs (a very first cold-start run in the build sandbox once scored lower, so run it twice). Numbers on Cloud Run vary with distance and cold starts; use `MIN_INSTANCES=1` while testing.

## Known limits

- Gemini and Vertex AI are tested with mocks; run the app once with real credentials before relying on them.
- Dev-tooling advisory: `picomatch` (a build-time glob matcher used by Vite and Vitest) has an open ReDoS advisory with no patched release upstream. It only parses our own config patterns, is never shipped, and production dependencies have 0 advisories.
