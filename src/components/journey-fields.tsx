import { TextInput, View, Pressable } from 'react-native';
import { Copy } from '@/report/ui';
import { useReportTheme } from '@/report/theme';
import { visibleReportQuestions, type ReportAnswers } from '../../shared/report-questions.mjs';
export function Field({ label, value, onChange, placeholder = '', multiline = false, disabled = false }: {
    label: string;
    value?: string;
    onChange: (s: string) => void;
    placeholder?: string;
    multiline?: boolean;
    disabled?: boolean;
}) {
    const { theme: t } = useReportTheme();
    return <View style={{ gap: 8 }}><Copy kind="small">{label}</Copy><TextInput accessibilityLabel={label} editable={!disabled} value={value || ''} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={t.muted} multiline={multiline} style={{ borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 14, color: t.ink, backgroundColor: t.surface, minHeight: 48 }}/></View>;
}
export function Choices({ label, options, value, onChange, disabled=false }: {
    label: string;
    options: string[];
    disabled?: boolean;
    value?: string;
    onChange: (s: string) => void;
}) {
    const { theme: t } = useReportTheme();
    return <View style={{ gap: 8 }}><Copy>{label}</Copy><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{options.map(o => <Pressable key={o} disabled={disabled} accessibilityRole="radio" accessibilityState={{ checked: value === o, disabled }} onPress={() => onChange(o)} style={{ padding: 12, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: value === o ? t.ink : t.surface }}><Copy kind="small" style={{ color: value === o ? t.paper : t.ink }}>{o}</Copy></Pressable>)}</View></View>;
}
export function AnalysisQuestions({ answers, onChange }: {
    answers: ReportAnswers;
    onChange: (a: ReportAnswers) => void;
}) {
    return <View style={{ gap: 22 }}>{visibleReportQuestions(answers).map(q => q.input ? <Field key={q.id} label={q.title + (q.optional ? ' (optional)' : '')} value={String(answers[q.id] || '')} onChange={v => onChange({ ...answers, [q.id]: v })}/> : <View key={q.id} style={{ gap: 8 }}><Copy>{q.title}{q.optional ? ' (optional)' : ''}</Copy>{q.multi ? <View style={{ gap: 4 }}>{q.options?.map(o => { const selected = Array.isArray(answers[q.id]) ? answers[q.id] as string[] : []; return <Choices key={o} label="" options={[o]} value={selected.includes(o) ? o : undefined} onChange={() => onChange({ ...answers, [q.id]: ['None', 'Unsure'].includes(o) ? [o] : selected.includes(o) ? selected.filter(v => v !== o) : [...selected.filter(v => !['None', 'Unsure'].includes(v)), o] })}/>; })}</View> : <Choices label="" options={q.options || []} value={answers[q.id] as string} onChange={v => onChange({ ...answers, [q.id]: v })}/>}</View>)}</View>;
}
