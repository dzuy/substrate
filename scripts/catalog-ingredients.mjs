import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { key, parseIngredients } from '../src/lib/inci-parser.mjs';
export { key, parseIngredients };
const q = (s) => "'"+s.replaceAll("'","''")+"'";
export function generate(snapshot) {
  const report={products:[],skipped:[],newIngredients:0,newLinks:0,preservedLinks:0};
  const ingredients=[...snapshot.ingredients];const inserts=[];const links=[];
  for(const r of snapshot.records) {
    const parsed=parseIngredients(r.fields.ingredient_list);
    if(parsed.reason){report.skipped.push({sourceId:r.source_id,reason:parsed.reason,source:r.fields.ingredient_list});continue;}
    const productItems=[];const seen=new Set();
    for(const item of parsed.items) {
      const matches=ingredients.filter(i=>[i.name,i.inci_name,...(i.aliases??[])].filter(Boolean).some(n=>key(n)===key(item.name)));
      if(matches.length>1)throw Error('Ambiguous ingredient: '+item.name);
      let ingredient=matches[0];
      if(!ingredient){ingredient={name:item.name,aliases:[]};ingredients.push(ingredient);inserts.push(item.name);}
      const identity=ingredient.id??ingredient.name;
      if(seen.has(identity))continue;seen.add(identity);
      if(snapshot.links.some(l=>l.product_id===r.product_id && l.ingredient_id===ingredient.id)){report.preservedLinks++;continue;}
      productItems.push({...item,ingredientId:ingredient.id??null,ingredientName:ingredient.name});
    }
    links.push({...r,items:productItems});report.products.push({sourceId:r.source_id,parsed:parsed.items.length,newLinks:productItems.length});
  }
  report.newIngredients=inserts.length;report.newLinks=links.reduce((n,r)=>n+r.items.length,0);
  let sql=`begin;\nset local standard_conforming_strings=on;\nselect pg_advisory_xact_lock(hashtext('substrate-catalog-import'));\nlock table public.ingredients, public.product_ingredients, public.catalog_records, public.products in share row exclusive mode;\n`;
  for(const r of links)sql+=`do $$ begin if not exists(select 1 from public.catalog_records where source_id=${q(r.source_id)} and product_id=${q(r.product_id)} and fields->>'ingredient_list'=${q(r.fields.ingredient_list)}) then raise exception 'Source changed: ${r.source_id}'; end if; end $$;\n`;
  for(const name of inserts)sql+=`insert into public.ingredients(name,inci_name) values(${q(name)},${q(name)}) on conflict(name) do nothing;\n`;
  for(const r of links)for(const i of r.items)sql+=`insert into public.product_ingredients(product_id,ingredient_id,ingredient_order,concentration,concentration_unit,notes) select ${q(r.product_id)}, id, ${i.order}, ${i.concentration??'null'}, ${i.concentration===null?'null':q('%')}, ${q(`Imported from Products_Canonical column O, ${r.source_id}; ${i.section}; position is source order, not inferred concentration. Original label: ${i.name}`)} from public.ingredients where ${i.ingredientId?'id='+q(i.ingredientId):'name='+q(i.ingredientName)} on conflict(product_id,ingredient_id) do nothing;\n`;
  // Ingredient changes invalidate editors opened before this import. Only newly imported rows trigger this.
  sql+=`update public.products p set updated_at=now() where exists(select 1 from public.product_ingredients pi where pi.product_id=p.id and pi.created_at=transaction_timestamp());\ncommit;\n`;
  return {sql,report};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){const s=JSON.parse(readFileSync('data/catalog/ingredients-before.json')).rows[0].snapshot;const {sql,report}=generate(s);writeFileSync('data/catalog/ingredients-import.sql',sql);writeFileSync('data/catalog/ingredients-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,products:report.products.length,skipped:report.skipped.map(x=>x.sourceId)},null,2));}
