"""Normalize brand workbook rows without inventing product or ingredient facts."""
import collections
import hashlib
import json
import re
from pathlib import Path
from catalog_formula_notes import separate_ingredient_note

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/catalog'
def key(value):
    return re.sub(r'[^a-z0-9]', '', str(value or '').lower())

ALIASES = {
 'product_name':['Product Name','Product','product_name'],
 'brand':['Brand'],
 'source_category':['Category','Category / Line / Collection'],
 'variant':['Size / Variant','Variant / Size','Variant'],
 'product_url':['Official Product URL','Official URL','Product URL'],
 'price_raw':['Current Price','Current Price (USD)','Price (USD)','Price'],
 'currency':['Currency'],
 'manufacturer_sku':['Manufacturer SKU / Product Code','SKU / Product ID','SKU (Manufacturer)','SKU'],
 'barcode':['Barcode'],
 'ingredient_list':['Full INCI','Full INCI / Ingredients','Full INCI / Published Ingredients','Full INCI / Ingredient Notes','Full INCI / Ingredient Status'],
 'ingredient_status_source':['Ingredient-List Status','Ingredient List Status'],
 'manufacturer_directions':['Manufacturer Directions / Frequency','Directions / Frequency','How to Use','Session Timing / Frequency'],
 'manufacturer_claim':['Evidence / Claims Notes','Manufacturer Claim / Positioning','Claims / Evidence Notes'],
 'use_cases':['Primary Use','Primary Use Cases'],
 'key_technology_actives':['Key Actives / Technology','Technology / Modality'],
 'known_conflicts':['Layering / Conflict / Safety Notes','Layering / Conflict Notes','Safety / SUBSTRATE Logic','Contraindications / Safety'],
 'availability':['Lifecycle Status / Availability','Lifecycle Status','Lifecycle / Availability','Lifecycle / Catalog Status','Catalog Status','product_status'],
 'notes':['Source / Audit Notes','Notes','Source Notes'],
 'source_checked':['Source Checked','last_verified'],
}
def normalize(raw, source):
    indexed = {key(k):v for k,v in raw.items()}
    fields = {field:next((str(indexed[key(a)]).strip() for a in aliases if indexed.get(key(a)) is not None), '') for field,aliases in ALIASES.items()}
    if not fields['brand']:
        fields['brand'] = re.sub(r'_Product_Database.*|_Device_Database.*|\.xlsx$|\(\d+\)|_REVISED$', '', source['title'].replace('SUBSTRATE_',''), flags=re.I).replace('_',' ')
    text = (fields['source_category']+' '+fields['product_name']).lower()
    if re.search(r'\boral\b|\bingestible\b|\bdaily skin supplement\b',text):typ='supplement'
    elif re.search(r'\bdevice\b|microcurrent|\bled\b|dermaplaning|humidifier',text) and not re.search(r'\bserum\b|\bcleanser\b|\bmist\b|\bgel\b|\bcr[eè]me\b',text):typ='device'
    elif re.search(r'\bhair\b|\bscalp\b|\bshampoo\b|\bconditioner\b',text) and not re.search(r'\btoner\b|\bingrown\b',text):typ='hair_scalp'
    elif re.search(r'\bfoundation\b|\bmascara\b|\blipstick\b|\bconcealer\b|\bbrow\b|\blash\b|\bprimer\b|skincare.makeup|makeup.skincare|setting (?:spray|mist)',text):typ='cosmetic'
    elif re.search(r'\baccessory\b|\btools\b|\bbrush\b|\btowel\b|\bcloths\b|\bmat\b|blotting paper',text):typ='accessory'
    else:typ='topical'
    bundle = bool(re.search(r'\bkit\b|\bbundle\b|\bduo\b|\bset\b|\bsystem\b',text))
    cat='other'
    for pattern,category in [(r'cleanser|cleansing|face wash','cleanser'),(r'sunscreen|\bspf\b','spf'),(r'toner','toner'),(r'essence','essence'),(r'moisturi|cream|lotion|balm','moisturizer'),(r'serum','serum'),(r'mask','mask'),(r'face oil|facial oil','oil'),(r'peel|exfolia','exfoliant'),(r'retinol|retinoid','retinoid'),(r'treatment','treatment')]:
        if re.search(pattern,text):cat=category;break
    if typ=='device':cat='device'
    separate_ingredient_note(fields)
    formula=fields['ingredient_list'];status=fields['ingredient_status_source']
    if not formula:completeness='missing'
    elif re.search(r'partial|key ingredient|not full|not captured|not verified|not available|not retrieved',formula+' '+status,re.I):completeness='partial'
    elif re.search(r'full inci|complete',status,re.I) and len(formula)>80 and formula.count(',')>=5:completeness='full_unverified'
    else:completeness='unresolved'
    if typ in ('device','accessory'):completeness='not_applicable'
    price=fields['price_raw'];amount=None
    m=re.fullmatch(r'\s*(?:USD\s*|\$\s*)?(\d+(?:\.\d{1,2})?)\s*',price)
    if m and float(m[1])>0:amount=float(m[1])
    currency=fields['currency'] or ('USD' if any('usd' in k.lower() for k in raw if 'price' in k.lower()) else '')
    fields.update({'product_type':typ,'is_bundle':str(bundle).lower(),'category':cat,'formula_status':completeness,'price_amount':str(amount) if amount else '', 'currency':currency,'formula_verification_status':'Needs review','review_status':'needs_review'})
    return fields

