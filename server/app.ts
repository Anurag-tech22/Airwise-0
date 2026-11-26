import cors from "cors";
import express, { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { ZodError, z } from "zod";
import { AskRequestSchema, BriefRequestSchema } from "../shared/api";
import { answerOffline } from "../shared/ask";
import { cityById } from "../shared/cities";
import type { BriefContext } from "../shared/context";
import type { Ai } from "./ai";
import type { AirProvider } from "./aqiProvider";
import { log } from "./log";

export interface Deps {
  ai: Ai;
  air: AirProvider;
}
interface Options {
  limit?: number;
  origin?: string;
  trustProxy?: boolean;
  provider?: string;
}

const CityQuery = z.object({ city: z.string().max(30) });
const PROBE: BriefContext = {
  cityName: "Delhi",
  aqi: 150,
  base: "Moderate",
  effective: "Moderate",
  guidance: "limit",
  vulnerable: [],
  top: [],
};
const AIR_DOWN = "Live air data is unavailable right now. Enter today’s AQI manually.";

function apiRouter({ ai, air }: Deps, provider: string): Router {
  const router = Router();
  let probe: { at: number; body: object } | undefined;
  router.get("/health", (_req, res) => res.json({ ok: true, ai: provider }));
  /** Deep check: proves the model actually answers, not just that it is configured. Cached for 60 s to cap cost. */
  router.get("/health/ai", async (_req, res) => {
    if (!probe || Date.now() - probe.at > 60_000) {
      const started = Date.now();
      const text = await ai.brief(PROBE, "en");
      probe = {
        at: Date.now(),
        body: { ok: true, ai: provider, working: text !== null, ms: Date.now() - started },
      };
    }
    res.json(probe.body);
  });
  router.get("/aqi", async (req, res) => {
    const { city } = CityQuery.parse(req.query);
    if (!cityById(city)) {
      res.status(404).json({ error: "Unknown city." });
      return;
    }
    try {
      res.json(await air.forCity(city));
    } catch (e) {
      log(
        "WARNING",
        "live air data failed",
        { city, err: String(e).slice(0, 160) },
        req.header("x-cloud-trace-context"),
      );
      res.status(502).json({ error: AIR_DOWN });
    }
  });
  router.post("/brief", async (req, res) => {
    const { context, language } = BriefRequestSchema.parse(req.body);
    const summary = await ai.brief(context, language);
    if (summary === null) {
      res
        .status(503)
        .json({ error: "The AI explainer is unavailable right now. The English summary is shown instead." });
      return;
    }
    res.json({ summary, language });
  });
  router.post("/ask", async (req, res) => {
    const { context, question } = AskRequestSchema.parse(req.body);
    const rules = answerOffline(question, context);
    if (rules.emergency) {
      res.json({ answer: rules.answer, source: "rules", emergency: true });
      return;
    }
    const text = await ai.ask(context, question);
    res.json(
      text === null
        ? { answer: rules.answer, source: "rules", emergency: false }
        : { answer: text, source: "ai", emergency: false },
    );
  });
  router.use((_req, res) => res.status(404).json({ error: "Not found." }));
  return router;
}

export function createApp(deps: Deps, opts: Options = {}) {
  const app = express();
  if (opts.trustProxy) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // No 'unsafe-inline': React sets styles through the CSSOM, which CSP allows.
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          manifestSrc: ["'self'"],
          workerSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
    }),
  );
  app.use((_req, res, next) => {
    res.locals.id = randomUUID();
    res.setHeader("X-Request-Id", res.locals.id as string);
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self), interest-cohort=()");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  app.use(cors({ origin: opts.origin ?? false }));
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: opts.limit ?? 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Too many requests — slow down." },
    }),
  );
  app.use(express.json({ limit: "20kb" }));
  app.use("/api", apiRouter(deps, opts.provider ?? "offline"));
  // Express identifies error handlers by their 4-argument signature.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: err.issues[0].message });
      return;
    }
    const status = (err as { status?: number }).status;
    log(
      (status ?? 500) >= 500 ? "ERROR" : "WARNING",
      "request failed",
      { requestId: res.locals.id, status: status ?? 500, err: String(err).slice(0, 200) },
      req.header("x-cloud-trace-context"),
    );
    res
      .status(status && status < 500 ? status : 500)
      .json({ error: status && status < 500 ? "Bad request." : "Something went wrong." });
  });
  return app;
}
