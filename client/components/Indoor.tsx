import { useState } from "react";
import { roomCheck, roomMessage } from "../../shared/iaq";
import { NumberField } from "./Fields";

const DIY_STEPS = [
  "Buy four 20×20×1 in (about 50×50 cm) MERV-13 furnace filters and one 20-inch box fan with a recent safety label.",
  "Tape the four filters into a cube with their airflow arrows pointing inward and the top left open.",
  "Tape a square of cardboard over the bottom.",
  "Set the fan on top so it blows up and out (check the arrow on the fan), then seal the edges with tape.",
  "Run it in the room you use most, never covered or unattended, and swap the filters when they look dirty.",
];

/** Room-by-room check: how much clean air a room needs, what a purifier delivers, and how to build a cheap one. */
export default function RoomCard() {
  const [areaM2, setArea] = useState(15);
  const [heightCm, setHeight] = useState(270);
  const [cadrM3h, setCadr] = useState(0);
  const result = roomCheck({ areaM2, heightCm, cadrM3h });
  return (
    <section className="card" aria-labelledby="h-room">
      <h2 id="h-room">Room-by-room air check</h2>
      <p className="hint">Does the room you live in most have enough clean air?</p>
      <NumberField id="roomArea" label="Floor area (m²)" value={areaM2} max={200} onChange={setArea} />
      <NumberField
        id="roomHeight"
        label="Ceiling height (cm)"
        value={heightCm}
        max={500}
        onChange={setHeight}
      />
      <NumberField
        id="roomCadr"
        label="Purifier CADR (m³/h)"
        hint="The clean-air delivery rate on the purifier's label. Leave 0 if you have none."
        value={cadrM3h}
        max={2000}
        onChange={setCadr}
      />
      <p className="answer">
        {result
          ? roomMessage(result)
          : "Enter your room’s floor area and ceiling height to see what it needs."}
      </p>
      <details>
        <summary>How to build a DIY filter box (Corsi–Rosenthal)</summary>
        <ol>
          {DIY_STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </details>
    </section>
  );
}
