# API reference

Base path: `/api`. Bodies are JSON and unknown fields are rejected. Errors look like `{ "error": "message" }` and never include stack traces. Limits: 30 requests per minute per client (`429`), 20 kB bodies (`413`). Every response carries `X-Request-Id` and `Cache-Control: no-store`.

| Method | Path                 | Purpose                                                         | Success                           | Errors                                         |
| ------ | -------------------- | --------------------------------------------------------------- | --------------------------------- | ---------------------------------------------- |
| GET    | `/api/health`        | Liveness and active AI provider (`vertex`, `gemini`, `offline`) | `200 {ok, ai}`                    | `429`                                          |
| GET    | `/api/health/ai`     | Deep check: does the model really answer? (cached 60 s)         | `200 {ok, ai, working, ms}`       | `429`                                          |
| GET    | `/api/aqi?city=<id>` | Live indicative AQI for a listed city                           | `200 AirReading`                  | `400`, `404` unknown city, `502` provider down |
| POST   | `/api/brief`         | AI briefing in English, Hindi or Marathi                        | `200 {summary, language}`         | `400`, `503` AI unavailable                    |
| POST   | `/api/ask`           | Answer a question about today's air                             | `200 {answer, source, emergency}` | `400`, `413`                                   |

## `GET /api/aqi`

`city` must be one of the ids in `shared/cities.ts` (for example `delhi`, `pune`). Anything else is rejected before any outbound request, so a caller can never steer where the server connects. `hourly` lists today's forecast hours (city local time) as indicative AQI values, used for the "best time outdoors" window.

```bash
curl -s "localhost:8787/api/aqi?city=delhi"
# {"cityId":"delhi","aqi":300,"category":"Poor","pm25":120,"pm10":200,"observedAt":"2026-11-17T08:00","hourly":[{"hour":8,"aqi":310},{"hour":9,"aqi":290}],"source":"Open-Meteo (CAMS model) — an indicative estimate, not an official CPCB reading"}
```

## `POST /api/ask` and `POST /api/brief`

Both take a `context` that the browser builds from its own analysis:

| Field               | Type     | Rules                                      |
| ------------------- | -------- | ------------------------------------------ |
| `cityName`          | string   | 1–40 characters                            |
| `aqi`               | number   | 0–500                                      |
| `base`, `effective` | string   | category labels, ≤ 20 characters           |
| `guidance`          | string   | `ok`, `limit` or `avoid`                   |
| `vulnerable`        | string[] | up to 4 items, ≤ 60 characters each        |
| `top`               | string[] | up to 5 step titles, ≤ 140 characters each |

`/api/ask` adds `question` (1–300 characters); `/api/brief` adds `language` (`en`, `hi`, `mr`).

`source` in the `ask` response is `"ai"` or `"rules"`. A possible medical emergency returns `{emergency: true, source: "rules"}` and the AI is never called.
