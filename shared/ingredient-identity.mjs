// Explicit identities only. Derivatives remain distinct; never substring-match INCI.
const families = {
  I_GLY: ["glycerin", "glycerol"],
  I_NIA: ["niacinamide", "nicotinamide"],
  I_CER: [
    "ceramide np",
    "ceramide ap",
    "ceramide eop",
    "ceramide ns",
    "ceramide ng",
    "ceramide as",
    "ceramides",
  ],
  I_HA: ["hyaluronic acid", "sodium hyaluronate"],
  I_PANTH: ["panthenol", "d-panthenol"],
  I_CENT: ["centella asiatica extract"],
  I_AZA: ["azelaic acid"],
  I_SA: ["salicylic acid"],
  I_BPO: ["benzoyl peroxide"],
  I_RET: [
    "retinol",
    "retinal",
    "retinaldehyde",
    "retinyl palmitate",
    "retinyl acetate",
    "tretinoin",
    "adapalene",
    "tazarotene",
  ],
  I_VITC: ["ascorbic acid", "l-ascorbic acid"],
  I_HEL_EXT: [
    "helichrysum italicum extract",
    "helichrysum italicum flower extract",
  ],
  I_HEL_EO: ["helichrysum italicum flower oil"],
  I_HEL_HYD: ["helichrysum italicum flower water"],
};
export function engineIdentity(name) {
  const key = String(name || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  return Object.entries(families).find(([, names]) => names.includes(key))?.[0];
}
