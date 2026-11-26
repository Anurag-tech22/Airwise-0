import { z } from "zod";
import { BriefContextSchema } from "./context";

export const LangSchema = z.enum(["en", "hi", "mr"]);
export type Lang = z.infer<typeof LangSchema>;
export const LANG_NAMES: Record<Lang, string> = { en: "English", hi: "Hindi", mr: "Marathi" };

export const AirReadingSchema = z.object({
  cityId: z.string(),
  aqi: z.number().min(0).max(500),
  category: z.string(),
  pm25: z.number().nullable(),
  pm10: z.number().nullable(),
  observedAt: z.string(),
  /** Today's forecast hours (local time) as indicative AQI values. */
  hourly: z
    .array(z.object({ hour: z.number().int().min(0).max(23), aqi: z.number().min(0).max(500) }))
    .max(24),
  source: z.string(),
});
export type AirReading = z.infer<typeof AirReadingSchema>;

export const BriefRequestSchema = z.object({ context: BriefContextSchema, language: LangSchema }).strict();
export const BriefResponseSchema = z.object({ summary: z.string().max(800), language: LangSchema });
export const AskRequestSchema = z
  .object({ context: BriefContextSchema, question: z.string().trim().min(1).max(300) })
  .strict();
export const AskResponseSchema = z.object({
  answer: z.string().max(800),
  source: z.enum(["ai", "rules"]),
  emergency: z.boolean(),
});
export type AskResponse = z.infer<typeof AskResponseSchema>;
