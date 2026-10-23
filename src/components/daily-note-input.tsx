import { TextInput, View } from 'react-native';
import { DailyMicrophone } from '@/components/daily-microphone';
import { fontFamily, useReportTheme } from '@/report/theme';

export function DailyNoteInput({ value, onChange, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { theme: t } = useReportTheme();
  return <View style={{ backgroundColor: '#FFFAF2', borderRadius: 24, borderWidth: 1, borderColor: '#E8DDCC', flexDirection: 'row', alignItems: 'center', paddingLeft: 17, paddingRight: 7, minHeight: 78 }}>
    <TextInput accessibilityLabel="Tell Tate about your day" editable={!disabled} value={value} onChangeText={onChange} multiline placeholder="I’m working, going to the gym, then dinner with friends." placeholderTextColor="#456078" style={{ flex: 1, minHeight: 72, maxHeight: 130, paddingVertical: 16, fontFamily: fontFamily(t.bodyFont), fontSize: 14, lineHeight: 20, color: t.ink, textAlignVertical: 'center' }} />
    <DailyMicrophone compact disabled={disabled} onTranscript={text => onChange([value.trim(), text].filter(Boolean).join(' '))} />
  </View>;
}
