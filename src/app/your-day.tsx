import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Platform, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Moon, Heart, Droplet, Sun, Camera, CircleCheck, Pencil, Dumbbell, Sunset, ArrowRight } from 'lucide-react-native';
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
  const {theme:t} = useReportTheme();
  const [data,setData] = useState<DayData|null>(null);
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let alive = true;
    setError('');
    loadDay(userId).then(d => { if(alive) setData(d); })
      .catch(() => { if(alive) setError('Your day could not be loaded. Please try again.'); });
    return () => { alive = false; };
    // Retry explicitly reloads saved data for the same account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[userId,retry]));
  const go = (path:string) => router.push(path as Href);
  const checkIn = data?.entry?.check_in;
  const plan = data?.recommendation?.dailyPlan;
  const hour = new Date().getHours();
  const greeting = hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
  const metrics = [
    {label:'Sleep',value:checkIn?.sleepQuality||'Not entered',icon:Moon,color:'#82C0DE'},
    {label:'HRV',value:'Not connected',icon:Heart,color:'#E9BC87'},
    {label:'Cycle',value:checkIn?.cyclePhase||'Not entered',icon:Droplet,color:'#D9A9A2'},
    {label:'Weather',value:data?.environment?.temperatureF!=null?`${Math.round(data.environment.temperatureF)}°F`:'Not added',icon:Sun,color:'#E9BC87'},
  ];
  const moments = [
    {id:'morning',label:'Morning',icon:Sun,hint:'Your morning skincare steps'},
    {id:'day',label:'Pre-workout',icon:Dumbbell,hint:'Care around your daily activities'},
    {id:'evening',label:'Evening',icon:Sunset,hint:'Your evening skincare steps'},
  ] as const;
  const serif = Platform.OS==='web'? '"Times New Roman", serif':Platform.OS==='ios'?'Times New Roman':'serif';
  const skinSummary = !data?.stale ? data?.recommendation?.analysis.photoAnalysis?.summary : undefined;
  const hasCheckIn = !!checkIn?.confirmedAt;
  const temperature = data?.environment?.temperatureF;
  return <ReportFrame compact dark footer={false} showStyleGuide={false}>
    <View style={{width:'100%',maxWidth:390,alignSelf:'center',gap:12}}>
      <View style={{paddingHorizontal:13,paddingTop:5,gap:18}}>
        <View style={{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:8}}>
          <View style={{flex:1,gap:5}}>
            <Copy kind="title" style={{fontFamily:serif,fontWeight:'400',fontSize:32,lineHeight:34,letterSpacing:-0.5}}>{greeting},{'\n'}{data?.profile.displayName?.split(' ')[0] || 'there'}.</Copy>
            <Copy kind="small" style={{fontSize:12,color:'#D2DCE1'}}>{new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</Copy>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="View or add today’s weather" onPress={()=>go('/environment')} style={{flexDirection:'row',alignItems:'center',gap:8,paddingBottom:6,minHeight:44,maxWidth:140}}>
            <Sun size={31} fill="#F1BA72" color="#F1BA72" strokeWidth={1.2}/>
            <View style={{flexShrink:1,gap:3}}><Copy kind="small" style={{fontSize:14}}>{temperature!=null?`${Math.round(temperature)}°`:'—°'}</Copy><Copy kind="small" style={{fontSize:11,lineHeight:15}}>{data?.environment?.locationLabel||'Add weather'}</Copy></View>
          </Pressable>
        </View>
        <View style={{flexDirection:'row',paddingBottom:2}}>{metrics.map(({label,value,icon:Icon,color})=><View key={label} style={{flex:1,alignItems:'center',gap:4}}>
          <View style={{width:47,height:47,borderRadius:24,borderWidth:1,borderColor:color,alignItems:'center',justifyContent:'center'}}><Icon size={26} color={color} strokeWidth={1.25}/></View>
          <View style={{alignItems:'center',gap:0}}><Copy kind="small" style={{fontSize:13,lineHeight:18}}>{label}</Copy><Copy kind="small" style={{fontSize:11,lineHeight:16,textAlign:'center',color:'#D2DCE1'}}>{value}</Copy></View>
        </View>)} </View>
      </View>
      {error?<><Notice>{error}</Notice><ReportButton secondary label="Try again" onPress={()=>setRetry(v=>v+1)}/></>:null}
      {!data&&!error?<Copy kind="small">Loading your day…</Copy>:null}
      <Panel>
        <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
          <View style={{width:39,height:39,borderRadius:20,backgroundColor:'#031723',alignItems:'center',justifyContent:'center'}}><Image source={require('@/assets/images/nautilus-daily-v4.png')} contentFit="contain" accessible={false} style={{width:33,height:33}}/></View>
          <Copy style={{fontSize:13,fontWeight:'600',flex:1}}>Here’s your plan for today.</Copy>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit or add to your day" onPress={()=>go('/home')} style={{width:36,height:44,alignItems:'center',justifyContent:'center'}}><Pencil size={16} strokeWidth={1.3} color={t.muted}/></Pressable>
        </View>
        {checkIn?.movementPlanNote||checkIn?.movementPlan?.length?<Copy kind="small" style={{fontSize:12,color:t.muted,marginLeft:49}}>{checkIn.movementPlanNote||checkIn.movementPlan?.join(' · ')}</Copy>:null}
        {data?.stale?<Notice>Your day changed. Refresh your routine.</Notice>:null}
        <View style={{paddingTop:2}}>{moments.map(({id,label,icon:Icon,hint},index)=>{
          const items=plan?.items?.filter(i=>i.moment===id)||[];
          return <Pressable key={id} accessibilityRole="button" accessibilityLabel={`View ${label.toLowerCase()} routine`} onPress={()=>go('/routine')} style={{flexDirection:'row',gap:15,minHeight:54}}>
            <View style={{width:23,alignItems:'center'}}>
              {index>0?<View style={{position:'absolute',top:0,height:19,width:1,backgroundColor:'#D7A16D'}}/>:null}
              {index<2?<View style={{position:'absolute',top:19,bottom:0,width:1,backgroundColor:'#D7A16D'}}/>:null}
              <View style={{width:11,height:11,marginTop:14,borderWidth:1,borderColor:'#D29A62',borderRadius:6,backgroundColor:t.surface}}/>
            </View>
            <View style={{paddingTop:9}}><Icon size={27} color={t.ink} strokeWidth={1.4}/></View>
            <View style={{flex:1,paddingTop:7,paddingBottom:7,gap:3}}><Copy style={{fontSize:13,lineHeight:18,fontWeight:'600'}}>{label}</Copy><Copy kind="small" style={{fontSize:11,lineHeight:16,color:t.muted}}>{items.length?items.slice(0,2).map(i=>i.label).join(' · '):hint}</Copy></View>
          </Pressable>;
        })}</View>
        <Pressable accessibilityRole="button" onPress={()=>go(hasCheckIn?'/routine':'/home')} style={{minHeight:30,marginTop:-8,flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center'}}><Copy kind="small" style={{fontSize:12,fontWeight:'600'}}>{hasCheckIn?'View full plan':'Tell Tate about your day'}</Copy><ArrowRight size={14} color={t.ink}/></Pressable>
      </Panel>
      <Panel>
        <Copy style={{fontSize:14,fontWeight:'600'}}>Your Skin Today</Copy>
        <View style={{flexDirection:'row',gap:13,alignItems:'center'}}>
          <View style={{width:'39%',height:108,borderRadius:12,overflow:'hidden'}}>
            <Image source={data?.photo?{uri:data.photo.signedUrl}:require('@/assets/images/daily-selfie-placeholder-v1.png')} accessibilityLabel={data?.photo?'Your saved photo from today':'Skin close-up'} contentFit="cover" style={{width:'100%',height:'100%'}}/>
          </View>
          <View style={{flex:1,gap:8}}>
            {skinSummary?<Copy kind="small" style={{fontSize:12,lineHeight:18,color:t.muted}}>{skinSummary}</Copy>:<Copy kind="small" style={{fontSize:12,lineHeight:18,color:t.muted}}>{data?.stale?'Your day has changed. Refresh your routine for updated observations.':data?.photo?'Photo saved. Create your routine to see your skin observations.':'Add a selfie to see today’s skin observations.'}</Copy>}
            {checkIn?.skinFeelToday?<View style={{flexDirection:'row',gap:6,alignItems:'center'}}><CircleCheck size={14} color={t.muted}/><Copy kind="small" style={{flex:1,fontSize:11,lineHeight:16}}>You reported: {checkIn.skinFeelToday.toLowerCase()}</Copy></View>:null}
          </View>
        </View>
        <View style={{flexDirection:'row',gap:8,marginTop:2}}>
          <Pressable accessibilityRole="button" onPress={()=>go('/photo')} style={{flex:1,minHeight:44,borderRadius:24,borderWidth:1,borderColor:t.line,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7}}><Camera size={17} strokeWidth={1.4} color={t.ink}/><Copy kind="small" style={{fontSize:12}}>{data?.photo?'Retake Photo':'Take Photo'}</Copy></Pressable>
          <Pressable accessibilityRole="button" onPress={()=>go(data?.recommendation&&!data.stale?'/skin-story':'/routine')} style={{flex:1,minHeight:44,borderRadius:24,backgroundColor:'#031723',alignItems:'center',justifyContent:'center'}}><Copy kind="small" style={{color:'#FFFAF2',fontSize:12,fontWeight:'600'}}>{data?.recommendation&&!data.stale?'View Analysis':'Create My Routine'}</Copy></Pressable>
        </View>
      </Panel>
    </View>
  </ReportFrame>;
}
