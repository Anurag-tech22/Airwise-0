import type { ZodType } from "zod";
import { z } from "zod";
import { AirReadingSchema, AskResponseSchema, BriefResponseSchema, type Lang } from "../shared/api";
import type { BriefContext } from "../shared/context";
import { DEFAULT_HOUSEHOLD, HouseholdSchema } from "../shared/household";

const KEY = "airwise.v1";
const SavedSchema = z.object({
  household: HouseholdSchema,
  cityId: z.string().max(30),
  aqi: z.number().min(0).max(500).nullable(),
});
export type Saved = z.infer<typeof SavedSchema>;
export const DEFAULT_SAVED: Saved = { household: DEFAULT_HOUSEHOLD, cityId: "delhi", aqi: null };

/** Household details live only in this browser (localStorage) and are re-validated on every load. */
export function loadSaved(): Saved {
  try {
    const r = SavedSchema.safeParse(JSON.parse(localStorage.getItem(KEY) ?? "null"));
    return r.success ? r.data : DEFAULT_SAVED;
  } catch {
    return DEFAULT_SAVED;
  }
}
export function saveSaved(saved: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* storage unavailable */
  }
}
export function clearSaved() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Fetches JSON and returns it validated; throws a user-presentable Error otherwise. */
async function call<T>(url: string, schema: ZodType<T>, init: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Request failed");
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error("Unexpected response from the server.");
  return parsed.data;
}
const post = (body: unknown, signal: AbortSignal): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  signal,
});

export const fetchAir = (cityId: string, signal: AbortSignal) =>
  call(`/api/aqi?city=${encodeURIComponent(cityId)}`, AirReadingSchema, { signal });
export const postBrief = (context: BriefContext, language: Lang, signal: AbortSignal) =>
  call("/api/brief", BriefResponseSchema, post({ context, language }, signal));
export const postAsk = (context: BriefContext, question: string, signal: AbortSignal) =>
  call("/api/ask", AskResponseSchema, post({ context, question }, signal));

/** The device's position, requested only when the family taps "Use my location". It never leaves the browser. */
export const currentPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, maximumAge: 600_000 });
  });
export const geoMessage = (e: unknown) =>
  (e as { code?: number }).code === 1
    ? "Location permission was denied — please choose your city from the list."
    : "Couldn’t get your location — please choose your city from the list.";
