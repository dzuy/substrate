export const key = (s) => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export function parseIngredients(raw) {
  if (!raw || /NEEDS_MANUFACTURER|NOT VERIFIED|NOT APPLICABLE|\bPARTIAL\b|LEGACY FORMULA|PRIOR FORMULA|\[|\]|;|— see/i.test(raw)) return { reason: 'Missing, partial, historical, or annotated formula requires review', items: [] };
  let text = raw.replace(/^CURRENT FORMULA — (?=ACTIVE:)/i, '').replace(/^CURRENT[^:]*:\s*/i, '').replace(/^EU FORMULA:\s*/i, '');
  const split = text.match(/^(?:CURRENT FORMULA — )?ACTIVE:\s*([\s\S]+?)\.\s*INACTIVE(?:\s*\([^)]*\))?:\s*([\s\S]+)$/i);
  const sections = split ? [{text:split[1], active:true},{text:split[2], active:false}] : [{text, active:null}];
  const items=[];
  for (const section of sections) {
    let depth=0, start=0, tokens=[];
    for(let i=0;i<section.text.length;i++) {
      const c=section.text[i]; if(c==='(')depth++; if(c===')')depth--;
      if(depth<0)return {reason:'Unbalanced parentheses',items:[]};
      if(c===',' && depth===0 && !(/\d/.test(section.text[i-1]??'') && /\d/.test(section.text[i+1]??''))) {tokens.push(section.text.slice(start,i));start=i+1;}
    }
    if(depth)return {reason:'Unbalanced parentheses',items:[]};
    tokens.push(section.text.slice(start));
    for(let token of tokens) {
      token=token.trim().replace(/\.$/, '');
      let concentration=null;
      const percent=token.match(/\s*\(?(\d+(?:\.\d+)?)%\)?$/);
      if(percent) {concentration=Number(percent[1]);token=token.slice(0,percent.index).trim();}
      if(!token || /[:;\[\]—]|\b(?:confirmed|truncat|formula|sources|contains|not retrieved|see note)\b/i.test(token) || token.length>160 || /^\d+$/.test(token))return {reason:'Narrative or ambiguous ingredient token',items:[]};
      items.push({name:token,concentration,section:section.active===null?'INCI':section.active?'Active':'Inactive',order:items.length+1});
    }
  }
  return {items,reason:null};
}
