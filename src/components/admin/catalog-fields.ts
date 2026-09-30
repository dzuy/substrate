export const evidenceSections = {
  commercial: { label: 'Product details', fields: ['product_type', 'is_bundle', 'variant', 'primary_market', 'manufacturer_sku', 'price_amount', 'currency', 'price_raw', 'availability'] },
  formula: { label: 'Formula & sources', fields: ['product_url', 'image_url', 'ingredient_list', 'formula_status', 'ingredient_status_source', 'formula_verification_status', 'review_status', 'notes', 'variant_formulas', 'supporting_evidence'] },
  directions: { label: 'Directions', fields: ['manufacturer_directions', 'time_of_day', 'frequency', 'post_open_shelf_life', 'water_resistance', 'application_format'] },
  evidence: { label: 'Evidence', fields: ['use_cases', 'key_technology_actives', 'substrate_status', 'tier', 'evidence_position_source', 'clinical_evidence_population', 'ladder_id', 'substitution_blockers'] },
  rules: { label: 'Rules', fields: ['layering_position', 'ramp_required', 'known_conflicts', 'substrate_usage_logic', 'mechanism_subtype', 'acid_form', 'formulation_pH', 'anhydrous', 'activation_required', 'photosensitivity_tail_days', 'chemical_incompatibility'] },
} as const;

const labels: Record<string, string> = {
  product_url: 'Official product URL', image_url: 'Source image URL', ingredient_list: 'Full ingredient list / INCI',
  formula_verification_status: 'Formula verification notes', review_status: 'Source review status',
  formulation_pH: 'Formulation pH', clinical_evidence_population: 'Clinical evidence population',
  primary_market: 'Primary market', key_technology_actives: 'Key technology & actives',
  product_type: 'Product type', is_bundle: 'Bundle or kit', variant: 'Size / sellable variant',
  price_amount: 'Price amount', currency: 'Currency (USD, GBP, CHF…)', price_raw: 'Original source price',
  manufacturer_sku: 'Manufacturer SKU', availability: 'Source availability', formula_status: 'Ingredient completeness',
  supporting_evidence: 'Supporting source rows', ingredient_status_source: 'Original ingredient status',
  evidence_position_source: 'Source evidence position', post_open_shelf_life: 'Shelf life after opening',
  photosensitivity_tail_days: 'Photosensitivity after stopping (days)', source_id: 'Source ID',
};
export function fieldLabel(value: string) {
  return labels[value] ?? value.replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase());
}
