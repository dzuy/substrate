import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { engineIdentity } from '../shared/ingredient-identity.mjs';
export { engineIdentity } from '../shared/ingredient-identity.mjs';
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
