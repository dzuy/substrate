import { useTate } from "@/components/tate-drawer";
import { getRoutineCatalogProducts, type RoutineCatalogProduct } from '@/services/routine-catalog';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { listUserWardrobe, type UserWardrobeItem } from '@/services/catalog';
import { Platform, ScrollView, View, Pressable } from 'react-native';
import { useReportTheme } from '@/report/theme';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Copy, Notice, Panel, ReportButton, ReportFrame } from '@/report/ui';
import { getLatestRecommendation, getOrCreateTodayRecommendation, readPlanInputs, saveTodayRecommendationPlan } from '@/services/recommendations';
import type { DailyPlan } from '@/types/database';
import { localDate } from '../../shared/journey.mjs';
import { savedDailyActivities } from '../../shared/daily-draft.mjs';
export default function YourDay() { const { user } = useAuth(); return user ? <Day key={user.id} userId={user.id}/> : null; }
function Day({ userId }: {
    userId: string;
}) {
    const router = useRouter();
    const {openDayEditor,dayVersion} = useTate();
    const [activities,setActivities]=useState<string[]>([]);
    const [catalog,setCatalog]=useState<RoutineCatalogProduct[]>([]);
    const [catalogLoading,setCatalogLoading]=useState(true);
    const [catalogError,setCatalogError]=useState('');
    const [catalogRetry,setCatalogRetry]=useState(0);
    useEffect(()=>{let alive=true;setCatalogLoading(true);setCatalogError('');getRoutineCatalogProducts().then(products=>{if(alive)setCatalog(products);}).catch(()=>{if(alive)setCatalogError('Could not load products. Please try again.');}).finally(()=>{if(alive)setCatalogLoading(false);});return()=>{alive=false;};},[catalogRetry]);
    const [failedImages,setFailedImages]=useState<Record<string,boolean>>({});
    const [full,setFull]=useState(false);
    const [sectionId,setSectionId]=useState('');
    const [wardrobe,setWardrobe]=useState<UserWardrobeItem[]>([]);
    useFocusEffect(useCallback(()=>{let alive=true;listUserWardrobe(userId).then(r=>{if(alive&&r.data)setWardrobe(r.data);});return()=>{alive=false;};},[userId]));
    const {theme:t}=useReportTheme();
    const [moment,setMoment]=useState<'morning'|'day'|'evening'>('morning');
    const [plan, setPlan] = useState<DailyPlan | null>(null);
    const [id, setId] = useState('');
    const [stale, setStale] = useState(false);
    const [refreshing, setRefreshing] = useState(true);
    const [regenerating,setRegenerating] = useState(false);
    const [loadFailed,setLoadFailed] = useState(false);
    const [loadedKey,setLoadedKey] = useState('');
    const [refreshRetry, setRefreshRetry] = useState(0);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [entryDate,setEntryDate]=useState('');
    const lock = useRef(false);
    const loadKey=`${userId}:${dayVersion}:${refreshRetry}`;
    useFocusEffect(useCallback(() => {
        // Reload the saved activities whenever Tate confirms a change.
        void dayVersion;
        void refreshRetry;
        setRefreshing(true); setLoadFailed(false); setError('');
        let alive = true;
        const timeout=setTimeout(()=>{if(!alive)return;alive=false;setPlan(null);setLoadFailed(true);setError('Loading your routine took too long. Please retry.');setLoadedKey(loadKey);setRefreshing(false);},25000);
        (async () => { const e = await supabase.from('daily_entries').select('*').eq('user_id', userId).eq('entry_date', localDate()).maybeSingle(); if (e.error)
        throw e.error; if (!alive)
        return; if (!e.data) {
        setId('');
        setStale(false);
        setActivities([]);
        setPlan(null);
        return;
    } setActivities(savedDailyActivities(e.data.check_in)); setId(e.data.id);setEntryDate(e.data.entry_date); const [saved, inputs] = await Promise.all([getLatestRecommendation(userId, e.data.id), readPlanInputs(userId, e.data.id)]); if (!alive)
        return; if (saved.error || inputs.error)
        throw saved.error || inputs.error;
        const needsUpdate = !saved.data || saved.data.dailyPlan.inputFingerprint !== inputs.data?.fingerprint;
        setStale(needsUpdate);
        setPlan(saved.data?.dailyPlan ?? null);

    })().catch(() => { if (alive) { setStale(true); setLoadFailed(true); setPlan(null); setError('Your saved routine could not be loaded. Please try again.'); } })
      .finally(() => { clearTimeout(timeout);if (alive) {setLoadedKey(loadKey);setRefreshing(false);} });
    return () => { alive = false; clearTimeout(timeout);setRefreshing(true); }; }, [userId,dayVersion,refreshRetry,loadKey]));
    async function run(fn: () => Promise<void>) { if (lock.current)
        return; lock.current = true; setBusy(true); setError(''); try {
        if(entryDate && entryDate!==localDate())throw Error('The date changed. Reopen Your Day to load today.');
        await fn();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Please retry.');
    }
    finally {
        setBusy(false);
        lock.current = false;
    } }
    const preview = !plan?.items?.length;
    const steps: [string, RoutineCatalogProduct['category']][] = moment==='morning'
      ? [['Cleanse','cleanser'],['Serum','serum'],['Treat','treatment'],['Moisturize','moisturizer'],['Protect','spf']]
      : moment==='day' ? [['Cleanse','cleanser'],['Moisturize','moisturizer'],['Protect','spf']]
      : [['Cleanse','cleanser'],['Serum','serum'],['Treat','treatment'],['Moisturize','moisturizer']];
    const catalogRows = steps.flatMap(([label,category])=>{
      const matches=catalog.filter(p=>p.category===category);
      const product=(moment==='evening'?matches[1]:undefined)||matches[0];
      return product?[{id:`catalog-${moment}-${product.id}`,label,reason:product.description||'',completed:false,moment,product}]:[];
    });
    const sections = plan?.sections || [];
    const personalized = sections.length > 0;
    const selectedSection = sections.find(s=>s.id===sectionId) || sections[0];
    const orderedItems = personalized ? sections.flatMap(section => (plan?.items || []).filter(item => section.itemIds.includes(item.id)).map(item => ({...item, sectionTitle:section.title}))) : (plan?.items || []).map(item=>({...item,sectionTitle:''}));
    const rows = preview ? (refreshing ? [] : catalogRows) : orderedItems.filter(i=>personalized ? selectedSection?.itemIds.includes(i.id) : full||i.moment===moment).map(i=>({...i,product:wardrobe.find(w=>w.product&&i.label.toLowerCase().includes(w.product.name.toLowerCase()))?.product}));
    if(refreshing || regenerating || loadedKey!==loadKey)return <RoutineLoading />;
    if(loadFailed)return <ReportFrame compact dark footer={false} showStyleGuide={false}><View style={{width:'100%',maxWidth:390,alignSelf:'center',gap:20}}><Copy kind="title">Your Routine</Copy><Panel><Notice>{error}</Notice><ReportButton label="Retry loading routine" onPress={()=>setRefreshRetry(v=>v+1)}/></Panel></View></ReportFrame>;
    if(preview)return <ReportFrame compact dark footer={false} showStyleGuide={false}><View style={{width:'100%',maxWidth:390,alignSelf:'center',gap:20}}><Copy kind="title">Your Routine</Copy><Panel><Copy>No routine saved for today yet.</Copy><ReportButton label="Go to Your Day" onPress={()=>router.push('/your-day')}/></Panel></View></ReportFrame>;
    return <ReportFrame compact dark fixed footer={false} showStyleGuide={false}>
      <View style={{width:'100%',maxWidth:390,alignSelf:'center',gap:12,flex:1,minHeight:0}}>
        <Copy kind="title" style={{paddingHorizontal:12,paddingTop:5,fontSize:32,lineHeight:36,fontWeight:'400',fontFamily:Platform.OS==='web'?'"Times New Roman", serif':Platform.OS==='ios'?'Times New Roman':'serif'}}>Your Routine</Copy>
        <Panel style={{padding:12,gap:0,borderRadius:20,flex:1,minHeight:0,overflow:'hidden'}}>
          {personalized ? <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{gap:8,paddingBottom:12}} style={{flexGrow:0,flexShrink:0}}>
            <View accessibilityRole="tablist" style={{flexDirection:'row',gap:8}}>{sections.map(section=><Pressable key={section.id} accessibilityRole="tab" accessibilityLabel={section.title} accessibilityState={{selected:selectedSection?.id===section.id}} aria-selected={selectedSection?.id===section.id} onPress={()=>{setSectionId(section.id);}} style={{minHeight:44,paddingHorizontal:16,justifyContent:'center',borderRadius:24,borderWidth:1,borderColor:t.ink,backgroundColor:selectedSection?.id===section.id?t.ink:'transparent'}}><Copy kind="small" style={{fontSize:12,color:selectedSection?.id===section.id?t.paper:t.ink}}>{section.title}</Copy></Pressable>)}</View>
          </ScrollView> : null}
          {!personalized ? <View accessibilityRole="tablist" style={{flexDirection:'row',gap:5,marginBottom:13}}>{(['morning','day','evening'] as const).map(m=><Pressable key={m} accessibilityRole="tab" accessibilityState={{selected:moment===m&&!full}} aria-selected={moment===m&&!full} onPress={()=>{setMoment(m);setFull(false);}} style={{flex:1,minHeight:38,alignItems:'center',justifyContent:'center',borderRadius:24,borderWidth:1,borderColor:moment===m&&!full?t.ink:'#EEE7DD',backgroundColor:moment===m&&!full?t.ink:'transparent'}}><Copy kind="small" style={{fontSize:11,color:moment===m&&!full?t.paper:t.ink}}>{m==='morning'?'Morning':m==='day'?'Daytime':'Evening'}</Copy></Pressable>)}</View> : null}
          <ScrollView key={`${selectedSection?.id || moment}-${full}`} style={{flex:1,minHeight:0}} contentContainerStyle={{paddingBottom:8}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
          {error?<Notice>{error}</Notice>:null}
          {activities.length ? <View style={{gap:8,padding:12,marginBottom:12,borderBottomWidth:1,borderColor:t.line}}><Copy style={{fontWeight:'600'}}>Your plan for today</Copy>{activities.map((activity,index)=><Copy key={`${index}-${activity}`} kind="small" style={{color:t.muted}}>• {activity}</Copy>)}</View> : null}
          {refreshing?<Copy kind="small" style={{padding:12,color:t.muted}}>Loading your saved routine…</Copy>:null}
          {!refreshing&&preview&&catalogLoading?<Copy kind="small" style={{padding:12,color:t.muted}}>Loading products…</Copy>:null}
          {preview&&catalogError?<View style={{gap:8}}><Notice>{catalogError}</Notice><ReportButton secondary label="Retry products" onPress={()=>setCatalogRetry(v=>v+1)}/></View>:null}
          {rows.map((item,index)=>{
            const product = item.product;
            const imageUrl = product?.image_url?.trim();
            const heading = 'sectionTitle' in item ? item.sectionTitle : '';
            const previous = rows[index-1];
            const previousHeading = previous && 'sectionTitle' in previous ? previous.sectionTitle : '';
            return <View key={item.id}>
              {heading && heading !== previousHeading ? <Copy kind="heading" style={{fontSize:20,color:t.ink,paddingTop:index?24:4,paddingBottom:8}}>{heading}</Copy> : null}
              <View style={{flexDirection:'row',alignItems:'flex-start',gap:8,paddingVertical:14,borderBottomWidth:index<rows.length-1?1:0,borderColor:'#EEE7DD'}}>
                <Pressable accessibilityRole="checkbox" accessibilityLabel={`${index+1}. ${item.label}`} accessibilityHint={stale?'Update your routine before changing completion.':item.completed?'Mark as not completed':'Mark as completed'} accessibilityState={{checked:!!item.completed,disabled:stale||busy,busy}} disabled={stale||busy} onPress={()=>run(async()=>{
                  if(!plan)return;
                  const current=await readPlanInputs(userId,id);if(current.error)throw current.error;
                  if(current.data?.fingerprint!==plan.inputFingerprint){setStale(true);throw Error('Your inputs changed. Update your routine before changing completion.');}
                  const next={...plan,items:plan.items?.map(i=>i.id===item.id?{...i,completed:!i.completed}:i)};
                  const saved=await saveTodayRecommendationPlan(userId,id,next);if(saved.error)throw saved.error;
                  setPlan(next);
                })} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',opacity:stale||busy?0.5:1}}>
                  <View style={{width:24,height:24,borderRadius:6,borderWidth:1.5,borderColor:item.completed?'#287552':t.ink,backgroundColor:item.completed?'#287552':'transparent',alignItems:'center',justifyContent:'center'}}>{item.completed?<Check size={16} color="#FFFFFF" accessible={false}/>:null}</View>
                </Pressable>
                {imageUrl && !failedImages[imageUrl] ? <Image source={{uri:imageUrl}} contentFit="contain" accessible={false} onError={()=>setFailedImages(current=>({...current,[imageUrl]:true}))} style={{width:42,height:60}}/> : null}
                <View style={{flex:1,gap:6,paddingTop:4}}>
                  <Copy style={{fontSize:13,lineHeight:18,fontWeight:'600',color:t.ink}}>{item.label}</Copy>
                  {product?<Copy kind="small" style={{fontSize:11,lineHeight:16,color:t.muted}}>{`${product.brand?.name||''} ${product.name}`.trim()}</Copy>:null}
                  <Copy kind="small" style={{color:t.muted}}>{item.reason||product?.description||'Follow the product’s directions.'}</Copy>
                </View>
              </View>
            </View>;
          })}
          {!refreshing&&!stale&&!rows.length&&!catalogLoading&&!catalogError?<Copy kind="small" style={{padding:16,color:t.muted}}>No steps saved for this part of your day.</Copy>:null}
          </ScrollView>
          <View style={{gap:10,paddingTop:12,flexShrink:0,borderTopWidth:1,borderColor:t.line}}>
            {!preview&&!personalized?<ReportButton copper label={full?'View Selected Routine':'View Full Routine'} busy={busy} onPress={()=>setFull(v=>!v)}/>:null}
            {stale&&!refreshing?<ReportButton secondary label="Update my routine" busy={busy} onPress={()=>void run(async()=>{setRegenerating(true);try{const result=await getOrCreateTodayRecommendation(userId,id);if(result.error||!result.data)throw Error("Your inputs are saved. Routine update failed; please try again.");setPlan(result.data.dailyPlan);setStale(false);}finally{setRegenerating(false);}})}/>:null}
            <Pressable accessibilityRole="button" accessibilityLabel="Adjust with Tate" onPress={openDayEditor} style={{minHeight:49,borderRadius:28,backgroundColor:'#031723',flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:12}}><Image source={require('@/assets/images/nautilus-daily-v4.png')} accessible={false} contentFit="contain" style={{width:32,height:32}}/><Copy style={{flex:1,textAlign:'center',marginRight:32,fontSize:13,color:'#FFFAF2'}}>Adjust with Tate</Copy></Pressable>
          </View>
        </Panel>
      </View>
    </ReportFrame>;
}

