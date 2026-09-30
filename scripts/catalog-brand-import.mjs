import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseIngredients } from './catalog-ingredients.mjs';

export const identity = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const q = value => "'" + String(value).replaceAll("'", "''") + "'";
const j = value => q(JSON.stringify(value)) + '::jsonb';
const slug = value => identity(value).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function stableId(value){const hex=createHash('sha256').update('substrate-brand-catalog:'+value).digest('hex');return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;}
const unusable = value => /not (?:published|disclosed|available|listed)|unknown|do not infer|requires|not stated/i.test(value);
export const variantIdentity = value => !value || unusable(value) || /consolidat|current (?:official|full.size|presentation)|not (?:split|captured)|where offered|canonical|full.size only/i.test(value) ? '' : identity(value);
const productLabel = f => f.product_name.toLowerCase().startsWith(f.brand.toLowerCase()+' ') ? f.product_name.slice(f.brand.length+1) : f.product_name;

export function prepareBrandImport(rows,backup,snapshots) {
  const brands=[...backup.brands];const groups=new Map();const conflicts=[];const sourceProducts=new Map();
  const fileDates=new Map(snapshots.map(s=>[s.source.id,s.source.created_time]));
  for(const row of rows){
    const f=row.fields;
    let candidates=brands.filter(b=>identity(b.name)===identity(f.brand)||b.slug===slug(f.brand));
    if(candidates.length>1)throw Error('Ambiguous brand '+f.brand);
    let brand=candidates[0];if(!brand){brand={id:stableId('brand:'+identity(f.brand)),name:f.brand,slug:slug(f.brand)};brands.push(brand);}
    row.brandId=brand.id;
    const variant=variantIdentity(f.variant);
    let k=[brand.id,identity(productLabel(f)),variant].join('|');
    const group=groups.get(k);
    // Same-name rows inside one workbook are distinct until variant identity is reviewed.
    if(group?.some(r=>r.source_file_id===row.source_file_id)){k+='|'+row.source_id;conflicts.push({sourceId:row.source_id,reason:'Same-name rows in one workbook; retained separately'});}
    if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row);
  }
  const products=[];const records=[];const reviews=[];const ingredientLinks=[];const newIngredients=[];
  const ingredients=[...backup.ingredients];
  for(const group of groups.values()){
    const ranked=[...group].sort((a,b)=>(fileDates.get(b.source_file_id)??'').localeCompare(fileDates.get(a.source_file_id)??''));
    const chosen=ranked[0];const f={...chosen.fields};const name=productLabel(f);
    const sourceValues=new Set(group.map(r=>identity(r.fields.ingredient_list)).filter(Boolean));
    if(sourceValues.size>1){f.formula_status='unresolved';conflicts.push({sourceId:chosen.source_id,reason:'Conflicting ingredient text across sources'});}
    if(new Set(group.map(r=>r.fields.price_raw).filter(Boolean)).size>1)conflicts.push({sourceId:chosen.source_id,reason:'Multiple source prices; market/size/date review required'});
    let existing=backup.products.filter(p=>p.brand_id===chosen.brandId&&[p.name,...p.aliases].some(n=>identity(n)===identity(name)||identity(n)===identity(f.product_name)));
    // A name alone is not enough to match a sellable variant to the existing catalog.
    const preciseVariant=variantIdentity(f.variant);
    if(existing.length===1&&preciseVariant){
      const evidence=backup.catalog_records.find(r=>r.product_id===existing[0].id)?.fields;
      const oldVariant=evidence?.variant??evidence?.size??evidence?.price_size??'';
      if(variantIdentity(oldVariant)!==preciseVariant)existing=[];
    }
    if(existing.length>1){conflicts.push({sourceId:chosen.source_id,reason:'Ambiguous live product match; separate unpublished record retained'});existing=[];}
    const current=existing[0];const id=current?.id??stableId('product:'+chosen.source_id);
    for(const r of group)sourceProducts.set(r.source_id,id);
    const duplicateName=backup.products.some(p=>p.brand_id===chosen.brandId&&identity(p.name)===identity(name))&&!current;
    if(duplicateName)conflicts.push({sourceId:chosen.source_id,reason:'Existing same-name product has unresolved variant identity; compare before publication'});
    const product={id,brand_id:chosen.brandId,name,slug:'drv-'+chosen.source_id.toLowerCase(),category:f.category,product_type:f.product_type,is_bundle:f.is_bundle==='true',variant_label:f.variant||null,manufacturer_sku:unusable(f.manufacturer_sku)?null:f.manufacturer_sku||null,price_amount:f.price_amount?Number(f.price_amount):null,currency:f.currency||null,availability:f.availability||null,formula_status:f.formula_status,existing:!!current};
    f.manufacturer_sku=product.manufacturer_sku??'';
    products.push(product);
    const currentRecord=backup.catalog_records.find(r=>r.product_id===id);
    if(!currentRecord)records.push({source_id:chosen.source_id,product_id:id,import_id:'drive-'+chosen.source_file_id,entity_type:f.is_bundle==='true'?'Multi-step System / Kit':'Finished Product',fields:f});
    const sourceId=currentRecord?.source_id??chosen.source_id;
    const issues=[];
    if(!f.product_url)issues.push('Missing exact product URL');
    if(!product.price_amount||!product.currency)issues.push('Price or currency needs verification');
    if(!['full_unverified','not_applicable'].includes(f.formula_status))issues.push('Missing, partial or unresolved ingredient list');
    if(f.formula_status==='full_unverified')issues.push('Full ingredient transcription requires source/formula verification');
    if(!f.variant||/consolidat|not stated|not disclosed|not captured|where offered|not split/i.test(f.variant))issues.push('Sellable variant identity is incomplete');
    if(!['topical','device','supplement','hair_scalp','cosmetic','accessory'].includes(f.product_type))issues.push('Product type needs review');
    if(current)issues.push('New source attached; compare with existing CMS evidence without overwriting');
    for(const conflict of conflicts.filter(c=>group.some(r=>r.source_id===c.sourceId)))issues.push(conflict.reason);
    if(issues.length)reviews.push({id:'brand-review-'+chosen.source_id,source_row:chosen.row,fields:{review_id:'brand-review-'+chosen.source_id,product_name:f.product_name,product_id:sourceId,product_uuid:id,affected_ids:sourceId,issue_type:'catalog_import',issue:issues.join('\n'),recommended_action:'Review source, product identity and full formula before publication or recommendations.',blocking_for_app:'YES'},status:'OPEN'});
    if(!current&&f.formula_status==='full_unverified'){
      const parsed=parseIngredients(f.ingredient_list);
      if(parsed.reason){reviews.at(-1).fields.issue+='\nIngredient parsing: '+parsed.reason;continue;}
      const seen=new Set();let invalid=false;const pending=[];
      for(const item of parsed.items){
        if(/https?:|\*|°|manufacturer|ingredient|available|published|full inci/i.test(item.name)){invalid=true;break;}
        const matches=ingredients.filter(i=>[i.name,i.inci_name,...(i.aliases??[])].filter(Boolean).some(n=>identity(n)===identity(item.name)));
        if(matches.length>1){invalid=true;break;}
        let ingredient=matches[0];if(!ingredient){ingredient={id:stableId('ingredient:'+identity(item.name)),name:item.name,inci_name:item.name,aliases:[]};ingredients.push(ingredient);newIngredients.push(ingredient);}
        if(seen.has(ingredient.id))continue;seen.add(ingredient.id);
        pending.push({product_id:id,ingredient_id:ingredient.id,ingredient_order:item.order,concentration:item.concentration,concentration_unit:item.concentration===null?null:'%',notes:'Unverified source transcription; '+chosen.source_id+'; '+item.section});
      }
      if(!invalid)ingredientLinks.push(...pending);
      else reviews.at(-1).fields.issue+='\nIngredient tokens require manual normalization; no associations created.';
    }
  }
  return {brands:brands.filter(b=>!backup.brands.some(old=>old.id===b.id)),products,records,reviews,ingredientLinks,newIngredients,sources:rows.map(r=>({...r,product_id:sourceProducts.get(r.source_id)})),report:{sourceRows:rows.length,canonicalProducts:products.length,newProducts:products.filter(p=>!p.existing).length,existingMatches:products.filter(p=>p.existing).length,mergedSourceRows:rows.length-products.length,newBrands:brands.length-backup.brands.length,reviews:reviews.length,newIngredients:newIngredients.length,newIngredientLinks:ingredientLinks.length,conflicts}};
}

