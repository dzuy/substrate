import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Card, SubstrateText } from '@/components/substrate-ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import type { CatalogRecord, CatalogReview } from '@/services/catalog-cms';
import { listCatalogHistory, saveCatalogReview } from '@/services/catalog-cms';
import type { Database } from '@/types/database';

const groups: Record<string, string[]> = {
  'Formula and sources': ['product_url', 'image_url', 'ingredient_list', 'formula_verification_status', 'review_status', 'notes', 'variant_formulas', 'primary_market'],
  'Directions and format': ['manufacturer_directions', 'time_of_day', 'frequency', 'post_open_shelf_life', 'water_resistance', 'application_format'],
  'Classification and evidence': ['use_cases', 'key_technology_actives', 'substrate_status', 'tier', 'evidence_position_source', 'clinical_evidence_population', 'ladder_id', 'substitution_blockers'],
  'Rules awaiting review': ['layering_position', 'ramp_required', 'known_conflicts', 'substrate_usage_logic', 'mechanism_subtype', 'acid_form', 'formulation_pH', 'anhydrous', 'activation_required', 'photosensitivity_tail_days', 'chemical_incompatibility'],
};

export function CatalogEvidenceEditor({ record, onChange }: { record: CatalogRecord; onChange: (record: CatalogRecord) => void }) {
  const [expanded, setExpanded] = useState('Formula and sources');
  return <View style={styles.stack}>
    <SubstrateText variant="section">Product evidence · {record.source_id}</SubstrateText>
    <SubstrateText variant="small" color={Colors.light.textMuted}>
      {record.entity_type} · {record.fields.all_masters}
    </SubstrateText>
    <SubstrateText variant="small" color={Colors.light.textMuted}>
      These notes are private to the CMS. Saving them does not activate recommendation rules. The original import is retained in the database.
    </SubstrateText>
    {Object.entries(groups).map(([group, fields]) => <View key={group} style={styles.stack}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === group }} onPress={() => setExpanded(expanded === group ? '' : group)} style={styles.button}>
        <SubstrateText variant="small">{expanded === group ? '−' : '+'} {group}</SubstrateText>
      </Pressable>
      {expanded === group && fields.map((field) => <View key={field} style={styles.stack}>
        <SubstrateText variant="small">{field.replaceAll('_', ' ')}</SubstrateText>
        <TextInput accessibilityLabel={field.replaceAll('_', ' ')} multiline textAlignVertical="top"
          style={styles.input} value={record.fields[field] ?? ''}
          onChangeText={(value) => onChange({ ...record, fields: { ...record.fields, [field]: value } })} />
      </View>)}
    </View>)}
  </View>;
}

