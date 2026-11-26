import type { ReactNode } from "react";

const clamp = (raw: string, max: number) => Math.min(max, Math.max(0, Math.round(Number(raw) || 0)));

interface NumberFieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  value: number;
  max: number;
  onChange: (value: number) => void;
}
/** Whole-number input that never produces an out-of-range or non-numeric value. */
export function NumberField({ id, label, hint, value, max, onChange }: NumberFieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={value}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(clamp(e.target.value, max))}
      />
      {hint && (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}

interface RadioGroupProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}
export function RadioGroup<T extends string>({ legend, name, value, options, onChange }: RadioGroupProps<T>) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="radios">
        {options.map((o) => (
          <div key={o.value} className="radio">
            <input
              id={`${name}-${o.value}`}
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <label htmlFor={`${name}-${o.value}`}>{o.label}</label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
