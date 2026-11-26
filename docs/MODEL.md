# How AirWise decides and how it estimates impact

AirWise is deliberately **rules plus a transparent model**, with generative AI only for explanation. Every number on screen can be traced to a line of code in `shared/`, and every assumption below can be changed in one place (`MODEL` in `shared/exposure.ts`).

## 1. Today's air

| Step          | Rule                                                                                                                                                                    | Code                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Category      | India's CPCB National AQI: Good ≤ 50, Satisfactory ≤ 100, Moderate ≤ 200, Poor ≤ 300, Very Poor ≤ 400, Severe ≤ 500                                                     | `shared/aqi.ts`                          |
| Live reading  | PM2.5 and PM10 from Open-Meteo (CAMS model) are converted with the CPCB breakpoints; the worse sub-index wins. This is an **indicative** value, not an official reading | `shared/aqi.ts`, `server/aqiProvider.ts` |
| Concentration | A typed AQI is converted back to PM2.5 (winter smog is mostly PM2.5), and compared with the WHO 2021 24-hour guideline of 15 µg/m³                                      | `pm25FromAqi`, `whoMultiple`             |

## 2. Your family's level

Vulnerable members make the same air count as worse for the household: babies under 2, children 2–12, adults 60+, and anyone with asthma or a heart or lung condition. One group raises the level one step; several groups raise it two steps once the air is Poor or worse; clean air is never raised. The level maps to guidance: **ok** (Good, Satisfactory), **limit** (Moderate, Poor), **avoid** (Very Poor, Severe). See `shared/risk.ts`.

## 3. Exposure model (the "direct impact")

The model estimates the fine-particle dose in µg inhaled in a day for one reference adult and, if the household has children, one reference child: **dose = Σ concentration × breathing rate × hours** over the day's activities.

| Assumption                                  | Value                                                                                             | Meaning                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Indoor share of outdoor PM2.5               | windows open 0.9, kept closed 0.6                                                                 | leaky Indian homes follow outdoor air closely                                |
| Purifier (sized for the room)               | HEPA × 0.4, DIY Corsi–Rosenthal box × 0.5                                                         | indoor level multiplier                                                      |
| Mask worn properly (adults)                 | none 1, cloth 0.8, surgical 0.65, N95 0.25                                                        | share of particles that still gets through; real-world fit is rarely perfect |
| Cooking source                              | wood/dung/coal +80, LPG +10, induction 0 µg/m³ for 2 h a day                                      | extra particles in home air while cooking                                    |
| Breathing rates (m³/h)                      | adult rest 0.5, light 1.0, exercise 2.5; child rest 0.35, light 0.7, play 1.5                     | exercise multiplies the dose                                                 |
| Commute: air inside vs outdoors, rate       | walk 1.0 / 1.5, two-wheeler 1.3 / 1.0, car (windows up) 0.5 / 0.6, bus 0.9 / 0.8, metro 0.6 / 0.7 | masks apply on walk, two-wheeler, bus, metro                                 |
| Speed and carbon (kg CO₂e per passenger-km) | walk 5 km/h; two-wheeler 25, 0.06; car 22, 0.17; bus 18, 0.05; metro 30, 0.03                     | used for weekly carbon savings                                               |

An action's impact is measured, not guessed: the household is changed as the action says (for example `mask: "n95"`), the model is run again, and the **percentage drop in the family's daily dose** is shown. The combined "top steps" figure applies the best actions one after another and never combines alternatives (a HEPA purifier and a DIY box are one choice).

## 4. Ranking and tailoring

`shared/actions.ts` holds a catalogue of actions. Each has a condition (for example: purifier is none and the family level is Moderate or worse), an effort, an indicative ₹ cost, a plain-language _why_, and, where it can be modelled, how it changes the household. Safety advice for babies comes first; then modelled actions by measured impact; then everyday habits. Actions that would change almost nothing are hidden.

## 5. The day plan

`shared/daily.ts` turns the level into four parts of the day. In winter, cold air traps smog near the ground at night and early morning and traffic pushes it up again in the evening, so midday is usually the best window for essential outdoor time.

## 6. Best and worst hours (location-specific)

When live data is used, the provider also returns today's hourly forecast for the chosen city. AirWise averages each consecutive pair of hours between 6 am and 10 pm that has not passed yet and reports the cleanest and the dirtiest two-hour windows (`shared/windows.ts`). When the forecast is flat it says so. With a typed AQI there is no forecast, so only the general day plan is shown.

## 7. Commute comparison

For a commuter, AirWise keeps the **daily distance** fixed (current minutes × the current mode's speed) and recomputes, for every mode, the time, the PM2.5 breathed in on the trips with the same formula as the day's exposure (`dose = minutes/60 × concentration × in-vehicle factor × mask share × breathing rate`) and the weekly carbon (`5 days × km × kg CO₂e per passenger-km`). Walking is not offered beyond 90 minutes a day. The row for your current mode matches the exposure model exactly (a property test checks this). Code: `shared/commute.ts`.

## 8. Room-by-room air check

For a room of volume V (floor area × ceiling height) and a purifier with clean-air delivery rate CADR (m³/h): the CADR needed for **4 air changes an hour** is `4 × V`; the air changes you get are `CADR / V`; and in a closed room with no new sources, particles fall as `e^(−CADR·t/V)`, so reaching 90% clearance takes `t = ln(10) × V / CADR` hours. This is a single-compartment mass balance: it ignores leaks, sources and filter ageing. Code: `shared/iaq.ts`.

## Limits you should know

- These are rounded, literature-informed approximations for education, **not measurements** and **not medical advice**.
- Live data is a model estimate; official readings come from CPCB or SAFAR monitors.
- The hourly forecast is a model estimate for the city centre; local conditions vary.
- One reference adult and one reference child stand in for the household; real days vary.
- The model has no weather, building or filter-ageing details. Purifier results assume a correctly sized, maintained unit.
