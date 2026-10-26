import { DayMetricDrawer, type DayMetric } from '@/components/day-metric-drawer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTate } from '@/components/tate-drawer';
import { DailyNoteInput } from '@/components/daily-note-input';
import { cleanDailyDraft, savedDailyActivities } from '../../shared/daily-draft.mjs';
import { localDate } from '../../shared/journey.mjs';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { ActivityIndicator, Platform, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Moon, Heart, Droplet, Sun, Camera, CircleCheck, Pencil, CalendarDays, ArrowRight } from 'lucide-react-native';
import { useAuth } from '@/lib/auth-context';
import { Copy, Notice, Panel, ReportButton, ReportFrame } from '@/report/ui';
import { useReportTheme } from '@/report/theme';
import { loadDay, type DayData } from '@/experience/day';

export default function YourDay() {
  const { user } = useAuth();
  return user ? <Dashboard key={user.id} userId={user.id}/> : null;
}
function Dashboard({userId}:{userId:string}) {
  const router = useRouter();
  const { openDayEditor, planDay, dayVersion } = useTate();
  const {theme:t} = useReportTheme();
  const [data,setData] = useState<DayData|null>(null);
  const [error,setError] = useState('');
  const [loadedPhotoUrl, setLoadedPhotoUrl] = useState('');
  const [failedPhotoUrl, setFailedPhotoUrl] = useState('');
  const [updatingSkin,setUpdatingSkin] = useState(true);
  const [retry,setRetry] = useState(0);
  const [metric, setMetric] = useState<DayMetric | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  useFocusEffect(useCallback(() => {
    let alive = true;
    setError(''); setUpdatingSkin(true);
    Promise.all([loadDay(userId), AsyncStorage.getItem(`substrate:daily-draft:v1:${userId}:${localDate()}`)]).then(([d, raw]) => { if(alive) { setData(d); setNote(raw ? JSON.parse(raw).note || '' : ''); } })
      .catch(() => { if(alive) setError('Your day could not be loaded. Please try again.'); })
      .finally(() => { if(alive) setUpdatingSkin(false); });
    return () => { alive = false; };
    // Retry explicitly reloads saved data for the same account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[userId,retry,dayVersion]));
  const go = (path:string) => router.push(path as Href);
  const checkIn = data?.entry?.check_in;
  const activities = savedDailyActivities(checkIn);
  const editDay = openDayEditor;
  const hour = new Date().getHours();
  const greeting = hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
  const metrics = [
    {label:'Sleep',value:checkIn?.sleepHours != null ? `${checkIn.sleepHours} hrs` : checkIn?.sleepQuality||'Not entered',icon:Moon,color:'#82C0DE'},
    {label:'HRV',value:checkIn?.hrvMs != null ? `${checkIn.hrvMs} ms` : 'Not entered',icon:Heart,color:'#E9BC87'},
    {label:'Cycle',value:checkIn?.cycleDay != null ? `Day ${checkIn.cycleDay}` : checkIn?.cyclePhase||'Not entered',icon:Droplet,color:'#D9A9A2'},
    {label:'Weather',value:data?.environment?.temperatureF!=null?`${Math.round(data.environment.temperatureF)}°F`:'Not added',icon:Sun,color:'#E9BC87'},
  ];
  const serif = Platform.OS==='web'? '"Times New Roman", serif':Platform.OS==='ios'?'Times New Roman':'serif';
  const skinSummary = !data?.stale ? data?.recommendation?.skinStory.summary || data?.recommendation?.analysis.photoAnalysis?.summary : undefined;
  const analysisError = data && 'analysisError' in data ? data.analysisError : '';
  const hasCheckIn = !!checkIn?.confirmedAt && [checkIn.sleepQuality, checkIn.stressLevel, checkIn.cyclePhase, checkIn.skinFeelToday, checkIn.movementPlanNote, checkIn.yesterdayNote, ...(checkIn.movementPlan || []), ...(checkIn.dailyActivities || [])].some(value => typeof value === 'string' && value.trim().length > 0);
  async function continueWithTate() {
    if (sendingRef.current || !note.trim()) return;
    sendingRef.current = true; setSending(true); setError('');
    try {
      const key = `substrate:daily-draft:v1:${userId}:${localDate()}`;
      const raw = await AsyncStorage.getItem(key);
      const saved = raw ? JSON.parse(raw) : {};
      await AsyncStorage.setItem(key, JSON.stringify({ ...saved, draft: saved.draft || cleanDailyDraft(checkIn || {}), note }));
      planDay(note.trim());
      setNote('');
    } catch { setError('Your note could not be saved. Please try again.'); }
    finally { sendingRef.current = false; setSending(false); }
  }
  const temperature = data?.environment?.temperatureF;
  const photoUrl = data?.photo?.signedUrl;
  const photoLoading = photoUrl ? loadedPhotoUrl !== photoUrl && failedPhotoUrl !== photoUrl : updatingSkin;
  return <ReportFrame compact dark footer={false} showStyleGuide={false}>
    <View style={{width:'100%',maxWidth:390,alignSelf:'center',gap:12}}>
      <View style={{paddingHorizontal:13,paddingTop:5,gap:18}}>
        <View style={{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:8}}>
          <View style={{flex:1,gap:5}}>
            <Copy kind="title" style={{fontFamily:serif,fontWeight:'400',fontSize:32,lineHeight:34,letterSpacing:-0.5}}>{greeting},{'\n'}{data?.profile.displayName?.split(' ')[0] || 'there'}.</Copy>
            <Copy kind="small" style={{fontSize:12,color:'#D2DCE1'}}>{new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</Copy>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="View or add today’s weather" onPress={()=>setMetric('Weather')} disabled={!data} style={{flexDirection:'row',alignItems:'center',gap:8,paddingBottom:6,minHeight:44,maxWidth:140}}>
            <Sun size={31} fill="#F1BA72" color="#F1BA72" strokeWidth={1.2}/>
            <View style={{flexShrink:1,gap:3}}><Copy kind="small" style={{fontSize:14}}>{temperature!=null?`${Math.round(temperature)}°`:'—°'}</Copy><Copy kind="small" style={{fontSize:11,lineHeight:15}}>{data?.environment?.locationLabel||'Add weather'}</Copy></View>
          </Pressable>
        </View>
        <View style={{flexDirection:'row',paddingBottom:2}}>{metrics.map(({label,value,icon:Icon,color})=><Pressable key={label} accessibilityRole="button" accessibilityLabel={`Enter ${label.toLowerCase()}`} disabled={!data} onPress={()=>setMetric(label as DayMetric)} style={{flex:1,alignItems:'center',gap:4}}>
          <View style={{width:47,height:47,borderRadius:24,borderWidth:1,borderColor:color,alignItems:'center',justifyContent:'center'}}><Icon size={26} color={color} strokeWidth={1.25}/></View>
          <View style={{alignItems:'center',gap:0}}><Copy kind="small" style={{fontSize:13,lineHeight:18}}>{label}</Copy><Copy kind="small" style={{fontSize:11,lineHeight:16,textAlign:'center',color:'#D2DCE1'}}>{value}</Copy></View>
        </Pressable>)} </View>
      </View>
      {data && 'weatherError' in data && data.weatherError ? <Notice>{data.weatherError}</Notice> : null}
      {error?<><Notice>{error}</Notice><ReportButton secondary label="Try again" onPress={()=>setRetry(v=>v+1)}/></>:null}
      {!data&&!error?<Copy kind="small">Loading your day…</Copy>:null}
      {hasCheckIn ? <Panel>
        <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
          <View style={{width:39,height:39,borderRadius:20,backgroundColor:'#031723',alignItems:'center',justifyContent:'center'}}><Image source={require('@/assets/images/nautilus-daily-v4.png')} contentFit="contain" accessible={false} style={{width:33,height:33}}/></View>
          <Copy style={{fontSize:13,fontWeight:'600',flex:1}}>Here’s your plan for today.</Copy>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit or add to your day" onPress={editDay} style={{width:36,height:44,alignItems:'center',justifyContent:'center'}}><Pencil size={16} strokeWidth={1.3} color={t.muted}/></Pressable>
        </View>
        <View style={{paddingTop:2}}>{activities.map((activity,index)=><View key={`${index}:${activity}`} style={{flexDirection:'row',gap:15,minHeight:54}}>
          <View style={{width:23,alignItems:'center'}}>
            {index>0?<View style={{position:'absolute',top:0,height:19,width:1,backgroundColor:'#D7A16D'}}/>:null}
            {index<activities.length-1?<View style={{position:'absolute',top:19,bottom:0,width:1,backgroundColor:'#D7A16D'}}/>:null}
            <View style={{width:11,height:11,marginTop:14,borderWidth:1,borderColor:'#D29A62',borderRadius:6,backgroundColor:t.surface}}/>
          </View>
          <View style={{paddingTop:9}}><CalendarDays size={24} color={t.ink} strokeWidth={1.4}/></View>
          <View style={{flex:1,paddingTop:10,paddingBottom:12}}><Copy style={{fontSize:13,lineHeight:20,fontWeight:'600'}}>{activity}</Copy></View>
        </View>)}</View>
        {!activities.length?<Copy kind="small" style={{color:t.muted}}>No activities added yet. Tell Tate what you have planned.</Copy>:null}
        <Pressable accessibilityRole="button" onPress={editDay} style={{minHeight:30,marginTop:-8,flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center'}}><Copy kind="small" style={{fontSize:12,fontWeight:'600'}}>Edit your day</Copy><ArrowRight size={14} color={t.ink}/></Pressable>
      </Panel> : data ? <View style={{ gap: 12 }}>
        <Copy style={{ fontSize: 18, paddingHorizontal: 12 }}>Tell Tate about your day.</Copy>
        <DailyNoteInput value={note} onChange={setNote} disabled={sending} />
        {note.trim() ? <ReportButton copper label="Continue" busy={sending} onPress={() => void continueWithTate()} /> : null}
      </View> : null}
      <Panel>
        <Copy style={{fontSize:14,fontWeight:'600'}}>Your Skin Today</Copy>
        <View style={{flexDirection:'row',gap:13,alignItems:'center'}}>
          <View style={{width:'39%',height:108,borderRadius:12,overflow:'hidden'}}>
            {photoUrl ? <Image key={photoUrl} source={{uri:photoUrl}} accessibilityLabel="Your saved photo from today" contentFit="cover" onLoad={() => setLoadedPhotoUrl(photoUrl)} onError={() => setFailedPhotoUrl(photoUrl)} style={{width:'100%',height:'100%',opacity:loadedPhotoUrl === photoUrl ? 1 : 0}}/> : !updatingSkin && data && !error ? <Image source={require('@/assets/images/daily-photo-example-front-v1.png')} accessibilityLabel="Example front-facing skin photo" contentFit="cover" style={{width:'100%',height:'100%'}}/> : null}
            {photoLoading ? <View style={{position:'absolute',inset:0,alignItems:'center',justifyContent:'center'}}><ActivityIndicator accessibilityLabel="Loading your photo" color={t.muted}/></View> : (photoUrl && failedPhotoUrl === photoUrl) || (!data && error) ? <View style={{position:'absolute',inset:0,alignItems:'center',justifyContent:'center',padding:8}}><Copy kind="small" style={{color:t.muted,textAlign:'center'}}>Photo unavailable</Copy></View> : null}
          </View>
          <View style={{flex:1,gap:8}}>
            {updatingSkin?<Copy kind="small" style={{fontSize:12,lineHeight:18,color:t.muted}}>Updating your skin insights…</Copy>:analysisError?<View style={{gap:8}}><Copy kind="small" style={{color:t.muted}}>{analysisError}</Copy><ReportButton secondary label="Retry skin update" onPress={()=>setRetry(v=>v+1)}/></View>:skinSummary?<Copy kind="small" style={{fontSize:12,lineHeight:18,color:t.muted}}>{skinSummary}</Copy>:<Copy kind="small" style={{fontSize:12,lineHeight:18,color:t.muted}}>{data?.photo?'Photo saved. Create your routine to see your skin observations.':'Add a selfie to see today’s skin observations.'}</Copy>}
            {checkIn?.skinFeelToday?<View style={{flexDirection:'row',gap:6,alignItems:'center'}}><CircleCheck size={14} color={t.muted}/><Copy kind="small" style={{flex:1,fontSize:11,lineHeight:16}}>You reported: {checkIn.skinFeelToday.toLowerCase()}</Copy></View>:null}
          </View>
        </View>
        <View style={{flexDirection:'row',gap:8,marginTop:2}}>
          <Pressable accessibilityRole="button" onPress={()=>go('/photo')} style={{flex:1,minHeight:44,borderRadius:24,borderWidth:1,borderColor:t.line,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7}}><Camera size={17} strokeWidth={1.4} color={t.ink}/><Copy kind="small" style={{fontSize:12}}>{data?.photo?'Retake Photo':'Take Photo'}</Copy></Pressable>
          <Pressable accessibilityRole="button" onPress={()=>go(data?.recommendation&&!data.stale?'/skin-story':'/routine')} style={{flex:1,minHeight:44,borderRadius:24,backgroundColor:'#031723',alignItems:'center',justifyContent:'center'}}><Copy kind="small" style={{color:'#FFFAF2',fontSize:12,fontWeight:'600'}}>{data?.recommendation&&!data.stale?'View Analysis':'Create My Routine'}</Copy></Pressable>
        </View>
      </Panel>
    </View>
    {metric && data ? <DayMetricDrawer key={metric} metric={metric} data={data} userId={userId} onClose={()=>setMetric(null)} onSaved={()=>{setMetric(null);setRetry(v=>v+1);}} /> : null}
  </ReportFrame>;
}
