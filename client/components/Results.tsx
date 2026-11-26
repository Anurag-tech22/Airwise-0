import { useState } from "react";
import type { Action, Area } from "../../shared/actions";
import type { Analysis } from "../../shared/analysis";
import type { Block, Window } from "../../shared/daily";
import { windowsText, type Windows } from "../../shared/windows";
import type { Risk } from "../../shared/risk";

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

export function RiskCard({ risk }: { risk: Risk }) {
  return (
    <section className="card" aria-labelledby="h-risk">
      <h2 id="h-risk">Your family’s level today</h2>
      <p className="lv big" data-level={risk.effectiveLevel}>
        <strong>{risk.effective.label}</strong>
        {risk.effectiveLevel > risk.baseLevel && (
          <span> — the air is {risk.base.label}, raised for your household</span>
        )}
      </p>
      <ul>
        {risk.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </section>
  );
}

const stepsLabel = (n: number) => (n === 1 ? "step" : `${n} steps`);

export function ExposureCard({ a }: { a: Analysis }) {
  const { exposure: e, scenario: sc, profile: p } = a;
  return (
    <section className="card" aria-labelledby="h-exp">
      <h2 id="h-exp">Your family’s day in numbers</h2>
      <p>
        Estimated fine-particle (PM2.5) dose today: <strong>≈ {fmt(sc.before)} µg</strong> for{" "}
        {p.infants + p.children > 0 ? "a parent and a child" : "an adult"}.
      </p>
      {sc.steps.length > 0 && (
        <>
          <div className="bars">
            <span>As you live today</span>
            <div
              className="bar"
              role="img"
              aria-label={`As you live today: about ${fmt(sc.before)} micrograms`}
            >
              <i style={{ width: "100%" }} />
            </div>
            <span>With your top {stepsLabel(sc.steps.length)}</span>
            <div
              className="bar good"
              role="img"
              aria-label={`With your top steps: about ${fmt(sc.after)} micrograms`}
            >
              <i style={{ width: `${100 - sc.reductionPct}%` }} />
            </div>
          </div>
          <p>
            <strong>−{sc.reductionPct}%</strong> (≈ {fmt(sc.after)} µg) if you take your top{" "}
            {stepsLabel(sc.steps.length)}:
          </p>
          <ol>
            {sc.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </>
      )}
      <h3>Where it comes from</h3>
      <ul>
        {e.segments.slice(0, 3).map((s) => (
          <li key={s.label}>
            {s.label}: {Math.round((s.dose / (e.total || 1)) * 100)}%
          </li>
        ))}
      </ul>
      <p className="hint">
        Estimates from a transparent model of time, place and breathing rate — not a medical measurement.
      </p>
    </section>
  );
}

const AREAS = [
  ["all", "All"],
  ["routine", "Routine"],
  ["indoor", "Indoor air"],
  ["commute", "Commute"],
  ["sustainable", "Sustainable"],
  ["community", "Community"],
] as const;
const EFFORT = { easy: "Easy", moderate: "Moderate", involved: "Involved" } as const;

const impacts = (a: Action): string[] => {
  const out: string[] = [];
  if (a.reductionPct !== null) out.push(`−${a.reductionPct}% PM2.5 intake`);
  if (a.co2SavedKgPerWeek !== null) out.push(`≈ ${a.co2SavedKgPerWeek} kg CO₂e less per week`);
  return out.length ? out : ["Everyday habit"];
};

export function ActionsList({ actions }: { actions: Action[] }) {
  const [area, setArea] = useState<"all" | Area>("all");
  const shown = area === "all" ? actions : actions.filter((a) => a.area === area);
  return (
    <section className="card" aria-labelledby="h-act">
      <h2 id="h-act">What to do, and what it changes</h2>
      <div className="row" role="group" aria-label="Filter actions">
        {AREAS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={area === key ? "chip on" : "chip"}
            aria-pressed={area === key}
            onClick={() => setArea(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="hint">No actions in this group today.</p>}
      <ul className="actions">
        {shown.map((a) => (
          <li key={a.id} className="action">
            <h3>{a.title}</h3>
            <p className="pills">
              {impacts(a).map((i) => (
                <span key={i} className="pill impact">
                  {i}
                </span>
              ))}
              <span className="pill">{EFFORT[a.effort]}</span>
              <span className="pill">{a.cost}</span>
            </p>
            <p>{a.why}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const WINDOW: Record<Window, { label: string; level: number }> = {
  best: { label: "✔ Best window", level: 0 },
  caution: { label: "▲ Use caution", level: 2 },
  avoid: { label: "✖ Avoid", level: 4 },
};

export function DailyPlan({ plan, windows }: { plan: Block[]; windows: Windows | null }) {
  return (
    <section className="card" aria-labelledby="h-plan">
      <h2 id="h-plan">Your low-emission day</h2>
      {windows && (
        <p className="callout">
          <strong>Tailored to your city today:</strong> {windowsText(windows)}{" "}
          <span className="hint">(model forecast)</span>
        </p>
      )}
      <ul className="blocks">
        {plan.map((b) => (
          <li key={b.when} className="block">
            <p>
              <strong>{b.when}</strong>{" "}
              <span className="pill lv" data-level={WINDOW[b.window].level}>
                {WINDOW[b.window].label}
              </span>
            </p>
            <p>{b.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
