export interface Myth {
  myth: string;
  fact: string;
}

export const MYTHS: readonly Myth[] = [
  {
    myth: "Indoor plants clean the air.",
    fact: "At home scale they remove very little. Sealing windows and running a HEPA or DIY filter does the work.",
  },
  {
    myth: "A cloth or surgical mask stops smog.",
    fact: "They leak around the edges and let fine particles through. A well-fitted N95/FFP2 filters most of them.",
  },
  {
    myth: "Incense, dhoop or candles freshen the air.",
    fact: "They release more fine particles into the room. Skip them on smoggy days.",
  },
  {
    myth: "A morning jog is healthy even in smog.",
    fact: "Hard breathing multiplies how much polluted air you take in. On Poor days or worse, exercise indoors.",
  },
  {
    myth: "Open the windows at night to air the house.",
    fact: "In winter, smog often peaks at night and early morning. Ventilate briefly around midday only if the AQI dips.",
  },
  {
    myth: "Steam or home remedies clear the lungs.",
    fact: "There is no reliable evidence that they remove particles. Reducing exposure is what works.",
  },
];
