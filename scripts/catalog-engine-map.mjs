import fs from "node:fs";
import { pathToFileURL } from "node:url";
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
export function mappingSql(snapshot) {
  const ingredients = new Map(snapshot.ingredients.map((i) => [i.id, i]));
  const products = new Set(snapshot.products.map((p) => p.id));
  const rows = snapshot.links.flatMap((l) => {
    if (!products.has(l.product_id)) return [];
    const i = ingredients.get(l.ingredient_id);
    const id = engineIdentity(i?.inci_name) || engineIdentity(i?.name);
    if (!id) return [];
    return [
      `('${l.product_id}','${l.ingredient_id}','${id}','primary',true,false)`,
    ];
  });
  return `-- Exact ingredient identities; publication still requires formula review.\nbegin;\ninsert into public.catalog_engine_expressions(product_id,ingredient_id,engine_ingredient_id,role,required_eligible,approved) values\n${rows.join(",\n")}\non conflict do nothing;\ncommit;\n`;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const data = JSON.parse(fs.readFileSync(process.argv[2]));
  fs.writeFileSync(
    process.argv[3],
    mappingSql(data.rows?.[0]?.snapshot || data),
  );
}
