import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { createSignedPhotoUrl } from '@/services/photos';
import { Copy, Notice, Panel, ReportButton, ReportFrame } from '@/report/ui';
import { useReportTheme } from '@/report/theme';

type Photo = { id:string; date:string; url:string };
export default function Progress(){const {user}=useAuth();return user?<ProgressView key={user.id} userId={user.id}/>:null;}
function ProgressView({userId}:{userId:string}){
 const router=useRouter(); const {theme:t}=useReportTheme(); const [photos,setPhotos]=useState<Photo[]>([]);const [selected,setSelected]=useState<string[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [retry,setRetry]=useState(0);
 useFocusEffect(useCallback(()=>{let alive=true;setLoading(true);setError('');(async()=>{
  const result=await supabase.from('photos').select('id,created_at,storage_path').eq('user_id',userId).order('created_at',{ascending:false}).limit(30);
  if(result.error)throw result.error;
  const loaded=await Promise.all((result.data||[]).map(async p=>{const signed=await createSignedPhotoUrl(p.storage_path);if(signed.error)throw signed.error;return {id:p.id,date:p.created_at,url:signed.data.signedUrl};}));
  if(alive){setPhotos(loaded);setSelected(loaded.length>1?[loaded[loaded.length-1].id,loaded[0].id]:loaded.map(p=>p.id));}
 })().catch(()=>{if(alive)setError('Your photos could not be loaded. Please try again.');}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},
 // Retry explicitly reloads saved data for the same account.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [userId,retry]));
 const comparison=photos.filter(p=>selected.includes(p.id)).sort((a,b)=>a.date.localeCompare(b.date));
 return <ReportFrame dark footer={false} showStyleGuide={false}><Copy kind="eyebrow">MY PROGRESS</Copy><Copy kind="title">See your skin over time.</Copy><Copy>Your photos, side by side. Choose up to two to compare.</Copy>{error?<><Notice>{error}</Notice><ReportButton secondary label="Try again" onPress={()=>setRetry(v=>v+1)}/></>:null}
 <Panel><Copy kind="heading">Your photo comparison</Copy>{loading?<Copy>Loading your photos…</Copy>:comparison.length?<><View style={{flexDirection:'row',gap:12}}>{comparison.map(p=><View key={p.id} style={{flex:1,gap:8}}><Image source={{uri:p.url}} accessibilityLabel={`Skin photo from ${new Date(p.date).toLocaleDateString()}`} contentFit="cover" style={{width:'100%',aspectRatio:0.8,borderRadius:14}}/><Copy kind="small" style={{textAlign:'center'}}>{new Date(p.date).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} · {new Date(p.date).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</Copy></View>)}</View><Copy kind="small" style={{color:t.muted}}>Lighting, angle and camera can change how your skin looks. Try to keep them consistent.</Copy></>:<><Copy>Add a daily photo to start your visual history.</Copy><ReportButton copper label="Add your first daily photo" onPress={()=>router.push('/photo')}/></>}</Panel>
 {photos.length?<View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{photos.map(p=><Pressable key={p.id} accessibilityRole="checkbox" accessibilityLabel={`Compare photo from ${new Date(p.date).toLocaleString()}`} accessibilityState={{checked:selected.includes(p.id)}} aria-checked={selected.includes(p.id)} onPress={()=>setSelected(previous=>previous.includes(p.id)?previous.filter(id=>id!==p.id):[...previous.slice(-1),p.id])} style={{width:'30%',flexGrow:1,maxWidth:150,borderRadius:14,borderWidth:2,borderColor:selected.includes(p.id)?'#F2C18D':'transparent',padding:4,gap:6}}><Image source={{uri:p.url}} contentFit="cover" style={{width:'100%',aspectRatio:1,borderRadius:9}}/><Copy kind="small" style={{textAlign:'center'}}>{new Date(p.date).toLocaleDateString()}</Copy></Pressable>)}</View>:null}
 <Panel><Copy kind="heading">Your story so far</Copy><ReportButton secondary label="Saved skin insights & reports" onPress={()=>router.push('/past-reports')}/><ReportButton secondary label="Daily check-in history" onPress={()=>router.push('/progress-history')}/></Panel><Copy kind="small">Product-trial and procedure tracking are coming soon.</Copy></ReportFrame>;
}
