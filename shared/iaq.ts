/** Air changes per hour that indoor-air guidance commonly targets for cleaning smoky air. */
export const ACH_TARGET = 4;
const CLEAR_FRACTION = 0.9;

export interface Room {
  areaM2: number;
  heightCm: number;
  /** Clean-air delivery rate of the purifier in m³/h (0 if none). */
  cadrM3h: number;
}
export interface RoomCheck {
  volumeM3: number;
  requiredCadr: number;
  achNow: number;
  verdict: "none" | "short" | "enough";
  /** Minutes to clear 90% of particles in a closed room with no new sources; null without a purifier. */
  minutesTo90: number | null;
}

/**
 * Single-compartment mass balance: particles decay as e^(−CADR·t / V), so a closed room reaches a given
 * clearance after t = −ln(1 − η)·V / CADR. Returns null while the room size is incomplete.
 */
export function roomCheck({ areaM2, heightCm, cadrM3h }: Room): RoomCheck | null {
  const volumeM3 = (areaM2 * heightCm) / 100;
  if (volumeM3 <= 0) return null;
  const requiredCadr = Math.ceil(ACH_TARGET * volumeM3);
  const achNow = cadrM3h / volumeM3;
  const verdict = cadrM3h === 0 ? "none" : cadrM3h < requiredCadr ? "short" : "enough";
  const minutesTo90 =
    cadrM3h === 0 ? null : Math.ceil(((-Math.log(1 - CLEAR_FRACTION) * volumeM3) / cadrM3h) * 60);
  return { volumeM3: Math.round(volumeM3), requiredCadr, achNow, verdict, minutesTo90 };
}

/** The plain-language result shown under the room inputs. */
export function roomMessage(r: RoomCheck): string {
  const need = `Room volume ≈ ${r.volumeM3} m³. For ${ACH_TARGET} air changes an hour you need a CADR of about ${r.requiredCadr} m³/h.`;
  if (r.verdict === "none") {
    return `${need} You have no purifier yet: a HEPA unit rated ${r.requiredCadr} m³/h or more, or a DIY filter box, would do it.`;
  }
  const have = `Your purifier gives ≈ ${r.achNow.toFixed(1)} air changes an hour and should clear about 90% of smoke in ≈ ${r.minutesTo90} minutes (windows and doors closed).`;
  return r.verdict === "short"
    ? `${need} ${have} That is a little low: aim for ${r.requiredCadr} m³/h or run it on its highest setting.`
    : `${need} ${have}`;
}
