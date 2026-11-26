import type { AirReading } from "../../shared/api";
import { categoryOf, levelOf, pm25FromAqi, whoMultiple } from "../../shared/aqi";
import { CITIES } from "../../shared/cities";

const SCENARIOS = [
  { label: "Moderate (150)", aqi: 150 },
  { label: "Very Poor (350)", aqi: 350 },
  { label: "Severe (450)", aqi: 450 },
];

interface Props {
  cityId: string;
  aqi: number | null;
  reading: AirReading | null;
  busy: boolean;
  onCity: (id: string) => void;
  onAqi: (aqi: number | null) => void;
  onLive: () => void;
  onLocate: () => void;
}

export function AqiBadge({ aqi }: { aqi: number }) {
  return (
    <div className="aqi lv" data-level={levelOf(aqi)}>
      <span className="aqi-num">{aqi}</span>
      <span>
        <strong>{categoryOf(aqi).label}</strong>
        <br />≈ {whoMultiple(pm25FromAqi(aqi))}× the WHO daily PM2.5 guideline
      </span>
    </div>
  );
}

/** Step 1: today's air, from a live reading, a typed value or a quick scenario. */
export default function AqiPanel({ cityId, aqi, reading, busy, onCity, onAqi, onLive, onLocate }: Props) {
  return (
    <section className="card" aria-labelledby="h-air">
      <h2 id="h-air">1 · Today’s air</h2>
      <div className="field">
        <label htmlFor="city">City</label>
        <select id="city" value={cityId} onChange={(e) => onCity(e.target.value)}>
          {CITIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}, {c.state}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <button type="button" className="ghost" onClick={onLocate}>
          Use my location
        </button>
        <span className="hint">
          Finds the nearest city on your device; your location is not sent anywhere.
        </span>
      </div>
      <div className="row">
        <button type="button" onClick={onLive} disabled={busy}>
          Get live AQI
        </button>
        <span className="hint">Model-based estimate, not an official reading.</span>
      </div>
      <div className="field">
        <label htmlFor="aqi">Or enter today’s AQI (0–500)</label>
        <input
          id="aqi"
          type="number"
          inputMode="numeric"
          min={0}
          max={500}
          value={aqi ?? ""}
          onChange={(e) =>
            onAqi(
              e.target.value === "" ? null : Math.min(500, Math.max(0, Math.round(Number(e.target.value)))),
            )
          }
        />
      </div>
      <div className="row" role="group" aria-label="Try a scenario">
        <span className="hint">Try:</span>
        {SCENARIOS.map((s) => (
          <button key={s.aqi} type="button" className="ghost" onClick={() => onAqi(s.aqi)}>
            {s.label}
          </button>
        ))}
      </div>
      {aqi !== null && <AqiBadge aqi={aqi} />}
      {reading && (
        <p className="hint">
          Live reading ({reading.observedAt}): PM2.5 {reading.pm25 ?? "n/a"} µg/m³, PM10{" "}
          {reading.pm10 ?? "n/a"} µg/m³. Source: {reading.source}.
        </p>
      )}
    </section>
  );
}