// Static placeholders avoid shimmer and respect reduced-motion preferences by default.
export function RoutineLoading(){
 const {theme:t}=useReportTheme();
 const block=(width:number|`${number}%`,height:number,radius=8)=><View style={{width,height,borderRadius:radius,backgroundColor:'#D9D3C9'}}/>;
 return <ReportFrame compact dark fixed footer={false} showStyleGuide={false}>
  <View accessibilityRole="progressbar" accessibilityLabel="Loading your routine" accessibilityState={{busy:true}} style={{width:'100%',maxWidth:390,alignSelf:'center',gap:16,flex:1,minHeight:0}}>
   <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{gap:16,flex:1,minHeight:0}}>
    <View style={{paddingHorizontal:12,paddingTop:8}}>{block('65%',34)}</View>
    <Panel style={{padding:16,gap:22,borderRadius:20,flex:1,overflow:'hidden'}}>
     <View style={{flexDirection:'row',gap:8}}>{block('30%',42,24)}{block('35%',42,24)}{block('25%',42,24)}</View>
     {[0,1,2,3].map(i=><View key={i} style={{flexDirection:'row',gap:14,alignItems:'center',minHeight:64}}>{block(26,26,13)}<View style={{flex:1,gap:10}}>{block(i%2?'72%':'90%',16)}{block('55%',12)}</View></View>)}
     <View style={{marginTop:'auto',paddingTop:12}}>{block('100%',49,26)}</View>
    </Panel>
   </View>
   <Copy kind="small" style={{color:t.paper}}>Loading your routine…</Copy>
  </View>
 </ReportFrame>;
}
