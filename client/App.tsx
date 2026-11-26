import AqiPanel from "./components/AqiPanel";
import { About } from "./components/Assistant";
import HouseholdForm from "./components/HouseholdForm";
import ResultsColumn from "./components/ResultsColumn";
import { useAssistant } from "./useAssistant";

/** Page layout only: state and server calls live in `useAssistant`; every section is its own component. */
export default function App() {
  const s = useAssistant();
  const a = s.analysis;
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <main id="main">
        <header>
          <h1>
            Air<span>Wise</span>
          </h1>
          <p className="lead">
            Smog-smart routines for your family: what to do today, how much it helps, and why — tailored to
            your city and your day.
          </p>
        </header>
        <p role="status" aria-live="polite" className="sm">
          {s.msg}
        </p>
        <div className="layout">
          <div className="col">
            <AqiPanel
              cityId={s.cityId}
              aqi={s.aqi}
              reading={s.reading}
              busy={s.busy === "air"}
              onCity={s.setCity}
              onAqi={s.setAqi}
              onLive={() => void s.loadLive()}
              onLocate={() => void s.locate()}
            />
            <HouseholdForm household={s.household} onChange={s.setHousehold} />
          </div>
          <div className="col">
            {a ? (
              <ResultsColumn
                a={a}
                windows={s.windows}
                brief={s.brief}
                answer={s.answer}
                busy={s.busy}
                onExplain={(l) => void s.explain(l)}
                onAsk={(q) => void s.ask(q)}
              />
            ) : (
              <section className="card" aria-labelledby="h-empty">
                <h2 id="h-empty">Set today’s AQI to see your plan</h2>
                <p>Get a live reading for your city, type today’s AQI, or try a scenario on the left.</p>
              </section>
            )}
          </div>
        </div>
        <About onReset={s.reset} />
      </main>
    </>
  );
}