export function CatalogReviewPanel({ reviews, onSaved }: { reviews: CatalogReview[]; onSaved: (review: CatalogReview) => void }) {
  const [selected, setSelected] = useState<CatalogReview | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [limit, setLimit] = useState(30);
  const visible = reviews.filter((r) => showClosed || r.status !== 'RESOLVED');
  async function save(status: CatalogReview['status']) {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const result = await saveCatalogReview(selected, status, note);
      if (result.error || !result.data) { setMessage(result.error?.message ?? 'Review could not be saved.'); return; }
      onSaved(result.data); setSelected(null); setMessage('Review saved.');
    } catch { setMessage('Connection failed. Your note is still here; try again.'); }
    finally { setSaving(false); }
  }
  return <Card style={styles.stack}>
    <SubstrateText variant="section">Review queue · {visible.length}</SubstrateText>
    <Pressable accessibilityRole="button" onPress={() => setShowClosed(!showClosed)} style={styles.button}>
      <SubstrateText variant="small">{showClosed ? 'Hide resolved' : 'Include resolved'}</SubstrateText>
    </Pressable>
    {message ? <SubstrateText variant="small">{message}</SubstrateText> : null}
    {selected ? <View style={styles.stack}>
      <SubstrateText variant="section">{selected.fields.product_name || selected.fields.issue_type}</SubstrateText>
      <SubstrateText variant="small">{selected.fields.issue}</SubstrateText>
      <SubstrateText variant="small">{selected.fields.recommended_action}</SubstrateText>
      <SubstrateText variant="small" color={Colors.light.textMuted}>Source row {selected.source_row} · {selected.fields.affected_ids}</SubstrateText>
      <TextInput accessibilityLabel="Resolution note" placeholder="What was checked or changed?" multiline style={styles.input} value={note} onChangeText={setNote} editable={!saving} />
      {(['OPEN', 'PARTIALLY RESOLVED', 'RESOLVED'] as const).map((status) => <Pressable key={status} accessibilityRole="button" disabled={saving} onPress={() => save(status)} style={styles.button}>
        <SubstrateText variant="small">{saving ? 'Saving…' : status === 'OPEN' ? 'Reopen' : status === 'RESOLVED' ? 'Resolve' : 'Mark partially resolved'}</SubstrateText>
      </Pressable>)}
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => setSelected(null)} style={styles.button}><SubstrateText variant="small">Back to reviews</SubstrateText></Pressable>
    </View> : visible.slice(0, limit).map((review) => <Pressable key={review.id} accessibilityRole="button" style={styles.button} onPress={() => { setSelected(review); setNote(review.resolution_note); setMessage(''); }}>
      <SubstrateText variant="small">{review.fields.product_name || review.fields.issue_type} · {review.status}</SubstrateText>
      <SubstrateText variant="small" color={Colors.light.textMuted}>{review.fields.issue_type} · source row {review.source_row}</SubstrateText>
    </Pressable>)}
    {!selected && visible.length > limit ? <Pressable accessibilityRole="button" onPress={() => setLimit(limit + 30)} style={styles.button}><SubstrateText variant="small">Show 30 more reviews</SubstrateText></Pressable> : null}
  </Card>;
}

export function CatalogHistory({ productId, sourceId }: { productId: string; sourceId?: string }) {
  const [items, setItems] = useState<Database['public']['Tables']['catalog_changes']['Row'][] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function load() {
    if (items) { setItems(null); return; }
    setLoading(true); setError('');
    try {
      const result = await listCatalogHistory(productId, sourceId);
      if (result.error) setError(result.error.message);
      else setItems(result.data ?? []);
    } catch { setError('Could not load history. Try again.'); }
    finally { setLoading(false); }
  }
  return <View style={styles.stack}>
    <Pressable accessibilityRole="button" disabled={loading} onPress={load} style={styles.button}><SubstrateText variant="small">{loading ? 'Loading history…' : items ? 'Hide change history' : 'View change history'}</SubstrateText></Pressable>
    {error ? <SubstrateText variant="small">{error}</SubstrateText> : null}
    {items?.map((item) => <View key={item.id} style={styles.stack}>
      <SubstrateText variant="small">{new Date(item.created_at).toLocaleString()} · {item.table_name.replaceAll('_', ' ')} · {item.actor_id ? 'Admin edit' : 'Import / system'}</SubstrateText>
      <SubstrateText variant="small" color={Colors.light.textMuted}>
        {!item.before_value ? 'Record created' : changedFields(item.before_value, item.after_value).join(', ') || 'Saved without field changes'}
      </SubstrateText>
    </View>)}
    {items?.length === 0 ? <SubstrateText variant="small">No recorded changes yet.</SubstrateText> : null}
  </View>;
}

function changedFields(before: unknown, after: unknown): string[] {
  const a = before as Record<string, unknown> | null;
  const b = after as Record<string, unknown> | null;
  if (!b) return ['Record removed'];
  return Object.keys(b).filter((key) => key !== 'updated_at' && JSON.stringify(a?.[key]) !== JSON.stringify(b[key])).flatMap((key) => key === 'fields' ? changedFields(a?.fields, b.fields) : key.replaceAll('_', ' '));
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.two },
  button: { padding: Spacing.two, minHeight: 44, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 10 },
  input: { minHeight: 90, padding: Spacing.two, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 10, color: Colors.light.text, fontFamily: Fonts.sans, backgroundColor: '#FBF8F6' },
});
