import {uploadBaselineView,downloadBaselineView} from '@/services/photos';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Image, View, Pressable } from 'react-native';
import { Camera, Check, Watch } from 'lucide-react-native';
import { useReportTheme } from '@/report/theme';
import { useAuth } from '@/lib/auth-context';
import { Copy, Notice, Panel, ReportButton, ReportFrame, NautilusArt, SummaryGrid } from '@/report/ui';
import { ProfileContent } from '@/components/profile-content';
import { AnalysisQuestions, Choices } from '@/components/journey-fields';
import { loadJourney, saveJourney, resolveJourney, type JourneyConflict, type Journey } from '@/services/journey';
import { getProfile, toProfileContext, saveProfileContext } from '@/services/profile';
import { listUserWardrobe } from '@/services/catalog';
import { pickReportPhoto, reportApi, saveReport, listReports, getReport } from '@/report/service';
import type { ScanResult, SkinReport } from '@/report/types';
import { photoQualityIssue } from '../../shared/photo-quality.mjs';
import { profileReportAnswers } from '../../shared/profile-report-answers.mjs';
import { validateReportAnswers } from '../../shared/report-questions.mjs';
import { nextStage, summaryCards, stableInput, stages } from '../../shared/journey.mjs';
const groups = [['Basics', ['Basic Information']], ['Your skin', ['Skin Goals', 'Skin History']], ['Health & hormones', ['Medical History', 'Hormones', 'Procedures History']], ['Allergies', ['Allergies']], ['Diet & nutrition', ['Nutrition', 'Supplements']], ['Lifestyle', ['Lifestyle', 'Skincare']]] as const;
export default function Onboarding() { const { user } = useAuth(); return user ? <JourneyScreen key={user.id} userId={user.id}/> : null; }
function JourneyScreen({ userId }: {
    userId: string;
}) {
    const router = useRouter();
    const {theme:t}=useReportTheme();
    const [photoView,setPhotoView]=useState<'front'|'left'|'right'>('front');
    const [state, setState] = useState<Journey | null>(null);
    const [cloud, setCloud] = useState(false);
    const [available,setAvailable]=useState(false);
    const [conflict,setConflict]=useState<JourneyConflict|null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [profileStep, setProfileStep] = useState(0);
    const lock = useRef(false);
    useFocusEffect(useCallback(() => { let alive = true; loadJourney(userId).then(r => { if (alive) {
        setState(r.state);
        setCloud(r.cloud);setAvailable(r.available);setConflict(r.conflict);
        setProfileStep(r.state.profileStep || 0);
    } }).catch(() => { if (alive)
        setError('Your journey could not be restored. Retry by reopening this page.'); }); return () => { alive = false; }; }, [userId]));
    async function run(fn: () => Promise<void>) { if (lock.current)
        return; lock.current = true; setBusy(true); setError(''); try {
        await fn();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Please try again.');
    }
    finally {
        lock.current = false;
        setBusy(false);
    } }
    async function persist(next: Journey) { const r = await saveJourney(userId, next); setState(r.state); setCloud(r.cloud);setAvailable(r.available);setConflict(r.conflict); return r.state; }
    async function chooseBaseline(view:'front'|'left'|'right',camera=false) {
        if(!state)return;
        const photo=await pickReportPhoto(camera);if(!photo)return;
        // Commit device draft before upload so a network failure never discards the capture.
        const draft=await persist({...state,photos:{...state.photos,[view]:photo},baselineRefs:{...state.baselineRefs,[view]:undefined},...(view==='front'?{scan:undefined,report:undefined}:{})});
        const path=await uploadBaselineView(userId,view,photo);
        await persist({...draft,baselineRefs:{...draft.baselineRefs,[view]:path}});
    }
    async function advance() { if (state)
        await persist({ ...state, stage: nextStage(state.stage) }); }
    if (!state)
        return <ReportFrame><Copy>Restoring your journey…</Copy>{error ? <Notice>{error}</Notice> : null}</ReportFrame>;
    const s = state;
    const update = (patch: Partial<Journey>) => {if(!lock.current)setState({ ...s, ...patch });};
    const StageSurface = ['profile','photos','wardrobe','summary','wellness'].includes(s.stage) ? Panel : View;
    const saveDraft = () => run(async () => { await persist(s); });
    return <ReportFrame compact dark footer={false} showStyleGuide={false}><View style={{flexDirection:"row",gap:5}}>{stages.slice(0,-1).map((step,index)=><View key={step} style={{height:3,flex:1,borderRadius:2,backgroundColor:index<=stages.indexOf(s.stage)?"#D6A36B":"#8798A544"}}/>)}</View><Copy kind="eyebrow">{s.stage==='complete'?'WELCOME TO SUBSTRATE DAILY':`STEP ${stages.indexOf(s.stage)+1} OF 7`}</Copy>{s.stage==='welcome'?<NautilusArt size={220}/>:null}<Copy kind="title">{s.stage === 'complete' ? 'Your next chapter.' : s.stage === 'welcome' ? 'Beauty starts within.' : s.stage === 'photos' ? 'Take your skin photos.' : s.stage === 'subscription' ? 'You’re almost there.' : s.stage === 'summary' ? 'Your first insights.' : s.stage === 'wellness' ? 'Welcome to SUBSTRATE Daily.' : s.stage === 'wardrobe' ? 'Build your Skin Wardrobe.' : 'A little about you.'}</Copy>
 {!cloud&&s.revision>0?<Copy kind="small">{available?'Your latest changes are saved on this device.':'Saved on this device. Account sync is temporarily unavailable.'}</Copy>:null}
 {error ? <Notice>{error}</Notice> : null}
 {conflict ? <Panel><Copy kind="heading">Choose which progress to continue</Copy><Copy>This device has unsynced changes at {s.stage}. Your account has newer progress at {conflict.stage}, saved {new Date(conflict.updatedAt).toLocaleString()}. Nothing is merged automatically. Both versions are backed up on this device before your choice.</Copy><ReportButton secondary busy={busy} label="Refresh conflict choices" onPress={()=>void run(async()=>{const r=await loadJourney(userId);setConflict(r.conflict);setCloud(r.cloud);setAvailable(r.available);})}/><ReportButton busy={busy} label="Keep this device’s progress & sync" onPress={()=>void run(async()=>{const r=await resolveJourney(userId,s,'device',conflict.revision);setState(r.state);setCloud(r.cloud);setAvailable(r.available);setConflict(r.conflict);setProfileStep(r.state.profileStep||0);})}/><ReportButton secondary busy={busy} label="Use account progress (back up this draft)" onPress={()=>void run(async()=>{const r=await resolveJourney(userId,s,'account',conflict.revision);setState(r.state);setCloud(r.cloud);setAvailable(r.available);setConflict(r.conflict);setProfileStep(r.state.profileStep||0);})}/></Panel> : null}
 <StageSurface style={{gap:12}}>
 {s.stage === 'welcome' ? <><Copy>Personalized skincare. Powered by your biology. Guided by Tate.</Copy><Panel style={{gap:8,padding:16}}><Copy kind="eyebrow">SUBSTRATE MEMBERSHIP · PREVIEW</Copy><Copy style={{fontSize:30,lineHeight:36}}>$19.99<Copy> / month</Copy></Copy><Copy kind="small">Cancel anytime when membership launches. This preview does not collect payment.</Copy><ReportButton copper label="Acknowledge & continue" busy={busy} onPress={() => void run(async () => { await persist({ ...s, acknowledged: true, stage: 'profile' }); })}/></Panel><ReportButton secondary label="Use an existing saved report" onPress={() => void run(async () => { const { reports } = await listReports(userId); if (!reports.length)
        throw Error('No saved report is available. Continue with a new baseline.'); const report = await getReport(userId, reports[0].id); if (!report)
        throw Error('Report unavailable.'); await persist({ ...s, report, stage: 'profile' }); })}/></> : null}
 {s.stage === 'profile' ? <><Copy kind="heading">{profileStep < 6 ? groups[profileStep][0] : 'Review your analysis context'}</Copy><Copy>A few essentials to personalize your care. Optional details can stay blank.</Copy>{profileStep < 6 ? <ProfileContent key={profileStep} sections={[...groups[profileStep][1]]} onNavigate={() => { }} onSaved={profile => { void run(async () => { const next = await persist({ ...s, profileDraft: profile, profileStep: profileStep + 1, answers: { ...s.answers, ...profileReportAnswers(profile) } }); setState(next); setProfileStep(v => v + 1); }); }}/> : <><AnalysisQuestions answers={s.answers || {}} onChange={answers => update({ answers })}/><ReportButton label={s.report ? 'Save context & review existing baseline' : 'Save context & continue'} busy={busy} onPress={() => void run(async () => { const answers = validateReportAnswers(s.answers || {}); const profile = await getProfile(userId); if (profile.error)
        throw profile.error; const saved = await saveProfileContext(userId, { ...toProfileContext(profile.data), assessmentAnswers: answers }); if (saved.error)
        throw saved.error; await persist({ ...s, answers, profileDraft:toProfileContext(saved.data),stage: 'photos' }); })}/></>}{profileStep > 0 ? <ReportButton secondary label="Previous profile section" onPress={() => void run(async () => { const n = Math.max(0, profileStep - 1); await persist({ ...s, profileStep: n }); setProfileStep(n); })}/> : null}</> : null}
 {s.stage === 'photos' ? <>
 <Copy kind="small">Natural light works best. Your front photo is used for analysis; side views are optional.</Copy>
 {s.report ? <Panel><Copy kind="small">Saved baseline · {new Date(s.report.createdAt).toLocaleDateString()}</Copy><ReportButton label="Use this baseline" onPress={() => void run(advance)}/></Panel> : null}
 <View style={{height:240,borderRadius:14,overflow:'hidden',backgroundColor:'#EAE1D6',alignItems:'center',justifyContent:'center'}}>
 {s.photos?.[photoView]?<Image source={{uri:s.photos[photoView]}} accessibilityLabel={`${photoView} baseline photo`} style={{width:'100%',height:'100%',resizeMode:'contain'}}/>:<><Camera size={36} strokeWidth={1} color={t.muted}/><Copy kind="small" style={{color:t.muted,marginTop:10}}>Add your {photoView} photo</Copy></>}
 </View>
 <View style={{flexDirection:'row',gap:8}}>{(['front','left','right'] as const).map(view=><Pressable key={view} accessibilityRole="tab" accessibilityState={{selected:photoView===view}} aria-selected={photoView===view} onPress={()=>setPhotoView(view)} style={{flex:1,borderWidth:1,borderColor:photoView===view?t.gold:t.line,borderRadius:12,padding:6,gap:4}}>{s.photos?.[view]?<Image source={{uri:s.photos[view]}} style={{height:48,width:'100%',borderRadius:7,resizeMode:'cover'}}/>:<View style={{height:48,alignItems:'center',justifyContent:'center'}}><Camera size={19} color={t.muted}/></View>}<Copy kind="small" style={{textAlign:'center',textTransform:'capitalize'}}>{view}</Copy></Pressable>)}</View>
 {s.baselineRefs?.[photoView]&&!s.photos?.[photoView]?<ReportButton secondary label="Load saved photo" busy={busy} onPress={()=>void run(async()=>{const photo=await downloadBaselineView(userId,s.baselineRefs![photoView]!);await persist({...s,photos:{...s.photos,[photoView]:photo}});})}/>:null}
 {s.photos?.[photoView]&&!s.baselineRefs?.[photoView]?<ReportButton secondary label="Retry private upload" busy={busy} onPress={()=>void run(async()=>{const path=await uploadBaselineView(userId,photoView,s.photos![photoView]!);await persist({...s,baselineRefs:{...s.baselineRefs,[photoView]:path}});})}/>:null}
 <View style={{flexDirection:'row',gap:8}}><View style={{flex:1}}><ReportButton secondary label="Upload photo" busy={busy} onPress={()=>void run(()=>chooseBaseline(photoView))}/></View><View style={{flex:1}}><ReportButton secondary label="Take photo" busy={busy} onPress={()=>void run(()=>chooseBaseline(photoView,true))}/></View></View>
 <Copy kind="small" style={{color:t.muted}}>Side views are stored privately but are not analyzed.</Copy>
 <ReportButton label="Analyze front photo & continue" disabled={!s.photos?.front} busy={busy} onPress={() => void run(async () => { const scan = await reportApi<ScanResult>({ action: 'scan', image: s.photos?.front }); const issue = photoQualityIssue(scan.scan.analysis); if (issue) throw Error(issue); await persist({ ...s, scan, stage: 'wardrobe' }); })}/>
 </> : null}
 {s.stage === 'wardrobe' ? <><Image source={require('@/assets/images/skincare-still-life-v1.png')} accessible={false} style={{width:'100%',height:180,borderRadius:12,resizeMode:'cover'}}/><Copy>Take photos of the products you already own, or add them manually. Review what we find and make it yours.</Copy><ReportButton label="Add my products" onPress={() => void run(async () => { await persist(s); router.push('/skin-wardrobe?onboarding=1' as Href); })}/><ReportButton secondary label="Continue with saved wardrobe / skip" busy={busy} onPress={() => void run(advance)}/></> : null}
 {s.stage === 'subscription' ? <><NautilusArt size={150}/><Panel><Copy kind="eyebrow">SUBSTRATE MEMBERSHIP · SIMULATION</Copy><Copy style={{fontSize:30,lineHeight:36}}>$19.99<Copy> / month</Copy></Copy><Copy kind="small">Cancel anytime when membership launches.</Copy>{["Your personalized skincare routine","Quick skin insights","Your wardrobe, connected","Progress over time"].map(label=><View key={label} style={{flexDirection:"row",gap:8,alignItems:"center"}}><Check size={15} color={t.gold}/><Copy kind="small">{label}</Copy></View>)}<Copy kind="small">Preview only. No payment or subscription is activated.</Copy><ReportButton copper label="Continue with simulated subscription" busy={busy} onPress={() => void run(async () => { await persist({ ...s, simulation: { price: 19.99, currency: 'USD', cadence: 'month', mode: 'simulation', confirmedAt: new Date().toISOString() }, stage: 'summary' }); })}/></Panel></> : null}
 {s.stage === 'summary' ? <>{s.report ? <><Copy kind="small">Assessment dated {new Date(s.report.createdAt).toLocaleString()}. Only the original analyzed front photo contributes observations.</Copy><SummaryGrid cards={summaryCards(s.report, s.profileDraft)}/><ReportButton label="Continue" busy={busy} onPress={() => void run(advance)}/></> : <><Copy>A quick look at what your profile, skin photo and products tell us. Your first step toward a more personal routine.</Copy><ReportButton label="Create my summary" busy={busy} disabled={!s.scan} onPress={() => void run(async () => { if (!s.scan)
        throw Error('Return to baseline photos to analyze your front view.'); const wardrobe = await listUserWardrobe(userId); if (wardrobe.error)
        throw wardrobe.error; const { report } = await reportApi<{
        report: SkinReport;
    }>({ action: 'generate', experience: 'daily-summary-v1', scanToken: s.scan.scanToken, answers: validateReportAnswers(s.answers || {}), productIds: (wardrobe.data || []).filter(w => w.status === 'active').map(w => w.product_id).slice(0, 30), mode: 'optimize' }); const currentProfile=await getProfile(userId);if(currentProfile.error)throw currentProfile.error;const saved = await saveReport(userId, { ...report, provenance:{...report.provenance,journeyInput:stableInput({profile:toProfileContext(currentProfile.data),wardrobe:wardrobe.data||[]})},photo: s.photos?.front }); await persist({ ...s, report: saved }); })}/><ReportButton secondary label="Return to baseline photos" onPress={() => void run(async () => { await persist({ ...s, stage: 'photos' }); })}/></>}</> : null}
 {s.stage === 'wellness' ? <><View style={{flexDirection:'row',gap:10,alignItems:'center'}}><Watch size={26} color={t.gold}/><Copy kind="heading">Connect your wearables</Copy></View><Panel><Copy>Wearable connections are coming soon. For now, tell us how you feel or skip this step.</Copy><Choices label="How would you like to start?" options={['Enter manually', 'Skip for now']} value={s.wellness === 'manual' ? 'Enter manually' : s.wellness === 'skip' ? 'Skip for now' : undefined} onChange={v => update({ wellness: v === 'Enter manually' ? 'manual' : 'skip' })}/></Panel><ReportButton copper label="Continue to SUBSTRATE Daily" disabled={!s.wellness} busy={busy} onPress={() => void run(async () => { await persist({ ...s, stage: 'complete', completedAt: new Date().toISOString() }); router.replace('/daily-check-in' as Href); })}/></> : null}
 {s.stage === 'complete' ? <><Copy>Your subscription experience is simulated. Your saved profile and wardrobe remain editable.</Copy><ReportButton label="Tell Tate about your day" onPress={() => router.replace('/daily-check-in' as Href)}/><ReportButton secondary label="Change optional wellness preference" onPress={() => void run(async () => { await persist({ ...s, stage: 'wellness' }); })}/><ReportButton secondary label="Review profile & baseline" onPress={() => void run(async () => { await persist({ ...s, stage: 'profile', profileStep: 0 }); })}/></> : null}
 </StageSurface>
 <View style={{flexDirection:"row",gap:8}}><View style={{flex:1}}><ReportButton secondary label="Save progress" busy={busy} onPress={saveDraft}/></View><View style={{flex:1}}><ReportButton secondary label="App home" onPress={() => router.replace('/home' as Href)}/></View></View>
 </ReportFrame>;
}
