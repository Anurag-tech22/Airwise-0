import type { ModeRow } from "../../shared/commute";

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

/** The same daily distance every way of travelling: time, fine particles breathed in, and weekly carbon. */
export default function CommuteTable({ rows }: { rows: ModeRow[] }) {
  return (
    <section className="card" aria-labelledby="h-commute">
      <h2 id="h-commute">How your commute choices compare</h2>
      <div className="table-wrap">
        <table>
          <caption className="hint">
            Same daily distance, today’s air, your mask habit. Estimates from the exposure model.
          </caption>
          <thead>
            <tr>
              <th scope="col">Way to travel</th>
              <th scope="col">Time a day</th>
              <th scope="col">PM2.5 breathed in on the trips</th>
              <th scope="col">CO₂e a week</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.mode}>
                <th scope="row">
                  {r.label}
                  {r.current && <span className="pill"> your commute</span>}
                </th>
                <td>{r.minutes === null ? "too far to walk" : `${r.minutes} min`}</td>
                <td>{r.doseUg === null ? "—" : `≈ ${fmt(r.doseUg)} µg`}</td>
                <td>{r.co2KgPerWeek} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
