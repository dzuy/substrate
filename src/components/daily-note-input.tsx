import { useState } from 'react';
import { Copy } from '@/report/ui';
import { Platform, TextInput, View } from 'react-native';
import { DailyMicrophone } from '@/components/daily-microphone';
import { fontFamily, useReportTheme } from '@/report/theme';

export function DailyNoteInput({ value, onChange, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { theme: t } = useReportTheme();
  const [feedback, setFeedback] = useState('');
  return <View style={{gap:6}}><View style={{ backgroundColor: '#FFFAF2', borderRadius: 24, borderWidth: 1, borderColor: '#E8DDCC', flexDirection: 'row', alignItems: 'center', paddingLeft: 17, paddingRight: 7, minHeight: 78 }}>
    <TextInput accessibilityLabel="Tell Tate about your day" editable={!disabled} value={value} onChangeText={text => { setFeedback(''); onChange(text); }} multiline placeholder="I’m working, going to the gym, then dinner with friends." placeholderTextColor="#456078" style={{ ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}), flex: 1, minWidth: 0, minHeight: 72, maxHeight: 130, paddingVertical: 16, fontFamily: fontFamily(t.bodyFont), fontSize: 16, lineHeight: 22, color: t.ink, textAlignVertical: 'center' }} />
    <DailyMicrophone compact onFeedback={setFeedback} disabled={disabled} onTranscript={text => onChange([value.trim(), text].filter(Boolean).join(' '))} />
  </View>{feedback ? <Copy kind="small" style={{fontSize:12,lineHeight:17,color:'#D2DCE1',paddingHorizontal:12}}>{feedback}</Copy> : null}</View>;
}
