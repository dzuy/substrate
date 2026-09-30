import unittest
from catalog_formula_notes import is_note_only, separate_ingredient_note
import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('catalog_stage',Path(__file__).with_name('catalog-stage.py'))
stage=importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)
normalize=stage.normalize

class IngredientNotesTest(unittest.TestCase):
    def test_notes_are_not_ingredients(self):
        for text in ['KEY INGREDIENTS — PARTIAL, NOT FULL INCI', 'INCI NOT PUBLISHED — DO NOT INFER', 'Full ingredient list not published on the accessible current official page.', 'FULL INCI — verified in Evereden official centralized INCI library', 'PARTIAL — 11 ingredients confirmed by count; full INCI not retrieved this pass.']:
            self.assertTrue(is_note_only(text), text)
            f=separate_ingredient_note({'ingredient_list':text,'ingredient_source_notes':'Earlier note'})
            self.assertEqual(f['ingredient_list'],'')
            self.assertEqual(f['ingredient_source_notes'],'Earlier note\n'+text)
            self.assertEqual(separate_ingredient_note(dict(f)),f)
    def test_actual_or_mixed_ingredients_are_preserved(self):
        for text in ['Water, Glycerin', 'PARTIAL — Water, Glycerin', 'NOT VERIFIED — full INCI not retrieved this pass. Active: 10% azelaic acid.', 'Official current collection identifies niacinamide, peptides and antioxidants but complete INCI was not captured in accessible text.', 'Petrolatum (100%)']:
            self.assertFalse(is_note_only(text),text)
            self.assertEqual(separate_ingredient_note({'ingredient_list':text})['ingredient_list'],text)
    def test_staging_sets_missing_and_keeps_notes(self):
        f=normalize({'Product Name':'Test Serum','Brand':'Test','Full INCI':'KEY INGREDIENTS — PARTIAL, NOT FULL INCI','Ingredient List Status':'Partial'},{'title':'Test'})
        self.assertEqual(f['formula_status'],'missing'); self.assertEqual(f['ingredient_list'],''); self.assertTrue(f['ingredient_source_notes'])
    def test_device_stays_not_applicable(self):
        f=normalize({'Product Name':'LED Device','Brand':'Test','Full INCI':'N/A — DEVICE'},{'title':'Test'})
        self.assertEqual(f['formula_status'],'not_applicable'); self.assertEqual(f['ingredient_list'],'')

if __name__=='__main__': unittest.main()
