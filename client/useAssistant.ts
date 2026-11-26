import { useEffect, useMemo, useRef, useState } from "react";
import { analyse } from "../shared/analysis";
import type { AirReading, AskResponse, Lang } from "../shared/api";
import { cityName } from "../shared/cities";
import { outdoorWindows } from "../shared/windows";
import type { Household } from "../shared/household";
import { locate } from "./locate";
import { clearSaved, DEFAULT_SAVED, fetchAir, loadSaved, postAsk, postBrief, saveSaved } from "./lib";

type Busy = "air" | "brief" | "ask" | null;

/** Runs one server request at a time: a newer request aborts the older one, and only the latest clears `busy`. */
function useRunner(setMsg: (message: string) => void) {
  const [busy, setBusy] = useState<Busy>(null);
  const inflight = useRef<AbortController | null>(null);
  async function run<T>(
    kind: Exclude<Busy, null>,
    work: (signal: AbortSignal) => Promise<T>,
  ): Promise<T | null> {
    inflight.current?.abort();
    const controller = (inflight.current = new AbortController());
    setBusy(kind);
    try {
      return await work(controller.signal);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMsg((e as Error).message || "Network error — please try again.");
      }
      return null;
    } finally {
      if (inflight.current === controller) {
        setBusy(null);
      }
    }
  }
  return { busy, run };
}

/** All assistant state and server calls, so components stay purely presentational. */
export function useAssistant() {
  const [saved, setSaved] = useState(loadSaved);
  const [reading, setReading] = useState<AirReading | null>(null);
  const [msg, setMsg] = useState("");
  const [brief, setBrief] = useState<{ text: string; language: Lang } | null>(null);
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const { busy, run } = useRunner(setMsg);
  const { household, cityId, aqi } = saved;

  useEffect(() => saveSaved(saved), [saved]);
  const analysis = useMemo(
    () => (aqi === null ? null : analyse({ ...household, cityId, aqi })),
    [household, cityId, aqi],
  );
  const windows = useMemo(
    () => (reading ? outdoorWindows(reading.hourly, Number(reading.observedAt.slice(11, 13))) : null),
    [reading],
  );
  // Briefing and questions are only reachable once an analysis exists, so the context is never missing.
  const context = () => (analysis as NonNullable<typeof analysis>).context;

  const setAqi = (value: number | null) => {
    setSaved((s) => ({ ...s, aqi: value }));
    setReading(null);
    setBrief(null);
  };
  const setCity = (id: string) => {
    setSaved((s) => ({ ...s, cityId: id }));
    setReading(null);
  };
  const setHousehold = (patch: Partial<Household>) =>
    setSaved((s) => ({ ...s, household: { ...s.household, ...patch } }));

  async function loadLive() {
    setMsg("Fetching live air data…");
    const r = await run("air", (signal) => fetchAir(cityId, signal));
    if (r) {
      setSaved((s) => ({ ...s, aqi: r.aqi }));
      setReading(r);
      setBrief(null);
      setMsg(`Live air data loaded for ${cityName(r.cityId)}: AQI ${r.aqi} (${r.category}).`);
    }
  }
  async function explain(language: Lang) {
    setMsg("Asking the AI explainer…");
    const r = await run("brief", (signal) => postBrief(context(), language, signal));
    if (r) {
      setBrief({ text: r.summary, language: r.language });
      setMsg("AI briefing ready.");
    }
  }
  async function ask(question: string) {
    if (!question.trim()) {
      setMsg("Type a question first.");
      return;
    }
    setMsg("Thinking…");
    const r = await run("ask", (signal) => postAsk(context(), question, signal));
    if (r) {
      setAnswer(r);
      setMsg(r.emergency ? "Possible emergency — please read the safety message." : "Answer ready.");
    }
  }
  function reset() {
    clearSaved();
    setSaved(DEFAULT_SAVED);
    setReading(null);
    setBrief(null);
    setAnswer(null);
    setMsg("Your saved details were cleared from this browser.");
  }

  return {
    household,
    cityId,
    aqi,
    reading,
    windows,
    analysis,
    msg,
    busy,
    brief,
    answer,
    setHousehold,
    setCity,
    locate: () => locate(setCity, setMsg),
    setAqi,
    loadLive,
    explain,
    ask,
    reset,
  };
}
