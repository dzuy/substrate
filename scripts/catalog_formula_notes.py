"""Recognize source-status prose with no ingredient names; preserve mixed entries."""
import re

# Anchored patterns deliberately exclude notes that also name actual ingredients.
NOTE_ONLY_PATTERNS = [
    r'KEY INGREDIENTS\s*[—–-]\s*PARTIAL,?\s*NOT FULL INCI',
    r'INCI NOT PUBLISHED\s*[—–-]\s*DO NOT INFER',
    r'FULL INCI\s*[—–-]\s*verified in Evereden official centralized INCI library',
    r'NEEDS_MANUFACTURER_VERIFICATION',
    r'DRUG FACTS ACTIVES VERIFIED\s*[—–-]\s*FULL INACTIVE INCI REQUIRES BACKFILL',
    r'NOT VERIFIED\s*[—–-]\s*(?:record newly created, INCI not yet sourced|(?:full INCI not retrieved this pass|full INCI not published by any source located|no ingredient list located this pass)\.?)(?:\s*Third-party count:\s*\d+ ingredients\.?)?',
    r'PARTIAL\s*[—–-]\s*\d+ ingredients confirmed by count; full INCI not retrieved this pass\.?',
    r'Full ingredient list not published on the accessible current official page\.?',
    r'(?:Complete|Full)(?: current)?(?: official)?(?: current)?(?: ordered)? INCI (?:was )?not (?:completely )?captured in accessible (?:current )?(?:official )?(?:collection |product/search |page |search )?text(?: during this pass)?\.?',
    r'Official manufacturer full INCI not captured in accessible source\.?',
    r'Official current (?:page|pages|product page) (?:exposes?|provides?) key ingredients(?: and claims| and marketing functions| and their marketing functions)?(?: but |, but | and use but )(?:(?:a )?complete(?: ordered)? INCI|complete ordered INCI) (?:was )?not captured in accessible (?:current )?(?:page )?text\.?',
    r'Official (?:current )?page (?:publishes named key ingredients and their marketing functions, but does not expose|exposes key ingredients and marketing functions but not) a complete ordered INCI in accessible current text\.?',
    r'Official site confirms principal formula components, but complete current INCI was not captured in accessible text during this pass\.?',
    r'Official product identity and aromatic profile verified; complete current official INCI not captured in accessible text during this pass\.?',
    r'N/A(?:\s*/\s*treatment-specific|\s*[—–-]\s*(?:DEVICE(?:\s*/\s*TOOL)?|TOOL|TEXTILE ACCESSORY))',
    r'NOT APPLICABLE\s*[—–-]\s*(?:generic family reference|generic category(?:, not a specific SKU)?|Rx (?:reference|molecule reference); vehicle varies by manufacturer|in-clinic procedure, not a retail product|hydrocolloid dressing; no formulated INCI|extraction artifact|Rx product; vehicle and labelling are prescriber- and manufacturer-specific|brand reference, not a SKU)',
]
NOTE_ONLY_REGEX = r'^(?:' + '|'.join(NOTE_ONLY_PATTERNS) + r')$'

def is_note_only(value):
    text = re.sub(r'\s+', ' ', str(value or '')).strip()
    return bool(text and re.fullmatch(NOTE_ONLY_REGEX, text, re.I))

def separate_ingredient_note(fields):
    value = fields.get('ingredient_list', '')
    if is_note_only(value):
        previous = fields.get('ingredient_source_notes', '')
        fields['ingredient_source_notes'] = '\n'.join(x for x in [previous, value] if x)
        fields['ingredient_list'] = ''
    return fields
