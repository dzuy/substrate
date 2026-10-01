import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {key,parseIngredients} from '../src/lib/inci-parser.mjs';

// Library extraction accepts partial lists without claiming a complete product formula.
export function extractLibraryNames(raw) {
  if (!raw?.trim()) return {names:[],review:[]};
  let text=raw.trim().replace(/^(?:PARTIAL\s*[—–-]\s*)?(?:opening confirmed|key actives confirmed|actives and key ingredients only|key actives only|from a BIOEFFECT set listing):\s*/i,'')
    .replace(/^PARTIAL\s*[—–-]\s*/i,'').replace(/^(?:LEGACY FORMULA(?:\s*\([^)]*\))?|PRIOR FORMULA|US\/CURRENT FORMULA):\s*/i,'')
    .replace(/Active Ingredients:/gi,'ACTIVE:').replace(/Inactive Ingredients:/gi,'INACTIVE:');
  text=text.replace(/\s*[*°]+/g,'').replace(/\s*\((?:\*?organic|plant-derived[^)]*|vegetable-derived[^)]*|coconut-derived[^)]*|olive-derived[^)]*|naturally-occurring[^)]*|sunflower vitamin e)\)/gi,'');
  const full=parseIngredients(text);
  if (!full.reason && !full.items.some(i=>isNarrative(i.name))) return {names:full.items.map(i=>i.name),review:[]};
  text=text.replace(/\[(?:full |remaining |list |remainder |PLUS )[^\]]*\]/gi,'').replace(/\(formula code [^)]*\)/gi,'')
    .replace(/\(formerly listed [^)]*\)/gi,'').replace(/\s*[—–]\s*(?:AS SHOWN|see verification)[\s\S]*$/i,'')
    .replace(/\bACTIVE:\s*/gi,'').replace(/\.\s*INACTIVE(?:\s*\([^)]*\))?:\s*/gi,', ');
  const names=[],review=[];
  let depth=0,start=0;
  const tokens=[];
  for(let n=0;n<text.length;n++) {
    if(text[n]==='(')depth++; if(text[n]===')')depth--;
    if(text[n]===','&&depth===0&&!(/\d/.test(text[n-1]??'')&&/\d/.test(text[n+1]??''))){tokens.push(text.slice(start,n));start=n+1;}
  }
  tokens.push(text.slice(start));
  for(let token of tokens) {
    token=token.trim().replace(/^(?:encapsulated|organic)\s+/i,'').replace(/^\d+(?:\.\d+)?%\s*/,'').replace(/\.\s*(?:FULL INCI|Full INCI|Confirm against)[\s\S]*$/,'');
    const parsed=parseIngredients(token);
    if(parsed.reason||parsed.items.length!==1||isNarrative(parsed.items[0]?.name??'')) {if(token)review.push(token);continue;}
    names.push(parsed.items[0].name);
  }
  return {names,review};
}
function isNarrative(name) {
  return /https?:|[\[\]“”"]|\b(?:INCI|ingredients?|partial|not|retrieved|published|confirmed|formula|pass|brand|stated|plus|also|additional|independently|list|sources?|available|requires?|same|based|with|per|though|exact|position|concentration|contains?|full|manufactur|verify|missing|unknown|unavailable|complexes|confirm|standalone|listing|shade|vary|official|collection|identifies|technology|system|architecture|strength|blend|product|forms|peptides|ferments|antioxidants)\b|[;:—]|\b(?:and|only|from|at|in|for|by)\b/i.test(name)||/^(?:D|VP|SAP|SOD|HA|glycolic|tartaric|Grass-fed|Olive|botanical extracts|fruit extracts|shea|oat|five HA forms|four HA forms|multiple HA forms)$/i.test(name)||/\boils\b|\bacids\b.*\/|\/.*\bacids\b/i.test(name)||name.length>160||!/[a-z]/i.test(name);
}
export function prepareLibrary(snapshot) {
  const known=new Set(snapshot.ingredients.flatMap(i=>[i.name,i.inci_name,...(i.aliases??[])].filter(Boolean).map(key)));
  const additions=new Map(),review=[];
  for(const r of snapshot.records) {
    const parsed=extractLibraryNames(r.ingredient_list);
    if(parsed.review.length)review.push({source_id:r.source_id,tokens:parsed.review});
    for(const name of parsed.names)if(!known.has(key(name))&&!additions.has(key(name)))additions.set(key(name),name);
  }
  return {names:[...additions.values()],review};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const snapshot=JSON.parse(readFileSync('data/catalog/live-backup-library-20260930.json')).rows[0].snapshot;
 const prepared=prepareLibrary(snapshot);
 writeFileSync('data/catalog/library-expansion-report.json',JSON.stringify(prepared,null,2));
 console.log(JSON.stringify({existing:snapshot.ingredients.length,additions:prepared.names.length,reviewRecords:prepared.review.length,names:prepared.names},null,2));
}
