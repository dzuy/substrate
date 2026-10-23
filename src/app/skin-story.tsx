import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Sparkles, Check, Droplet } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Copy, Notice, Panel, ReportButton, ReportFrame } from '@/report/ui';
import { useReportTheme } from '@/report/theme';
import { useAuth } from '@/lib/auth-context';
import { formatDisplayDate, getActiveEntryDate, getOrCreateDailyEntry } from '@/services/daily-entries';
import { getOrCreateTodayRecommendation } from '@/services/recommendations';
import { stateLabels } from '@/skin-intelligence/skinStoryRules';
import type { SkinStory } from '@/skin-intelligence/skinStoryTypes';

export default function SkinStoryScreen() {
  const router = useRouter();
  const { theme: t } = useReportTheme();
  const [retry,setRetry] = useState(0);
  const { user } = useAuth();
  const [skinStory, setSkinStory] = useState<SkinStory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [entryDate, setEntryDate] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void retry;
      let isMounted = true;

      async function loadStory() {
        if (!user) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setErrorMessage('');

        const activeDate = await getActiveEntryDate(user.id);
        const entry = await getOrCreateDailyEntry(user.id, activeDate);

        if (!isMounted) return;

        if (entry.error || !entry.data) {
          setErrorMessage(entry.error?.message ?? "Couldn't load today's entry.");
          setIsLoading(false);
          return;
        }

        setEntryDate(activeDate);
        const recommendation = await getOrCreateTodayRecommendation(user.id, entry.data.id);

        if (!isMounted) return;

        if (recommendation.error || !recommendation.data) {
          setErrorMessage(recommendation.error?.message ?? "Couldn't generate today's story.");
          setIsLoading(false);
          return;
        }

        setSkinStory(recommendation.data.skinStory);
        setIsLoading(false);
      }

      void loadStory().catch(()=>{if(isMounted){setErrorMessage('Your analysis could not be loaded. Please try again.');setIsLoading(false);}});

      return () => {
        isMounted = false;
      };
    }, [user,retry])
  );

  const reasons = skinStory?.reasons?.length ? skinStory.reasons : skinStory?.contributors?.map(item=>item.detail) ?? [];
  return <ReportFrame compact dark footer={false} showStyleGuide={false}>
    <View style={{width:'100%',maxWidth:390,alignSelf:'center',gap:14}}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Your Day" onPress={()=>router.replace('/your-day')} style={{flexDirection:'row',gap:7,alignItems:'center',minHeight:44}}><ArrowLeft size={18} color={t.paper}/><Copy kind="small">Your Day</Copy></Pressable>
      <View style={{gap:7,paddingHorizontal:8}}><Copy kind="title">Your skin analysis</Copy><Copy kind="small" style={{color:'#D2DCE1'}}>Your skin, understood in the context of your day.</Copy>{entryDate?<Copy kind="small" style={{color:t.gold}}>{formatDisplayDate(entryDate)}</Copy>:null}</View>
      {isLoading?<Panel style={{padding:30,alignItems:'center',gap:16}}><ActivityIndicator color={t.gold}/><Copy kind="heading">Reading your skin</Copy><Copy kind="small" style={{textAlign:'center',color:t.muted}}>Bringing together your photo, daily check-in, and environment.</Copy></Panel>:errorMessage?<Panel><Notice>{errorMessage}</Notice><ReportButton copper label="Try Again" onPress={()=>setRetry(v=>v+1)}/></Panel>:skinStory?<>
        <Panel style={{padding:20,borderRadius:22,gap:14}}>
          <View style={{flexDirection:'row',gap:8,alignItems:'center'}}><Sparkles size={19} color={t.gold}/><Copy kind="eyebrow" style={{color:t.muted}}>Your Skin Today</Copy></View>
          <Copy kind="heading">{skinStory.headline}</Copy><Copy style={{color:t.muted}}>{skinStory.summary}</Copy>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{[skinStory.primaryState,skinStory.secondaryState].filter(Boolean).map(state=><View key={state} style={{paddingHorizontal:13,paddingVertical:7,borderRadius:20,backgroundColor:t.paper,borderWidth:1,borderColor:t.line}}><Copy kind="small">{stateLabels[state!]}</Copy></View>)}</View>
        </Panel>
        {reasons.length?<Panel><Copy kind="heading">What’s influencing your skin</Copy>{reasons.slice(0,4).map(reason=><View key={reason} style={{flexDirection:'row',gap:10,paddingVertical:4}}><Check size={17} color={t.gold}/><Copy kind="small" style={{flex:1,color:t.muted}}>{reason}</Copy></View>)}</Panel>:null}
        <Panel><Copy kind="heading">A closer look</Copy>{skinStory.frameworkRead.map(item=><View key={item.dimension} style={{gap:7,paddingVertical:12,borderTopWidth:1,borderColor:t.line}}><View style={{flexDirection:'row',alignItems:'center',gap:8}}><Droplet size={17} color={t.gold}/><Copy style={{fontWeight:'600',textTransform:'capitalize',flex:1}}>{item.dimension}</Copy></View><Copy kind="small" style={{color:t.ink}}>{item.status}</Copy><Copy kind="small" style={{color:t.muted}}>{item.detail}</Copy></View>)}</Panel>
        {skinStory.priorities.length?<Panel><Copy kind="heading">Today’s focus</Copy>{skinStory.priorities.map(priority=><Copy key={priority} kind="small" style={{color:t.muted}}>• {priority}</Copy>)}</Panel>:null}
        <ReportButton copper label="View My Routine" onPress={()=>router.push('/routine')}/>
        <Pressable accessibilityRole="button" onPress={()=>router.push('/photo')} style={{minHeight:44,alignItems:'center',justifyContent:'center'}}><Copy kind="small" style={{color:'#D2DCE1'}}>Retake your photo</Copy></Pressable>
      </>:null}
    </View>
  </ReportFrame>;
}