export function buildBrandSql(prepared,snapshots){
  let sql='begin;\nset local standard_conforming_strings=on;\nselect pg_advisory_xact_lock(hashtext(\'substrate-catalog-import\'));\n';
  for(const s of snapshots)sql+=`insert into public.catalog_imports(id,source_url,source_modified_at,fetched_at,snapshot) values (${q('drive-'+s.source.id)},${q(s.source.url)},${q(s.source.modified_time)}::timestamptz,now(),${j(s)}) on conflict(id) do nothing;\n`;
  for(const b of prepared.brands)sql+=`insert into public.brands(id,name,slug) values (${q(b.id)},${q(b.name)},${q(b.slug)}) on conflict(id) do nothing;\n`;
  for(const p of prepared.products.filter(p=>!p.existing)){
    sql+=`insert into public.products(id,brand_id,name,slug,category,status,catalog_visible,product_type,is_bundle,variant_label,manufacturer_sku,price_amount,currency,availability,formula_status) values (${q(p.id)},${q(p.brand_id)},${q(p.name)},${q(p.slug)},${q(p.category)},'needs_review',false,${q(p.product_type)},${p.is_bundle},${p.variant_label?q(p.variant_label):'null'},${p.manufacturer_sku?q(p.manufacturer_sku):'null'},${p.price_amount??'null'},${p.currency?q(p.currency):'null'},${p.availability?q(p.availability):'null'},${q(p.formula_status)}) on conflict(id) do nothing;\n`;
  }
  for(const r of prepared.records)sql+=`insert into public.catalog_records(source_id,product_id,import_id,entity_type,fields) values (${q(r.source_id)},${q(r.product_id)},${q(r.import_id)},${q(r.entity_type)},${j(r.fields)}) on conflict(source_id) do nothing;\n`;
  for(const r of prepared.sources)sql+=`insert into public.catalog_sources(source_id,product_id,import_id,source_file_id,sheet_name,source_row,fields,raw_fields) values (${q(r.source_id)},${q(r.product_id)},${q('drive-'+r.source_file_id)},${q(r.source_file_id)},${q(r.sheet)},${r.row},${j(r.fields)},${j(r.raw)}) on conflict(source_id) do nothing;\n`;
  for(const r of prepared.reviews)sql+=`insert into public.catalog_reviews(id,source_row,fields,status) values (${q(r.id)},${r.source_row},${j(r.fields)},'OPEN') on conflict(id) do nothing;\n`;
  for(const i of prepared.newIngredients)sql+=`insert into public.ingredients(id,name,inci_name) values (${q(i.id)},${q(i.name)},${q(i.inci_name)}) on conflict(id) do nothing;\n`;
  for(const i of prepared.ingredientLinks)sql+=`insert into public.product_ingredients(product_id,ingredient_id,ingredient_order,concentration,concentration_unit,notes) values (${q(i.product_id)},${q(i.ingredient_id)},${i.ingredient_order},${i.concentration??'null'},${i.concentration_unit?q(i.concentration_unit):'null'},${q(i.notes)}) on conflict(product_id,ingredient_id) do nothing;\n`;
  return sql+'commit;\n';
}
export function buildBrandBatches(prepared,snapshots){
 const empty={brands:[],products:[],records:[],sources:[],reviews:[],newIngredients:[],ingredientLinks:[]};
 const batches=[];
 for(let i=0;i<snapshots.length;i+=10)batches.push({name:'snapshot-'+String(i/10).padStart(3,'0'),sql:buildBrandSql(empty,snapshots.slice(i,i+10))});
 batches.push({name:'shared-library',sql:buildBrandSql({...empty,brands:prepared.brands,newIngredients:prepared.newIngredients},[])});
 for(let i=0;i<prepared.products.length;i+=100){
  const products=prepared.products.slice(i,i+100);const ids=new Set(products.map(p=>p.id));
  batches.push({name:'products-'+String(i/100).padStart(3,'0'),sql:buildBrandSql({...empty,products,records:prepared.records.filter(r=>ids.has(r.product_id)),sources:prepared.sources.filter(r=>ids.has(r.product_id)),reviews:prepared.reviews.filter(r=>ids.has(r.fields.product_uuid)),ingredientLinks:prepared.ingredientLinks.filter(r=>ids.has(r.product_id))},[])});
 }
 return batches;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const backup=JSON.parse(readFileSync('data/catalog/live-backup-20260930.json')).rows[0].backup;
 const snapshots=JSON.parse(readFileSync('data/catalog/brand-workbook-snapshots.json'));
 const prepared=prepareBrandImport(JSON.parse(readFileSync('data/catalog/brand-staging.json')),backup,snapshots);
 writeFileSync('data/catalog/brand-import-prepared.json',JSON.stringify(prepared,null,2)+'\n');
 writeFileSync('data/catalog/brand-import-report.json',JSON.stringify(prepared.report,null,2)+'\n');
 writeFileSync('data/catalog/brand-import.sql',buildBrandSql(prepared,snapshots));
 mkdirSync('data/catalog/brand-import-batches',{recursive:true});
 const batches=buildBrandBatches(prepared,snapshots);
 for(const b of batches)writeFileSync('data/catalog/brand-import-batches/'+b.name+'.sql',b.sql);
 writeFileSync('data/catalog/brand-import-batches/manifest.json',JSON.stringify(batches.map(b=>({name:b.name,sha256:createHash('sha256').update(b.sql).digest('hex')})),null,2)+'\n');
 console.log(JSON.stringify({...prepared.report,conflicts:prepared.report.conflicts.length}));
}