def stage():
    snapshots=json.loads((DATA/'brand-workbook-snapshots.json').read_text())
    digest_groups=collections.defaultdict(list)
    for snapshot in snapshots:digest_groups[snapshot['sha256']].append(snapshot)
    records=[];issues=[];reports=[]
    for digest,copies in digest_groups.items():
        snapshot=sorted(copies,key=lambda s:s['source']['created_time'])[0]
        tables=[];count=0
        for sheet in snapshot['sheets']:
            for offset,header in enumerate(sheet['rows']):
                header_keys={key(v) for v in header}
                if not header_keys.intersection({'productname','product','productname'}) or not any('url' in h for h in header_keys) or not any('category' in h for h in header_keys):continue
                tables.append({'sheet':sheet['title'],'headerRow':offset+1})
                for index,row in enumerate(sheet['rows'][offset+1:],offset+2):
                    raw={str(h):row[j] if j<len(row) else None for j,h in enumerate(header) if h is not None and str(h).strip()}
                    fields=normalize(raw,snapshot['source'])
                    if not fields['product_name'] or fields['product_name'].lower() in ('total','product','product name'):continue
                    if not fields['product_url'].startswith(('http://','https://')):
                        issues.append({'source':snapshot['source']['id'],'sheet':sheet['title'],'row':index,'reason':'Missing exact product URL','raw':raw})
                    locator=f"{sheet['title']}:{index}"
                    source_id='DRV-'+snapshot['source']['id']+'-'+hashlib.sha256(locator.encode()).hexdigest()[:12]
                    fields.update({'product_id':source_id,'source_id':source_id})
                    supporting=[]
                    for extra in snapshot['sheets']:
                        if extra['title']==sheet['title']:continue
                        for extra_index,extra_row in enumerate(extra['rows'],1):
                            if any(key(v)==key(fields['product_name']) for v in extra_row if v):
                                supporting.append({'sheet':extra['title'],'row':extra_index,'values':extra_row})
                    fields['supporting_evidence']=json.dumps(supporting,ensure_ascii=False)
                    # Explicit full lists can live in a claims cell or a matched Notes row.
                    # Preserve the entire original cell separately; never infer from key actives.
                    if not fields['ingredient_list']:
                        cells=list(raw.values())+[v for extra in supporting for v in extra['values']]
                        for value in cells:
                            match=re.search(r'\bFULL INCI\s*[:—–-]\s*(.+)',str(value or ''),re.I)
                            if not match:continue
                            formula=re.split(r'\.\s+(?:Key biology|Tolerability|Key actives|Safety|Notes)\s*:',match[1],flags=re.I)[0].strip().rstrip('.')
                            if formula.count(',')>=5 and not re.search(r'not captured|not available|not retrieved|partial',formula,re.I):
                                fields['ingredient_list']=formula
                                fields['ingredient_status_source']='Explicit FULL INCI transcription in source evidence'
                                fields['formula_status']='full_unverified'
                                break
                    records.append({'source_id':source_id,'source_file_id':snapshot['source']['id'],'copy_file_ids':[c['source']['id'] for c in copies], 'sha256':digest,'sheet':sheet['title'],'row':index,'fields':fields,'raw':raw})
                    count+=1
                break
        # Summary-only adjacent items are still retained, with missing identity/formula flagged.
        if re.search(r'LALAIS',snapshot['source']['title'],re.I):
            for sheet in snapshot['sheets']:
                if sheet['title']!='Catalog Summary':continue
                for index,row in enumerate(sheet['rows'][1:],2):
                    if len(row)<5 or row[2]!='No':continue
                    raw=dict(zip(['Product','Category','Canonical Topical?','Price (USD)','Disposition'],row))
                    fields=normalize(raw,snapshot['source'])
                    source_id='DRV-'+snapshot['source']['id']+'-'+hashlib.sha256(f"{sheet['title']}:{index}".encode()).hexdigest()[:12]
                    fields.update({'product_id':source_id,'source_id':source_id,'supporting_evidence':'[]'})
                    records.append({'source_id':source_id,'source_file_id':snapshot['source']['id'],'copy_file_ids':[c['source']['id'] for c in copies],'sha256':digest,'sheet':sheet['title'],'row':index,'fields':fields,'raw':raw})
                    count+=1
                    issues.append({'source':snapshot['source']['id'],'sheet':sheet['title'],'row':index,'reason':'Summary-only adjacent item; exact URL and sellable identity need verification'})
        if not tables:issues.append({'source':snapshot['source']['id'],'reason':'No main product header recognized'})
        reports.append({'title':snapshot['source']['title'],'id':snapshot['source']['id'],'copies':len(copies),'products':count,'tables':tables})
    # Candidate groups expose potential overlaps; they are not automatic merge instructions.
    candidates=collections.defaultdict(list)
    for r in records:
        f=r['fields'];candidates[(key(f['brand']),key(f['product_name']))].append(r['source_id'])
    summary={'files':len(snapshots),'uniqueWorkbooks':len(digest_groups),'duplicateUploads':len(snapshots)-len(digest_groups),'sourceProductRows':len(records),'formulaStatuses':dict(collections.Counter(r['fields']['formula_status'] for r in records)),'productTypes':dict(collections.Counter(r['fields']['product_type'] for r in records)),'workbooks':reports,'issues':issues,'nameOverlapCandidates':[{'brand':b,'name':n,'source_ids':ids} for (b,n),ids in candidates.items() if len(ids)>1]}
    (DATA/'brand-staging.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
    (DATA/'brand-staging-report.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in summary.items() if k not in ('workbooks','issues','nameOverlapCandidates')}))
    print('Issues:',len(issues),'Overlap groups:',len(summary['nameOverlapCandidates']))
    for i in issues:print(json.dumps(i)[:300])

if __name__=='__main__':stage()
