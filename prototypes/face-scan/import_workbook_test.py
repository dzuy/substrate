"""Import compatibility tests use mocked extraction; never edit the user's source workbook."""
import importlib.util, pathlib, tempfile, unittest, json
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('importer',pathlib.Path(__file__).with_name('import-workbook.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
active=json.loads((m.ROOT/'active.json').read_text())
class ImportTests(unittest.TestCase):
 def prepare(self,raw):
  with tempfile.NamedTemporaryFile(suffix='.xlsx') as f:
   f.write(b'test');f.flush()
   with patch.object(m,'extract',return_value=raw): return m.prepare(pathlib.Path(f.name),active)
 def test_reordered_columns_and_rows(self):
  raw=json.loads(json.dumps(active['rawSheets']))
  for row in raw['03_INGREDIENTS']:
   c=row['cells'];a=c.pop('A',None);b=c.pop('B',None)
   if a is not None:c['B']=a
   if b is not None:c['A']=b
  data,report=self.prepare(raw)
  self.assertEqual(report['errors'],[]);self.assertEqual(data['tables']['ingredients'][0]['Ingredient_ID'],'I_AZA')
 def test_missing_column_blocks(self):
  raw=json.loads(json.dumps(active['rawSheets']));raw['03_INGREDIENTS'][2]['cells'].pop('B')
  _,report=self.prepare(raw);self.assertTrue(report['errors'])
 def test_broken_reference_blocks(self):
  raw=json.loads(json.dumps(active['rawSheets']));raw['05_PATHWAY_INGREDIENT'][3]['cells']['B']='I_MISSING'
  _,report=self.prepare(raw);self.assertTrue(any('Broken reference' in e for e in report['errors']))
 def test_changes_and_added_columns_reported(self):
  raw=json.loads(json.dumps(active['rawSheets']));raw['03_INGREDIENTS'][2]['cells']['K']='Future field';raw['03_INGREDIENTS'][3]['cells']['B']='Updated name'
  data,report=self.prepare(raw);self.assertEqual(report['errors'],[]);self.assertIn('I_AZA',report['changes']['ingredients']['changed']);self.assertIn('Future field',data['schemas']['ingredients'])
if __name__=='__main__':unittest.main()
