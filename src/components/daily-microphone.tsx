import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Mic, Square } from 'lucide-react-native';
import nativeSpeech from '../../modules/substrate-speech';
import { Copy } from '@/report/ui';
import { useReportTheme } from '@/report/theme';

type Recognition = {
 lang:string; continuous:boolean; interimResults:boolean;
 start:()=>void; stop:()=>void; abort:()=>void;
 onresult:((event:{results:{length:number;[index:number]:{isFinal:boolean;0:{transcript:string}}}})=>void)|null;
 onerror:((event:{error:string})=>void)|null;
 onend:(()=>void)|null;
};
type SpeechWindow = {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
export function DailyMicrophone({disabled,onTranscript,compact=false}:{disabled:boolean;compact?:boolean;onTranscript:(text:string)=>void}) {
 const {theme:t}=useReportTheme();
 const [supported,setSupported]=useState(false);
 const [listening,setListening]=useState(false);
 const [error,setError]=useState('');
 const [status,setStatus]=useState('');
 const nativeRun=useRef(0);
 const nativeBusy=useRef(false);
 const active=useRef<Recognition|null>(null);
 const latest=useRef(onTranscript);
 useEffect(()=>{latest.current=onTranscript;},[onTranscript]);
 useEffect(()=>{if(Platform.OS==='web'){const w=window as unknown as SpeechWindow;setSupported(Boolean(w.SpeechRecognition||w.webkitSpeechRecognition));}else{setSupported(Boolean(nativeSpeech));}},[]);
 const cleanup=useCallback(()=>{nativeRun.current++;if(nativeBusy.current){nativeBusy.current=false;nativeSpeech?.cancel();}const r=active.current;active.current=null;if(r){r.onresult=null;r.onerror=null;r.onend=null;r.abort();}setListening(false);},[]);
 useFocusEffect(useCallback(()=>()=>cleanup(),[cleanup]));
 useEffect(()=>{if(disabled)cleanup();},[disabled,cleanup]);
 useEffect(()=>{
  const subscription=nativeSpeech?.addListener('state',event=>{
   if(nativeBusy.current)setStatus(event.state==='listening'?'Listening…':'Transcribing…');
  });
  return ()=>subscription?.remove();
 },[]);
 async function toggle(){
  if(Platform.OS!=='web'){
   if(!nativeSpeech){setError('Voice input needs an updated native build. You can still type your plans.');return;}
   if(nativeBusy.current){setStatus('Transcribing…');nativeSpeech.stop();return;}
   const run=++nativeRun.current;nativeBusy.current=true;setListening(true);setError('');setStatus('Starting microphone…');
   try{
    const result=await nativeSpeech.start();
    if(nativeRun.current!==run)return;
    if(result.text.trim()){latest.current(result.text.trim());setStatus(result.incomplete?'Partial transcript added. Review and correct it before sending.':'Transcript added. Review your text before sending.');}
    else setStatus('No speech detected. Try again.');
   }catch(error){if(nativeRun.current===run){setStatus('');setError(error instanceof Error?error.message:'Voice input failed. Try again.');}}
   finally{if(nativeRun.current===run){nativeBusy.current=false;setListening(false);}}
   return;
  }
  if(active.current){setStatus("Transcribing…");active.current.stop();return;}
  const w=window as unknown as SpeechWindow;
  const Constructor=w.SpeechRecognition||w.webkitSpeechRecognition;
  if(!Constructor){setError('Use your keyboard’s dictation microphone, or type your plans.');return;}
  setError('');setStatus('Listening…');
  const r=new Constructor();active.current=r;r.lang=navigator.language||'en-US';r.continuous=false;r.interimResults=false;
  r.onresult=event=>{if(active.current!==r)return;const text=Array.from({length:event.results.length},(_,i)=>event.results[i]).filter(result=>result.isFinal).map(result=>result[0].transcript).join(' ').trim();if(text){latest.current(text);setStatus("Transcript added. Review your text before sending.");}};
  r.onerror=event=>{if(active.current!==r)return;setStatus('');setError(event.error==='not-allowed'?'Microphone access was denied. You can still type your plans.':event.error==='no-speech'?'No speech detected. Try again or type your plans.':'Voice input is unavailable. Please type your plans.');cleanup();};
  r.onend=()=>{if(active.current===r){active.current=null;setListening(false);setStatus(current=>current === "Listening…" || current === "Transcribing…" ? "No transcript received. Try again or type your plans." : current);}};
  try{r.start();setListening(true);}catch{cleanup();setError('Could not start the microphone. Please type your plans.');}
 }
 if(compact)return <View style={{position:'relative'}}><Pressable accessibilityRole="button" accessibilityLabel={listening?'Stop microphone':'Use microphone'} accessibilityHint="Optional voice input uses your device’s speech service, which may process audio online. Review the text before saving." disabled={disabled} onPress={toggle} style={{width:44,height:48,alignItems:'center',justifyContent:'center',opacity:disabled?0.45:1}}>{listening?<Square size={21} color={t.gold}/>:<Mic size={25} strokeWidth={1.4} color={t.ink}/>}</Pressable>{status?<Copy kind="small" style={{position:"absolute",right:0,top:48,width:240,padding:8,backgroundColor:t.paper,color:t.ink,zIndex:9}}>{status}</Copy>:null}{error?<Pressable accessibilityLabel="Dismiss microphone message" onPress={()=>setError('')} style={{position:'absolute',right:0,top:48,width:240,padding:12,borderRadius:12,backgroundColor:t.paper,zIndex:10}}><Copy kind="small">{error}</Copy></Pressable>:null}</View>;
 return <View style={{gap:4}}>{status?<Copy kind="small">{status}</Copy>:null}{supported?<><Pressable accessibilityRole="button" accessibilityLabel={listening?'Stop microphone':'Use microphone'} accessibilityState={{disabled}} disabled={disabled} onPress={toggle} style={{minHeight:44,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:t.line,borderRadius:24,opacity:disabled?0.45:1}}>{listening?<Square size={16} color={t.gold}/>:<Mic size={17} color={t.ink}/>}<Copy kind="small">{listening?'Listening… tap to stop':'Use microphone'}</Copy></Pressable><Copy kind="small" style={{fontSize:10,color:t.muted,textAlign:'center'}}>Optional · Your device’s speech service may process audio online. Review the text before saving.</Copy></>:<Copy kind="small" style={{color:t.muted}}>You can also use your keyboard’s dictation microphone.</Copy>}{error?<Copy kind="small" style={{color:t.muted}}>{error}</Copy>:null}</View>;
}
