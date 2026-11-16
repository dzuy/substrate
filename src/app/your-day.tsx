import { dailyInputStatus } from '../../shared/daily-input-status.mjs';
import { createDayRoutine } from '@/services/create-day-routine';
import { DayMetricDrawer, type DayMetric } from '@/components/day-metric-drawer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTate } from '@/components/tate-drawer';
import { DailyNoteInput } from '@/components/daily-note-input';
import { savedDailyActivities } from '../../shared/daily-draft.mjs';
import { localDate } from '../../shared/journey.mjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { AppState, Platform, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Moon, Heart, Droplet, Sun, Camera, Check, Pencil, CalendarDays, ArrowRight } from 'lucide-react-native';
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
  const { openDayEditor, dayVersion } = useTate();
  const {theme:t} = useReportTheme();
  const [today,setToday] = useState(localDate());
  useEffect(()=>{
    const refreshDate=()=>{const date=localDate();if(date!==today){setData(null);setToday(date);}};
    const timer=setInterval(refreshDate,30000);
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')refreshDate();});
    return()=>{clearInterval(timer);subscription.remove();};
  },[today]);
  const [data,setData] = useState<DayData|null>(null);
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  const [routineBusy, setRoutineBusy] = useState(false);
  const routineLock = useRef(false);
  const [metric, setMetric] = useState<DayMetric | null>(null);
  const [note, setNote] = useState('');
  useFocusEffect(useCallback(() => {
    let alive = true;
    setError('');setData(null);
    Promise.all([loadDay(userId), AsyncStorage.getItem(`substrate:daily-draft:v1:${userId}:${localDate()}`)]).then(([d, raw]) => { if(alive) { setData(d); setNote(raw ? JSON.parse(raw).note || '' : ''); } })
      .catch(() => { if(alive) setError('Your day could not be loaded. Please try again.'); });
    return () => { alive = false; };
    // Retry explicitly reloads saved data for the same account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[userId,retry,dayVersion,today]));
  const go = (path:string) => router.push(path as Href);
  const checkIn = data?.entry?.check_in;
  const activities = savedDailyActivities(checkIn);
  const editDay = openDayEditor;
  const hour = new Date().getHours();
  const greeting = hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
  const added = dailyInputStatus(data,today);
  const metrics = [
    {label:'Sleep',value:checkIn?.sleepHours != null ? `${checkIn.sleepHours} hrs` : checkIn?.sleepQuality||'Not entered',icon:Moon,color:'#82C0DE'},
    {label:'HRV',value:checkIn?.hrvMs != null ? `${checkIn.hrvMs} ms` : 'Not entered',icon:Heart,color:'#E9BC87'},
    {label:'Cycle',value:checkIn?.cycleDay != null ? `Day ${checkIn.cycleDay}` : checkIn?.cyclePhase||'Not entered',icon:Droplet,color:'#D9A9A2'},
    {label:'Weather',value:data?.environment?.temperatureF!=null?`${Math.round(data.environment.temperatureF)}°F`:'Not added',icon:Sun,color:'#E9BC87'},
    {label:'Photo',value:data?.photo?'Added':'Add / take',icon:Camera,color:'#D9A9A2'},
  ];
  const serif = Platform.OS==='web'? '"Times New Roman", serif':Platform.OS==='ios'?'Times New Roman':'serif';
  const hasCheckIn = !!checkIn?.confirmedAt && [checkIn.sleepQuality, checkIn.stressLevel, checkIn.cyclePhase, checkIn.skinFeelToday, checkIn.movementPlanNote, checkIn.yesterdayNote, ...(checkIn.movementPlan || []), ...(checkIn.dailyActivities || [])].some(value => typeof value === 'string' && value.trim().length > 0);
  const temperature = data?.environment?.temperatureF;
  async function createOrUpdateRoutine() {
    if (routineLock.current || !data) return;
    routineLock.current = true; setRoutineBusy(true); setError('');
    try {
      await createDayRoutine(userId, note, data.entry?.entry_date || localDate());
      setNote('');
      setRetry(v => v + 1);
      go('/routine');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your routine could not be created. Your note is still here. Please try again.'); }
    finally { routineLock.current = false; setRoutineBusy(false); }
  }
  return <ReportFrame compact dark footer={false} showStyleGuide={false}>
    <View style={{width:'100%',maxWidth:390,alignSelf:'center',gap:28,paddingTop:14,paddingBottom:20}}>
      <View style={{paddingHorizontal:13,paddingTop:5,gap:32}}>
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
        <View style={{flexDirection:'row',paddingBottom:2}}>{metrics.map(({label,value,icon:Icon,color})=><Pressable key={label} accessibilityRole="button" accessibilityHint={added[label as keyof typeof added] ? 'Added for today. Tap to edit.' : 'Not added for today. Tap to add.'} accessibilityLabel={label === 'Photo' ? (data?.photo ? "Photo added. Retake today’s photo" : "Add or take today’s photo") : `Enter ${label.toLowerCase()}`} disabled={!data} onPress={()=>setMetric(label as DayMetric)} style={{flex:1,alignItems:'center',gap:4}}>
          <View style={{width:47,height:47,borderRadius:24,borderWidth:1,borderColor:color,alignItems:'center',justifyContent:'center'}}><Icon size={26} color={color} strokeWidth={1.25}/>{added[label as keyof typeof added] ? <View accessible={false} style={{position:'absolute',right:-3,bottom:-3,width:18,height:18,borderRadius:9,backgroundColor:'#26965C',borderWidth:2,borderColor:'#031723',alignItems:'center',justifyContent:'center'}}><Check size={11} color="#FFFFFF" strokeWidth={3}/></View> : null}</View>
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
      </Panel> : data ? <View style={{ gap: 18 }}>
        <Copy style={{ fontSize: 18, paddingHorizontal: 12 }}>Tell Tate about your day.</Copy>
        <DailyNoteInput value={note} onChange={setNote} disabled={routineBusy} />
      </View> : null}
      {data ? <View style={{gap:12,paddingTop:12}}>
        {data.stale ? <Copy kind="small">Your inputs are saved. Update your routine when you’re ready. The previous routine remains available.</Copy> : null}
        <ReportButton copper label={data.recommendation ? 'Update my routine' : 'Create my routine'} busy={routineBusy} onPress={() => void createOrUpdateRoutine()}/>
      </View> : null}
    </View>
    {metric && data ? <DayMetricDrawer key={metric} metric={metric} data={data} userId={userId} onClose={()=>setMetric(null)} onSaved={()=>{setMetric(null);setRetry(v=>v+1);}} /> : null}
  </ReportFrame>;
}
