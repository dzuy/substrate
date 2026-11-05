import { useState } from 'react';
import { Image, Platform, TextInput, View } from 'react-native';
import { useOnboardingPhoto } from '@/hooks/use-onboarding-photo';
import { supabase } from '@/lib/supabase';
import { Copy, Notice, ReportButton } from '@/report/ui';
import { useReportTheme } from '@/report/theme';

export function SupplementLabelCapture({onConfirm}:{onConfirm:(text:string)=>void}) {
  const {pickPhoto, cameraDialog} = useOnboardingPhoto();
  const {theme:t} = useReportTheme();
  const [photo,setPhoto] = useState<string|null>(null);
  const [text,setText] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function capture(camera:boolean) {
    try {setError(''); const image = await pickPhoto(camera,false); if(image){setPhoto(image);setText('');}}
    catch(e){setError(e instanceof Error ? e.message : 'Photo unavailable. Please retry.');}
  }
  async function readLabel() {
    if(!photo || busy)return;
    setBusy(true);setError('');
    try {
      const {data} = await supabase.auth.getSession();
      if(!data.session)throw Error('Sign in again. Your photo remains here.');
      const endpoint = process.env.EXPO_PUBLIC_SUPPLEMENT_LABEL_API_URL || (Platform.OS === 'web' ? (__DEV__ ? `http://${window.location.hostname}:4318/api/supplement-label` : '/api/supplement-label') : '');
      if(!endpoint)throw Error('Label reading is unavailable. Enter the visible label text below.');
      const response = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({image:photo}),signal:AbortSignal.timeout(60000)});
      const result = await response.json();
      if(!response.ok || typeof result.text !== 'string')throw Error('Could not read the label. Retry or enter the visible text below.');
      setText(result.text);
    } catch(e){setError(e instanceof Error ? e.message : 'Could not read label. Please retry.');}
    finally{setBusy(false);}
  }
  return <View style={{gap:12}}>
    {cameraDialog}
    <ReportButton secondary label="Photograph supplement label" disabled={busy} onPress={()=>void capture(true)}/>
    <ReportButton secondary label="Choose label photo" disabled={busy} onPress={()=>void capture(false)}/>
    {photo ? <>
      <Image source={{uri:photo}} accessibilityLabel="Supplement label to review" resizeMode="contain" style={{height:220,width:'100%'}}/>
      <Copy kind="small">Read label sends this photo to our AI service. Check every detail against the label; unclear text may be missing or incorrect. Nothing is saved until you confirm.</Copy>
      <ReportButton label="Read label" busy={busy} onPress={()=>void readLabel()}/>
      <TextInput accessibilityLabel="Review supplement label text" multiline editable={!busy} value={text} onChangeText={setText} placeholder="Review or enter brand, name and label text. Do not guess unreadable details." placeholderTextColor={t.muted} style={{minHeight:120,padding:12,color:t.ink,borderColor:t.line,borderWidth:1,fontSize:16}}/>
      <ReportButton label="Use reviewed label text" disabled={busy || !text.trim()} onPress={()=>{onConfirm(text.trim());setPhoto(null);setText('');}}/>
      <ReportButton secondary label="Discard label photo" disabled={busy} onPress={()=>{setPhoto(null);setText('');}}/>
    </> : null}
    {error ? <Notice>{error}</Notice> : null}
  </View>;
}
