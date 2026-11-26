import { useState } from "react";
import type { AskResponse, Lang } from "../../shared/api";
import { MYTHS } from "../../shared/myths";
import { ReadAloud, ShareButton } from "./Tools";

const SUGGESTIONS = [
  "Can my kids play outside today?",
  "Do I need a mask?",
  "Should I open the windows?",
  "Is a purifier worth it?",
];
const LANGS = [
  ["en", "English"],
  ["hi", "हिन्दी"],
  ["mr", "मराठी"],
] as const;

interface ExplainerProps {
  summary: string;
  shareText: string;
  busy: boolean;
  brief: { text: string; language: Lang } | null;
  onExplain: (language: Lang) => void;
}
/** The rules-based briefing, plus an optional AI version in Hindi or Marathi, read-aloud and sharing. */
export function Explainer({ summary, shareText, busy, brief, onExplain }: ExplainerProps) {
  const [lang, setLang] = useState<Lang>("en");
  return (
    <section className="card" aria-labelledby="h-sum">
      <h2 id="h-sum">Today in plain words</h2>
      <p>{summary}</p>
      <div className="row">
        <label htmlFor="lang">Explain with AI in</label>
        <select id="lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
          {LANGS.map(([code, label]) => (
            <option key={code} value={code} lang={code}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className="ghost" disabled={busy} onClick={() => onExplain(lang)}>
          Explain
        </button>
      </div>
      {brief && (
        <p className="answer" lang={brief.language}>
          {brief.text}
        </p>
      )}
      <div className="row">
        <ReadAloud text={brief ? brief.text : summary} lang={brief ? brief.language : "en"} />
        <ShareButton text={shareText} />
      </div>
    </section>
  );
}

interface AskProps {
  busy: boolean;
  answer: AskResponse | null;
  onAsk: (question: string) => void;
}
const SOURCE_NOTE = {
  ai: "AI answer, based only on today’s numbers above.",
  rules: "Rule-based answer (AI not used).",
} as const;

export function AskBox({ busy, answer, onAsk }: AskProps) {
  const [q, setQ] = useState("");
  return (
    <section className="card" aria-labelledby="h-ask">
      <h2 id="h-ask">Ask AirWise</h2>
      <label htmlFor="q">Your question about today’s air</label>
      <input
        id="q"
        value={q}
        maxLength={300}
        autoComplete="off"
        placeholder="e.g. Can my kids play outside today?"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onAsk(q);
        }}
      />
      <div className="row">
        <button type="button" disabled={busy} onClick={() => onAsk(q)}>
          Ask
        </button>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="chip"
            onClick={() => {
              setQ(s);
              onAsk(s);
            }}
          >
            {s}
          </button>
        ))}
      </div>
      {answer && (
        <div className="answer" role={answer.emergency ? "alert" : "status"}>
          <p>{answer.answer}</p>
          <p className="hint">{answer.emergency ? "Safety message" : SOURCE_NOTE[answer.source]}</p>
        </div>
      )}
    </section>
  );
}

export function Myths() {
  return (
    <section className="card" aria-labelledby="h-myth">
      <h2 id="h-myth">Myths and facts</h2>
      {MYTHS.map((m) => (
        <details key={m.myth}>
          <summary>{m.myth}</summary>
          <p>{m.fact}</p>
        </details>
      ))}
    </section>
  );
}

export function About({ onReset }: { onReset: () => void }) {
  return (
    <footer className="card" aria-labelledby="h-about">
      <h2 id="h-about">About these numbers</h2>
      <ul>
        <li>
          AirWise gives general guidance, not medical advice. If someone struggles to breathe, call 112 or get
          care.
        </li>
        <li>Categories follow India’s CPCB AQI. The WHO 2021 24-hour PM2.5 guideline is 15 µg/m³.</li>
        <li>
          Live data comes from Open-Meteo (CAMS model): an estimate. For official readings see CPCB or SAFAR.
        </li>
        <li>
          Impact numbers come from an exposure model with rounded, published assumptions (see docs/MODEL.md).
        </li>
        <li>
          Privacy: no accounts. Household details stay in this browser; only today’s summary is sent if you
          ask the AI.
        </li>
      </ul>
      <button type="button" className="ghost" onClick={onReset}>
        Clear my saved details
      </button>
    </footer>
  );
}
