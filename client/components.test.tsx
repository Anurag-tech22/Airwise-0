// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyse } from "../shared/analysis";
import { DEFAULT_HOUSEHOLD } from "../shared/household";
import { profile } from "../shared/testing";
import AqiPanel from "./components/AqiPanel";
import { Explainer } from "./components/Assistant";
import { NumberField } from "./components/Fields";
import HouseholdForm from "./components/HouseholdForm";
import { ExposureCard } from "./components/Results";

afterEach(cleanup);

describe("NumberField", () => {
  it("clamps, rounds and never emits NaN", () => {
    const onChange = vi.fn();
    render(<NumberField id="n" label="N" value={1} max={5} hint="A hint" onChange={onChange} />);
    const input = screen.getByLabelText("N");
    expect(input.getAttribute("aria-describedby")).toBe("n-hint");
    for (const v of ["9", "-3", "2.6", ""]) fireEvent.change(input, { target: { value: v } });
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([5, 0, 3, 0]);
  });
  it("has no description when there is no hint", () => {
    render(<NumberField id="m" label="M" value={0} max={5} onChange={() => {}} />);
    expect(screen.getByLabelText("M").getAttribute("aria-describedby")).toBeNull();
  });
});
describe("AqiPanel", () => {
  it("reports typed values, empty input and quick scenarios", () => {
    const onAqi = vi.fn();
    render(
      <AqiPanel
        cityId="delhi"
        aqi={null}
        reading={null}
        busy={false}
        onCity={() => {}}
        onAqi={onAqi}
        onLive={() => {}}
        onLocate={() => {}}
      />,
    );
    const input = screen.getByLabelText(/enter today’s AQI/);
    for (const v of ["120", "9000", "-5"]) fireEvent.change(input, { target: { value: v } });
    fireEvent.click(screen.getByRole("button", { name: "Severe (450)" }));
    expect(onAqi.mock.calls.map((c) => c[0])).toEqual([120, 500, 0, 450]);
  });
  it("reports an emptied field as no value", () => {
    const onAqi = vi.fn();
    render(
      <AqiPanel
        cityId="delhi"
        aqi={80}
        reading={null}
        busy={false}
        onCity={() => {}}
        onAqi={onAqi}
        onLive={() => {}}
        onLocate={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText(/enter today’s AQI/), { target: { value: "" } });
    expect(onAqi).toHaveBeenCalledWith(null);
  });
  it("disables the live button while loading", () => {
    render(
      <AqiPanel
        cityId="delhi"
        aqi={80}
        reading={null}
        busy
        onCity={() => {}}
        onAqi={() => {}}
        onLive={() => {}}
        onLocate={() => {}}
      />,
    );
    expect((screen.getByRole("button", { name: "Get live AQI" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
describe("ExposureCard", () => {
  it("handles clean air with nothing to improve", () => {
    render(
      <ExposureCard
        a={analyse(profile({ aqi: 0, children: 0, cooking: "induction", exercise: 0 } as never))}
      />,
    );
    expect(screen.getByText(/for an adult/)).toBeTruthy();
    expect(screen.queryByText(/As you live today/)).toBeNull();
    expect(screen.getAllByText(/: 0%/).length).toBeGreaterThan(0);
  });
  it("uses the singular when only one step helps", () => {
    const a = analyse(
      profile({
        aqi: 150,
        children: 0,
        infants: 0,
        commute: "wfh",
        exerciseMinutes: 0,
        purifier: "hepa",
        windows: "closed",
        cooking: "induction",
      }),
    );
    render(
      <ExposureCard
        a={{ ...a, scenario: { before: 100, after: 90, reductionPct: 10, steps: ["Only step"] } }}
      />,
    );
    expect(screen.getByText(/With your top step/)).toBeTruthy();
  });
});
describe("Explainer", () => {
  it("offers all three languages", () => {
    render(<Explainer summary="S" shareText="T" busy={false} brief={null} onExplain={() => {}} />);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["English", "हिन्दी", "मराठी"]);
  });
});

describe("HouseholdForm", () => {
  it("reports a patch for every control", () => {
    const onChange = vi.fn();
    render(<HouseholdForm household={DEFAULT_HOUSEHOLD} onChange={onChange} />);
    const set = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    set("Babies under 2", "2");
    set("Children 2–12", "3");
    set("Adults 60+", "1");
    fireEvent.click(screen.getByLabelText("Someone has asthma, or a heart or lung condition"));
    fireEvent.click(screen.getByLabelText("HEPA purifier"));
    fireEvent.click(screen.getByLabelText("Kept closed"));
    fireEvent.click(screen.getByLabelText("Induction"));
    fireEvent.click(screen.getByLabelText("Metro"));
    set("Commute minutes per day (both ways)", "45");
    set("Children’s outdoor minutes per day", "20");
    set("Your outdoor exercise minutes per day", "10");
    fireEvent.click(screen.getByLabelText("N95 / FFP2"));
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([
      { infants: 2 },
      { children: 3 },
      { elders: 1 },
      { sensitive: true },
      { purifier: "hepa" },
      { windows: "closed" },
      { cooking: "induction" },
      { commute: "metro" },
      { commuteMinutes: 45 },
      { kidsOutdoorMinutes: 20 },
      { exerciseMinutes: 10 },
      { mask: "n95" },
    ]);
  });
});
