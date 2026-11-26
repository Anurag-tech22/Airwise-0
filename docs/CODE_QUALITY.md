# Code quality

AirWise is organised so a new reader can find any behaviour in one place, change it safely, and prove the change with a test.

## Structure

| Layer           | Folder             | Rule                                                                                                      | Depends on |
| --------------- | ------------------ | --------------------------------------------------------------------------------------------------------- | ---------- |
| Decision engine | `shared/`          | Pure functions and Zod schemas only: no I/O, no framework, no clock except where a parameter is passed in | nothing    |
| Server          | `server/`          | Thin adapters: HTTP routes, AI providers, the live-air provider, config, logging                          | `shared/`  |
| Client          | `client/`          | `useAssistant.ts` owns state and server calls; `components/` has one small file per section               | `shared/`  |
| Quality         | `e2e/`, `scripts/` | Real-browser tests, the screenshot generator, the bundle budget                                           | everything |

Dependencies point one way (`shared` ← `server`, `client`), so the engine can be tested, reused and reasoned about without a browser or a server.

## Conventions

- **Strict TypeScript** (`strict`), no explicit `any` anywhere, no `@ts-ignore`. The only lint suppression is Express's required four-argument error-handler signature, commented in place.
- **One schema per concept** (Zod): the same validators protect the server, the browser's storage and the AI replies.
- **Small units, enforced:** ESLint fails the build for cyclomatic complexity above 12, functions above 90 lines, files above 260 lines, nesting above 3 levels, and more than 5 parameters.
- **Readable names and comments that explain why**, with JSDoc on exported functions (see `shared/risk.ts`, `shared/exposure.ts`, `shared/iaq.ts`).
- **Formatting is automatic:** Prettier on every commit in CI, plus ESLint with `jsx-a11y`.
- **Data apart from logic:** the 20-action catalogue lives in `shared/catalog.ts`; the ranking logic lives in `shared/actions.ts`; model constants live in one `MODEL` object.

## Measured

| Metric                              | Value                                                            |
| ----------------------------------- | ---------------------------------------------------------------- |
| TypeScript source (non-blank lines) | 2,587 across 42 files (shared 1,023 · client 1,095 · server 395) |
| Test code                           | 2,480 lines: 0.96 lines of test per line of source               |
| Largest source file                 | 231 lines (limit 260)                                            |
| Explicit `any` / `@ts-ignore`       | 0 / 0                                                            |
| Lint suppressions                   | 1, with a reason                                                 |

## Verify

```bash
npm run format:check && npm run lint && npm run typecheck
```
