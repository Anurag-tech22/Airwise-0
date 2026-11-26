import { recommend, scenario } from "./actions";
import { pm25FromAqi } from "./aqi";
import { buildContext } from "./context";
import { dailyPlan } from "./daily";
import { exposure } from "./exposure";
import type { Profile } from "./household";
import { assessRisk } from "./risk";
import { summarize } from "./summary";

/** Everything the app shows for one household on one day, computed in one place from one input. */
export function analyse(profile: Profile) {
  const risk = assessRisk(profile);
  const actions = recommend(profile, risk);
  const sc = scenario(profile, actions, risk);
  return {
    profile,
    risk,
    actions,
    scenario: sc,
    exposure: exposure(profile),
    plan: dailyPlan(profile, risk),
    summary: summarize(profile, risk, sc),
    context: buildContext(profile, risk, actions),
    pm25: pm25FromAqi(profile.aqi),
  };
}
export type Analysis = ReturnType<typeof analyse>;
