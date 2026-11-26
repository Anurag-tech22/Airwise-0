import fc from "fast-check";
import { DEFAULT_HOUSEHOLD, type Profile } from "./household";

/** Test helper: a realistic Delhi family on a Very Poor day, with any field overridden. */
export const profile = (over: Partial<Profile> = {}): Profile => ({
  ...DEFAULT_HOUSEHOLD,
  cityId: "delhi",
  aqi: 320,
  ...over,
});

/** Test helper: arbitrary valid profiles for property-based tests. */
export const profileArb: fc.Arbitrary<Profile> = fc.record({
  cityId: fc.constant("delhi"),
  aqi: fc.integer({ min: 0, max: 500 }),
  infants: fc.integer({ min: 0, max: 5 }),
  children: fc.integer({ min: 0, max: 8 }),
  elders: fc.integer({ min: 0, max: 6 }),
  sensitive: fc.boolean(),
  purifier: fc.constantFrom<Profile["purifier"]>("none", "hepa", "diy"),
  windows: fc.constantFrom<Profile["windows"]>("open", "closed"),
  cooking: fc.constantFrom<Profile["cooking"]>("lpg", "induction", "biomass"),
  commute: fc.constantFrom<Profile["commute"]>("wfh", "walk", "two-wheeler", "car", "bus", "metro"),
  commuteMinutes: fc.integer({ min: 0, max: 300 }),
  kidsOutdoorMinutes: fc.integer({ min: 0, max: 300 }),
  exerciseMinutes: fc.integer({ min: 0, max: 240 }),
  mask: fc.constantFrom<Profile["mask"]>("none", "cloth", "surgical", "n95"),
});
