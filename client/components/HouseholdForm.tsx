import type { Household } from "../../shared/household";
import { NumberField, RadioGroup } from "./Fields";

interface Props {
  household: Household;
  onChange: (patch: Partial<Household>) => void;
}

const PURIFIER = [
  { value: "none", label: "None" },
  { value: "hepa", label: "HEPA purifier" },
  { value: "diy", label: "DIY filter box" },
] as const;
const WINDOWS = [
  { value: "open", label: "Usually open" },
  { value: "closed", label: "Kept closed" },
] as const;
const COOKING = [
  { value: "lpg", label: "LPG" },
  { value: "induction", label: "Induction" },
  { value: "biomass", label: "Wood, dung or coal" },
] as const;
const COMMUTE = [
  { value: "wfh", label: "Work from home" },
  { value: "walk", label: "Walk" },
  { value: "two-wheeler", label: "Two-wheeler" },
  { value: "car", label: "Car" },
  { value: "bus", label: "Bus" },
  { value: "metro", label: "Metro" },
] as const;
const MASK = [
  { value: "none", label: "None" },
  { value: "cloth", label: "Cloth" },
  { value: "surgical", label: "Surgical" },
  { value: "n95", label: "N95 / FFP2" },
] as const;

function People({ household: h, onChange }: Props) {
  return (
    <fieldset>
      <legend>Who is at home</legend>
      <NumberField
        id="infants"
        label="Babies under 2"
        value={h.infants}
        max={5}
        onChange={(infants) => onChange({ infants })}
      />
      <NumberField
        id="children"
        label="Children 2–12"
        value={h.children}
        max={8}
        onChange={(children) => onChange({ children })}
      />
      <NumberField
        id="elders"
        label="Adults 60+"
        value={h.elders}
        max={6}
        onChange={(elders) => onChange({ elders })}
      />
      <div className="radio">
        <input
          id="sensitive"
          type="checkbox"
          checked={h.sensitive}
          onChange={(e) => onChange({ sensitive: e.target.checked })}
        />
        <label htmlFor="sensitive">Someone has asthma, or a heart or lung condition</label>
      </div>
    </fieldset>
  );
}

function Home({ household: h, onChange }: Props) {
  return (
    <>
      <RadioGroup
        legend="Air purifier at home"
        name="purifier"
        value={h.purifier}
        options={PURIFIER}
        onChange={(purifier) => onChange({ purifier })}
      />
      <RadioGroup
        legend="Windows"
        name="windows"
        value={h.windows}
        options={WINDOWS}
        onChange={(windows) => onChange({ windows })}
      />
      <RadioGroup
        legend="Cooking fuel"
        name="cooking"
        value={h.cooking}
        options={COOKING}
        onChange={(cooking) => onChange({ cooking })}
      />
    </>
  );
}

function Day({ household: h, onChange }: Props) {
  return (
    <>
      <RadioGroup
        legend="How you commute"
        name="commute"
        value={h.commute}
        options={COMMUTE}
        onChange={(commute) => onChange({ commute })}
      />
      <NumberField
        id="commuteMinutes"
        label="Commute minutes per day (both ways)"
        value={h.commuteMinutes}
        max={300}
        onChange={(commuteMinutes) => onChange({ commuteMinutes })}
      />
      <NumberField
        id="kidsOutdoorMinutes"
        label="Children’s outdoor minutes per day"
        hint="School run plus outdoor play."
        value={h.kidsOutdoorMinutes}
        max={300}
        onChange={(kidsOutdoorMinutes) => onChange({ kidsOutdoorMinutes })}
      />
      <NumberField
        id="exerciseMinutes"
        label="Your outdoor exercise minutes per day"
        value={h.exerciseMinutes}
        max={240}
        onChange={(exerciseMinutes) => onChange({ exerciseMinutes })}
      />
      <RadioGroup
        legend="Mask you wear outdoors"
        name="mask"
        value={h.mask}
        options={MASK}
        onChange={(mask) => onChange({ mask })}
      />
    </>
  );
}

/** Step 2: counts and habits only — no names, no free text. Everything stays in this browser. */
export default function HouseholdForm(props: Props) {
  return (
    <section className="card" aria-labelledby="h-home">
      <h2 id="h-home">2 · Your household</h2>
      <p className="hint">Counts and habits only. This stays in your browser.</p>
      <People {...props} />
      <Home {...props} />
      <Day {...props} />
    </section>
  );
}
