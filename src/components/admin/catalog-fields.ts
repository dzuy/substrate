export const evidenceSections = {
  formula: { label: 'Formula & sources', fields: ['product_url', 'image_url', 'ingredient_list', 'formula_verification_status', 'review_status', 'notes', 'variant_formulas', 'primary_market'] },
  directions: { label: 'Directions', fields: ['manufacturer_directions', 'time_of_day', 'frequency', 'post_open_shelf_life', 'water_resistance', 'application_format'] },
  evidence: { label: 'Evidence', fields: ['use_cases', 'key_technology_actives', 'substrate_status', 'tier', 'evidence_position_source', 'clinical_evidence_population', 'ladder_id', 'substitution_blockers'] },
  rules: { label: 'Rules', fields: ['layering_position', 'ramp_required', 'known_conflicts', 'substrate_usage_logic', 'mechanism_subtype', 'acid_form', 'formulation_pH', 'anhydrous', 'activation_required', 'photosensitivity_tail_days', 'chemical_incompatibility'] },
} as const;

const labels: Record<string, string> = {
  product_url: 'Official product URL', image_url: 'Source image URL', ingredient_list: 'Full ingredient list / INCI',
  formula_verification_status: 'Formula verification notes', review_status: 'Source review status',
  formulation_pH: 'Formulation pH', clinical_evidence_population: 'Clinical evidence population',
  primary_market: 'Primary market', key_technology_actives: 'Key technology & actives',
  evidence_position_source: 'Source evidence position', post_open_shelf_life: 'Shelf life after opening',
  photosensitivity_tail_days: 'Photosensitivity after stopping (days)', source_id: 'Source ID',
};
export function fieldLabel(value: string) {
  return labels[value] ?? value.replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase());
}
