"""Read-only XLSX -> immutable knowledge snapshot. Python 3 standard library only.
Usage: python3 prototypes/face-scan/import-workbook.py FILE.xlsx [--activate]
Imports stage by default; activation is explicit and never rewrites old snapshots.
"""
import argparse, hashlib, json, pathlib, re, zipfile, xml.etree.ElementTree as ET
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
ROOT=pathlib.Path(__file__).resolve().parent/'knowledge'
TABLES={'conditions':('01_CONDITIONS','Condition_ID'),'pathways':('02_PATHWAYS','Pathway_ID'),'ingredients':('03_INGREDIENTS','Ingredient_ID'),'conditionPathways':('04_CONDITION_PATHWAY','Condition_ID'),'pathwayIngredients':('05_PATHWAY_INGREDIENT','Pathway_ID'),'modifiers':('06_SIGNAL_MODIFIERS','Signal_ID'),'governors':('07_GOVERNORS','Governor_ID'),'memberState':('08_MEMBER_STATE','Field_Group'),'stages':('09_DECISION_ENGINE_V2','Stage'),'outcomes':('10_OUTCOME_LEARNING','Experiment_ID'),'sources':('11_SOURCES','Source_ID'),'evidence':('12_EVIDENCE_OBJECTS','Evidence_ID'),'expressions':('13_PRODUCT_INGR_EXPRESSION','Expression_ID'),'products':('14_PRODUCT_REALITY','Product_ID'),'wardrobe':('15_WARDROBE_COVERAGE','Member_ID'),'load':('16_COVERAGE_VS_LOAD','Member_ID'),'actions':('17_MIN_EFFECTIVE_CHANGE','Priority'),'personalEvidence':('18_PERSONAL_EVIDENCE','Personal_Evidence_ID'),'clinicalRules':('19_CLINICAL_RULE_REGISTRY','Rule_ID'),'firewall':('20_EVIDENCE_FIREWALL','Firewall_Rule_ID'),'admissions':('21_EVIDENCE_ADMISSION','Admission_ID'),'expressionSpec':('22_EXPRESSION_ID_SPEC','Field'),'tests':('23_RULE_TESTS','Test_ID')}
REQUIRED={'conditions':['Condition / Goal','Type','Primary Pathways','Clinician Gate?'],'pathways':['Pathway'],'ingredients':['Canonical Ingredient','Form / Variant','Evidence Tier'],'conditionPathways':['Pathway_ID','Base_Relevance_0_3','Phenotype Trigger'],'pathwayIngredients':['Ingredient_ID','Evidence_0_3','Direction','Evidence_IDs'],'evidence':['Source_ID','Endpoint','Evidence_0_3'],'clinicalRules':['Status','Approved State','Version'],'sources':['URL'],'governors':['Trigger','Action','Priority']}
def extract(path):
 with zipfile.ZipFile(path) as z:
  if sum(i.file_size for i in z.infolist())>50_000_000: raise ValueError('Workbook exceeds 50 MB expanded limit')
  strings=[]
  if 'xl/sharedStrings.xml' in z.namelist(): strings=[''.join(e.itertext()) for e in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',NS)]
  rel={e.attrib['Id']:e.attrib['Target'] for e in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
  out={}
  for sheet in ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet',NS):
   target=rel[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
   target=target.lstrip('/') if target.startswith('/') else 'xl/'+target
   rows=[]
   for row in ET.fromstring(z.read(target)).findall('m:sheetData/m:row',NS):
    cells={}
    for c in row.findall('m:c',NS):
     coord=c.attrib['r']; val=c.find('m:v',NS); typ=c.attrib.get('t'); value=val.text if val is not None else None
     if c.find('m:f',NS) is not None: raise ValueError('Formula cells require a reviewed schema adapter: '+sheet.attrib['name']+'!'+coord)
     if typ=='s' and value is not None: value=strings[int(value)]
     elif typ=='inlineStr': value=''.join(c.find('m:is',NS).itertext())
     elif value is not None and typ not in ['str','e']:
      try: value=float(value); value=int(value) if value.is_integer() else value
      except ValueError: pass
     if value is not None: cells[re.sub(r'\d','',coord)]=value
    if cells: rows.append({'row':int(row.attrib['r']),'cells':cells})
   out[sheet.attrib['name']]=rows
 return out

def prepare(path, previous=None):
 raw=extract(path); tables={}; errors=[]; warnings=[]; schemas={}
 for key,(sheet,idcol) in TABLES.items():
  rows=raw.get(sheet,[]); header=next((r for r in rows if idcol in r['cells'].values()),None)
  if not header: errors.append('Missing table/header: '+sheet); continue
  keycol=next(col for col,name in header['cells'].items() if name==idcol)
  names=list(header['cells'].values()); schemas[key]=names
  if len(names)!=len(set(names)): errors.append('Duplicate headers in '+sheet)
  for field in REQUIRED.get(key,[]):
   if field not in names: errors.append('Missing required column '+sheet+': '+field)
  tables[key]=[{**{name:r['cells'].get(col) for col,name in header['cells'].items()},'_source':{'sheet':sheet,'row':r['row']}} for r in rows if r['row']>header['row'] and r['cells'].get(keycol) is not None]
  if previous:
   missing=set(previous['schemas'].get(key,[]))-set(names)
   if missing: errors.append('Removed/renamed columns need adapter: '+sheet+' '+str(sorted(missing)))
 for key in ['conditions','pathways','ingredients','sources','evidence','clinicalRules','governors','tests','admissions','products','expressions']:
  idcol=TABLES[key][1]; ids=[r[idcol] for r in tables.get(key,[])]
  if len(ids)!=len(set(ids)): errors.append('Duplicate IDs: '+key)
 def check(table,field,target,idfield,multi=False):
  ids={r[idfield] for r in tables.get(target,[])}
  for r in tables.get(table,[]):
   v=r.get(field); values=[x.strip() for x in str(v).split(';')] if multi and v else ([v] if v else [])
   for value in values:
    if value not in ids: errors.append(f"Broken reference {table}:{r['_source']['row']} {field}={value}")
 for table,field,target,idfield in [('conditionPathways','Condition_ID','conditions','Condition_ID'),('conditionPathways','Pathway_ID','pathways','Pathway_ID'),('pathwayIngredients','Pathway_ID','pathways','Pathway_ID'),('pathwayIngredients','Ingredient_ID','ingredients','Ingredient_ID'),('evidence','Source_ID','sources','Source_ID'),('expressions','Product_ID','products','Product_ID'),('expressions','Ingredient_ID','ingredients','Ingredient_ID')]: check(table,field,target,idfield)
 check('pathwayIngredients','Evidence_IDs','evidence','Evidence_ID',True)
 for table,field in [('conditionPathways','Base_Relevance_0_3'),('pathwayIngredients','Evidence_0_3')]:
  pairs=[]
  for r in tables.get(table,[]):
   value=r.get(field)
   if value is not None and (not isinstance(value,(int,float)) or not 0<=value<=3): errors.append('Invalid 0–3 score: '+table)
   pair=(r.get('Condition_ID',r.get('Pathway_ID')),r.get('Pathway_ID') if table=='conditionPathways' else r.get('Ingredient_ID'))
   if pair in pairs: errors.append('Duplicate relationship '+str(pair))
   pairs.append(pair)
 mapped={r['Condition_ID'] for r in tables.get('conditionPathways',[])}
 missing=[r['Condition_ID'] for r in tables.get('conditions',[]) if r['Condition_ID'] not in mapped]
 warnings+=['No explicit condition edges: '+', '.join(missing)] if missing else []
 absent=[r for r in tables.get('pathwayIngredients',[]) if not r.get('Evidence_IDs')]
 warnings.append(str(len(absent))+' ingredient edges lack evidence references')
 changes={}
 if previous:
  for key,rows in tables.items():
   def keyed(items):
    return {str(r.get(TABLES[key][1]))+(':'+str(r.get('Pathway_ID')) if key=='conditionPathways' else ':'+str(r.get('Ingredient_ID')) if key=='pathwayIngredients' else ':'+str(i) if key in ['wardrobe','load','memberState'] else ''):{k:v for k,v in r.items() if k!='_source'} for i,r in enumerate(items)}
   a=keyed(previous['tables'].get(key,[])); b=keyed(rows)
   changes[key]={'added':[k for k in b if k not in a],'removed':[k for k in a if k not in b],'changed':[k for k in a if k in b and a[k]!=b[k]]}
 digest=hashlib.sha256(path.read_bytes()).hexdigest(); version='workbook-'+digest[:16]
 data={'schemaVersion':1,'version':version,'sourceFile':path.name,'sha256':digest,'schemas':schemas,'tables':tables,'rawSheets':raw}
 report={'version':version,'previousVersion':previous.get('version') if previous else None,'counts':{k:len(v) for k,v in tables.items()},'errors':errors,'warnings':warnings,'changes':changes,'unmappedConditions':missing,'activation':'blocked' if errors else 'ready for explicit activation'}
 return data,report

def main():
 parser=argparse.ArgumentParser(); parser.add_argument('workbook',type=pathlib.Path); parser.add_argument('--activate',action='store_true'); parser.add_argument('--policy-reviewed',action='store_true',help='Acknowledge that changed rule/schema interpretations were reviewed and implemented'); args=parser.parse_args()
 ROOT.mkdir(exist_ok=True); (ROOT/'versions').mkdir(exist_ok=True)
 active=ROOT/'active.json'; previous=json.loads(active.read_text()) if active.exists() else None
 data,report=prepare(args.workbook,previous)
 policy_tables=['governors','clinicalRules','stages','modifiers','firewall','admissions','actions','tests']
 needs_review=[key for key in policy_tables if any(report['changes'].get(key,{}).values())]
 report['policyReviewRequired']=needs_review
 if args.activate and needs_review and not args.policy_reviewed:
  report['errors'].append('Rule changes require implementation review before activation: '+', '.join(needs_review))
  report['activation']='blocked until policy review'
 stage=ROOT/'versions'/data['version']; stage.mkdir(exist_ok=True)
 (stage/'report.json').write_text(json.dumps(report,indent=2)+'\n')
 if not report['errors']:
  snapshot=stage/'knowledge.json'
  if snapshot.exists() and json.loads(snapshot.read_text())!=data: raise ValueError('Immutable snapshot collision')
  snapshot.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
  if args.activate:
   temp=ROOT/'active.tmp'; temp.write_text(snapshot.read_text()); temp.replace(active)
 print(json.dumps({'version':data['version'],'report':str(stage/'report.json'),'activated':args.activate and not report['errors'],'errors':report['errors'],'warnings':report['warnings']},indent=2))
 if report['errors']: raise SystemExit(1)
if __name__=='__main__': main()
