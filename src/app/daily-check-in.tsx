import { useTate } from '@/components/tate-drawer';
import { GoldButtonSurface } from "@/components/gold-button-surface";
import { DailyNoteInput } from '@/components/daily-note-input';
import { skipDailyStart } from '@/services/daily-start';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { ArrowRight, Camera, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReportTheme } from '@/report/theme';
import { getLatestDailyPhoto } from '@/services/photos';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Copy, Notice, Panel, ReportButton } from '@/report/ui';
import { Choices, Field } from '@/components/journey-fields';
import { getOrCreateDailyEntry } from '@/services/daily-entries';
import type { CheckInResponses, Json } from '@/types/database';
import { cleanDailyDraft, dailyOptions } from '../../shared/daily-draft.mjs';
import { localDate } from '../../shared/journey.mjs';
export default function DailyCheckIn() { const { user } = useAuth(); return user ? <DailyEditor key={user.id} userId={user.id}/> : null; }
function DailyEditor({ userId }: {
    userId: string;
}) {
    const router = useRouter();
    const { planDay } = useTate();
    const { review: reviewParam } = useLocalSearchParams<{ review?: string }>();
    const directReview = reviewParam === '1';
    const autoReviewStarted = useRef(false);
    const { theme: t } = useReportTheme();
    const { height } = useWindowDimensions();
    const heroHeight = Math.min(290, Math.max(205, height * 0.36));
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [date, setDate] = useState(localDate());
    const [draft, setDraft] = useState<CheckInResponses>({});
    const [note, setNote] = useState('');
    const preparedNote = '';
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [ready, setReady] = useState(false);
    const [review, setReview] = useState(directReview);
    const [details,setDetails]=useState(false);
    const [revision, setRevision] = useState<string | null>(null);
    const lock = useRef(false);
    const key = `substrate:daily-draft:v1:${userId}:${date}`;
    useFocusEffect(useCallback(() => { let alive = true; setReady(false); const today = localDate(); setDate(today); (async () => { const result = await supabase.from('daily_entries').select('*').eq('user_id', userId).eq('entry_date', today).maybeSingle(); if (result.error)
        throw result.error; const raw = await AsyncStorage.getItem(`substrate:daily-draft:v1:${userId}:${today}`); if (!alive)
        return; const saved = raw ? JSON.parse(raw) : null; setDraft(saved?.draft || cleanDailyDraft(result.data?.check_in || {})); setNote(saved?.note || ''); setRevision(result.data?.updated_at || null); setMessage(saved ? 'Restored your device draft. Review before saving.' : result.data ? 'Loaded this date’s saved observations. Changes require confirmation.' : ''); setReady(true); setPhotoUrl(null); if (result.data) { const photo = await getLatestDailyPhoto(result.data.id); if (alive) setPhotoUrl(photo.data?.signedUrl || null); } })().catch(() => { if (alive)
        setError('Could not load today’s entry. Reopen this page to retry; no data was changed.'); }); return () => { alive = false; }; }, [userId]));
    async function run(fn: () => Promise<void>) { if (lock.current)
        return; lock.current = true; setBusy(true); setError(''); try {
        await fn();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Please try again.');
    }
    finally {
        setBusy(false);
        lock.current = false;
    } }
    async function cache(next = draft, text = note) { await AsyncStorage.setItem(key, JSON.stringify({ draft: next, note: text })); }
    function change(next: CheckInResponses) { setDraft(next); void cache(next).catch(() => setError('Draft is in this session only. Device storage is unavailable.')); }
    async function confirm() { if (localDate() !== date)
        throw Error('The date changed. Reopen Daily Check-in before saving.'); const clean = cleanDailyDraft(draft); const entry = await getOrCreateDailyEntry(userId, date); if (entry.error || !entry.data)
        throw Error(entry.error?.message || 'Daily entry unavailable'); if (revision && entry.data.updated_at !== revision)
        throw Error('This entry changed elsewhere. Reopen and review the latest version.'); if (!revision && Object.keys(entry.data.check_in || {}).length)
        throw Error('A saved entry appeared elsewhere. Reopen before replacing it.'); const previous = entry.data.check_in; const checkIn: CheckInResponses = { ...previous, ...clean, journeyVersion: 1, confirmedAt: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...(!previous.journeyVersion && Object.keys(previous).length ? { legacySnapshot: previous as Json } : {}) }; for (const k of [...Object.keys(dailyOptions), "movementPlan", "movementPlanNote", "dailyActivities", "yesterdayNote"])
        if (!(k in clean))
            delete checkIn[k as keyof CheckInResponses]; const result = await supabase.from('daily_entries').update({ check_in: checkIn, status: 'check_in_added' }).eq('id', entry.data.id).eq('user_id', userId).eq('updated_at', entry.data.updated_at).select('*').single(); if (result.error)
        throw Error('Could not save, or this entry changed elsewhere. Your draft is preserved.'); setRevision(result.data.updated_at); await AsyncStorage.removeItem(key); setReview(false); setMessage('Check-in saved.'); router.replace('/your-day'); }
    function updateNote(value:string) { setNote(value); setReview(false); void cache(draft,value).catch(()=>setError('Unable to save device draft.')); }
    async function skip() { if(localDate()!==date)throw Error('The date changed. Reopen Your Day.'); await cache(); await skipDailyStart(userId); router.replace('/your-day'); }
    const addPhoto = () => void run(async () => { await cache(); router.push('/photo' as Href); });
    const continueDay = () => void run(async () => {
        if (note.trim()) {
          await cache();
          setReview(false);
          planDay(note.trim());
          router.replace('/your-day');
          return;
        }
        await cache();
        setReview(true);
    });
    const continueDayRef = useRef(continueDay);
    useEffect(() => { continueDayRef.current = continueDay; });
    useEffect(() => {
      if (!directReview || !ready || autoReviewStarted.current) return;
      autoReviewStarted.current = true;
      continueDayRef.current();
    }, [directReview, ready]);
    const closeReview = () => {
      if (busy) return;
      if (directReview) {
        if (router.canGoBack()) router.back();
        else router.replace('/your-day');
      } else setReview(false);
    };
    return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1,backgroundColor:'#031723'}}> 
      {!directReview ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{flexGrow:1,paddingBottom:16}}>
        <View style={{width:'100%',maxWidth:390,alignSelf:'center',paddingHorizontal:24}}>
          <View pointerEvents="none" style={{height:heroHeight,marginHorizontal:-24}}>
            <Image source={require('@/assets/images/nautilus-daily-v4.png')} contentFit="contain" accessible={false} style={{position:'absolute',width:'108%',height:heroHeight+56,top:-15,left:'-4%'}}/>
          </View>
          <View style={{marginTop:-43}}>
            <Copy kind="title" style={{color:'#FFFAF2',fontSize:49,lineHeight:54,letterSpacing:-1.8,fontWeight:'400',fontFamily:Platform.OS==='web'?'"Times New Roman", serif':Platform.OS==='ios'?'Times New Roman':'serif'}}>Hello.</Copy>
            <Copy kind="heading" style={{color:'#FFFAF2',fontSize:25,lineHeight:29,marginTop:2,fontWeight:'400',fontFamily:Platform.OS==='web'?'"Times New Roman", serif':Platform.OS==='ios'?'Times New Roman':'serif'}}>Tell me about your day.{'\n'}I’ll create a plan for you.</Copy>
          </View>
          <View style={{marginTop:17}}><DailyNoteInput value={note} onChange={updateNote} disabled={!ready || busy} /></View>
          {error&&!review?<View style={{marginTop:10}}><Notice>{error}</Notice></View>:null}
          <View style={{height:1,backgroundColor:'#FFFFFF14',marginTop:17,marginBottom:12}}/>
          <Copy kind="small" style={{color:'#FFFAF2',textAlign:'center',fontSize:13}}>Add a quick selfie (optional)</Copy>
          <View style={{marginTop:11,alignSelf:'center',width:'74%',maxWidth:248}}>
            <Pressable accessibilityRole="button" accessibilityLabel={photoUrl?'Change today’s selfie':'Add a quick selfie'} disabled={busy||!ready} onPress={addPhoto} style={{aspectRatio:1.75,borderRadius:13,overflow:'hidden',backgroundColor:'#102D3D',borderWidth:1,borderColor:'#B684514D',alignItems:'center',justifyContent:'center',gap:8}}>
              <Image source={photoUrl?{uri:photoUrl}:require('@/assets/images/daily-selfie-placeholder-v1.png')} accessibilityLabel={photoUrl?'Your daily selfie':'Skin close-up'} contentFit="cover" style={{width:'100%',height:'100%'}}/>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Open selfie camera" disabled={busy||!ready} onPress={addPhoto} style={{position:'absolute',right:-39,bottom:0,width:44,height:44,alignItems:'center',justifyContent:'center'}}><View style={{borderRadius:18,borderWidth:1,borderColor:'#DDA96F',width:30,height:30,alignItems:'center',justifyContent:'center'}}><Camera size={18} strokeWidth={1.3} color="#E9B77F"/></View></Pressable>
          </View>
          <Pressable accessibilityRole="button" disabled={!ready||busy} accessibilityState={{disabled:!ready||busy}} onPress={continueDay} style={{marginTop:15,marginHorizontal:18,minHeight:48,borderRadius:28,backgroundColor:'#EDBD87',borderWidth:1,borderColor:'#F5CFA2',alignItems:'center',justifyContent:'center',flexDirection:'row',gap:10,opacity:!ready||busy?0.55:1}}>
            <GoldButtonSurface/>
            {busy?<ActivityIndicator color={t.ink}/>:<><Copy style={{fontSize:15,color:t.ink}}>Continue</Copy><View><ArrowRight size={18} color={t.ink}/></View></>}
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!ready||busy} onPress={()=>void run(skip)} style={{minHeight:44,alignItems:'center',justifyContent:'center',marginTop:2}}><Copy kind="small" style={{color:'#FFFAF2',textDecorationLine:'underline',fontSize:13}}>Skip for now</Copy></Pressable>
        </View>
      </ScrollView> : null}
      <Modal visible={review} transparent animationType="slide" onRequestClose={closeReview}>
        <View style={{flex:1,justifyContent:'flex-end',backgroundColor:'#00000088'}}>
          <SafeAreaView edges={['bottom']} style={{width:'100%',maxWidth:520,maxHeight:'90%',alignSelf:'center',backgroundColor:t.paper,borderTopLeftRadius:24,borderTopRightRadius:24,overflow:'hidden'}}>
            <View style={{paddingLeft:20,paddingRight:8,paddingTop:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Copy kind="heading">Your day</Copy><Pressable accessibilityRole="button" accessibilityLabel="Close review" disabled={busy} onPress={closeReview} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><X size={22} color={t.ink}/></Pressable></View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20,gap:14}}>
              {busy || !ready && !error ? <><ActivityIndicator color={t.gold}/><Copy>{ready ? 'Tate is preparing your day…' : 'Loading your day…'}</Copy></>:null}
              {error?<Notice>{error}</Notice>:null}
              {error && ready && note.trim() && note !== preparedNote ? <ReportButton secondary label="Try again" disabled={busy} onPress={continueDay}/> : null}
              {message&&!busy?<Copy kind="small">{message}</Copy>:null}
              {Object.entries(cleanDailyDraft(draft)).map(([k,v])=><Copy key={k}>{({sleepQuality:'Sleep',stressLevel:'Stress',cyclePhase:'Cycle',skinFeelToday:'Skin feel',dailyActivities:'Activities',movementPlan:'Activity context',movementPlanNote:'Your plans',yesterdayNote:'Observations'} as Record<string,string>)[k]||k}: {Array.isArray(v)?v.join(', '):String(v)}</Copy>)}
              {!busy&&!Object.keys(cleanDailyDraft(draft)).length?<Copy>No details added yet. You can continue or add them below.</Copy>:null}
              <ReportButton secondary label={details?'Hide details':'Edit details'} disabled={busy || !ready} onPress={()=>setDetails(v=>!v)}/>
              {details?<Panel>{Object.entries(dailyOptions).map(([k,options])=><Choices disabled={busy || !ready} key={k} label={({sleepQuality:'Sleep',stressLevel:'Stress',cyclePhase:'Cycle (optional)',skinFeelToday:'Skin feel'} as Record<string,string>)[k]} options={[...options,'Leave unanswered']} value={draft[k as keyof CheckInResponses] as string} onChange={v=>{const next={...draft};if(v==='Leave unanswered')delete next[k as keyof CheckInResponses];else Object.assign(next,{[k]:v});change(next);}}/>)}<Field disabled={busy || !ready} label="Your activities (one per line)" value={draft.dailyActivities?.join("\n")} multiline onChange={value=>change({...draft,dailyActivities:value.split("\n")})}/><Field disabled={busy || !ready} label="Planned activities (optional)" value={draft.movementPlanNote} multiline onChange={movementPlanNote=>change({...draft,movementPlanNote})}/><Field disabled={busy || !ready} label="Observations (optional)" value={draft.yesterdayNote} multiline onChange={yesterdayNote=>change({...draft,yesterdayNote})}/></Panel>:null}
              <ReportButton copper label="Save & see my day" disabled={!ready || busy || (!!note.trim() && note!==preparedNote && !details)} busy={busy} onPress={()=>void run(confirm)}/>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </KeyboardAvoidingView>;
}
