import { useTate } from "@/components/tate-drawer";
import { getRoutineCatalogProducts, type RoutineCatalogProduct } from '@/services/routine-catalog';
import { Image } from 'expo-image';
import { ChevronRight, ChevronDown } from 'lucide-react-native';
import { listUserWardrobe, type UserWardrobeItem } from '@/services/catalog';
import { Platform, ScrollView, View, Pressable } from 'react-native';
import { useReportTheme } from '@/report/theme';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
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
    const {openDayEditor,dayVersion} = useTate();
    const [activities,setActivities]=useState<string[]>([]);
    const [catalog,setCatalog]=useState<RoutineCatalogProduct[]>([]);
    const [catalogLoading,setCatalogLoading]=useState(true);
    const [catalogError,setCatalogError]=useState('');
    const [catalogRetry,setCatalogRetry]=useState(0);
    useEffect(()=>{let alive=true;setCatalogLoading(true);setCatalogError('');getRoutineCatalogProducts().then(products=>{if(alive)setCatalog(products);}).catch(()=>{if(alive)setCatalogError('Could not load products. Please try again.');}).finally(()=>{if(alive)setCatalogLoading(false);});return()=>{alive=false;};},[catalogRetry]);
    const [expanded,setExpanded]=useState<string|null>(null);
    const [full,setFull]=useState(false);
    const [wardrobe,setWardrobe]=useState<UserWardrobeItem[]>([]);
    useFocusEffect(useCallback(()=>{let alive=true;listUserWardrobe(userId).then(r=>{if(alive&&r.data)setWardrobe(r.data);});return()=>{alive=false;};},[userId]));
    const {theme:t}=useReportTheme();
    const [moment,setMoment]=useState<'morning'|'day'|'evening'>('morning');
    const [plan, setPlan] = useState<DailyPlan | null>(null);
    const [id, setId] = useState('');
    const [stale, setStale] = useState(false);
    const [refreshing, setRefreshing] = useState(true);
    const [refreshRetry, setRefreshRetry] = useState(0);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [legacy, setLegacy] = useState(false);const [entryDate,setEntryDate]=useState('');
    const lock = useRef(false);
    useFocusEffect(useCallback(() => {
        // Reload the saved activities whenever Tate confirms a change.
        void dayVersion;
        void refreshRetry;
        setRefreshing(true); setError('');
        let alive = true; (async () => { const e = await supabase.from('daily_entries').select('*').eq('user_id', userId).eq('entry_date', localDate()).maybeSingle(); if (e.error)
        throw e.error; if (!alive)
        return; if (!e.data) {
        setId('');
        setStale(false);
        setActivities([]);
        setPlan(null);
        return;
    } setActivities(savedDailyActivities(e.data.check_in)); setId(e.data.id);setEntryDate(e.data.entry_date); setLegacy(e.data.check_in.journeyVersion !== 1); const [saved, inputs] = await Promise.all([getLatestRecommendation(userId, e.data.id), readPlanInputs(userId, e.data.id)]); if (!alive)
        return; if (saved.error || inputs.error)
        throw saved.error || inputs.error;
        const needsUpdate = !saved.data || saved.data.dailyPlan.inputFingerprint !== inputs.data?.fingerprint;
        setStale(needsUpdate);
        if (needsUpdate) {
            const updated = await getOrCreateTodayRecommendation(userId, e.data.id);
            if (!alive) return;
            if (updated.error || !updated.data) throw updated.error || Error('Routine unavailable.');
            setPlan(updated.data.dailyPlan);
        } else setPlan(saved.data.dailyPlan);
        setStale(false);
    })().catch(() => { if (alive) { setStale(true); setError('Your routine could not be updated. Please try again.'); } })
      .finally(() => { if (alive) setRefreshing(false); });
    return () => { alive = false; }; }, [userId,dayVersion,refreshRetry]));
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
    const rows = refreshing || stale ? [] : preview ? catalogRows : plan.items!.filter(i=>full||i.moment===moment).map(i=>({...i,product:wardrobe.find(w=>w.product&&i.label.toLowerCase().includes(w.product.name.toLowerCase()))?.product}));
    return <ReportFrame compact dark fixed footer={false} showStyleGuide={false}>
      <View style={{width:'100%',maxWidth:390,alignSelf:'center',gap:12,flex:1,minHeight:0}}>
        <Copy kind="title" style={{paddingHorizontal:12,paddingTop:5,fontSize:32,lineHeight:36,fontWeight:'400',fontFamily:Platform.OS==='web'?'"Times New Roman", serif':Platform.OS==='ios'?'Times New Roman':'serif'}}>Your Routine</Copy>
        <Panel style={{padding:12,gap:0,borderRadius:20,flex:1,minHeight:0,overflow:'hidden'}}>
          <View accessibilityRole="tablist" style={{flexDirection:'row',gap:5,marginBottom:13}}>{(['morning','day','evening'] as const).map(m=><Pressable key={m} accessibilityRole="tab" accessibilityState={{selected:moment===m&&!full}} aria-selected={moment===m&&!full} onPress={()=>{setMoment(m);setFull(false);setExpanded(null);}} style={{flex:1,minHeight:38,alignItems:'center',justifyContent:'center',borderRadius:24,borderWidth:1,borderColor:moment===m&&!full?t.ink:'#EEE7DD',backgroundColor:moment===m&&!full?t.ink:'transparent'}}><Copy kind="small" style={{fontSize:11,color:moment===m&&!full?t.paper:t.ink}}>{m==='morning'?'Morning':m==='day'?'Pre-workout':'Evening'}</Copy></Pressable>)}</View>
          <ScrollView key={`${moment}-${full}`} style={{flex:1,minHeight:0}} contentContainerStyle={{paddingBottom:8}} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
          {error?<Notice>{error}</Notice>:null}
          {activities.length ? <View style={{gap:8,padding:12,marginBottom:12,borderBottomWidth:1,borderColor:t.line}}><Copy style={{fontWeight:'600'}}>Your plan for today</Copy>{activities.map((activity,index)=><Copy key={`${index}-${activity}`} kind="small" style={{color:t.muted}}>• {activity}</Copy>)}</View> : null}
          {legacy&&!preview?<Notice>Confirm a new daily check-in to update this older routine.</Notice>:null}
          {refreshing?<Copy kind="small" style={{padding:12,color:t.muted}}>Updating your routine…</Copy>:null}
          {!refreshing&&preview&&catalogLoading?<Copy kind="small" style={{padding:12,color:t.muted}}>Loading products…</Copy>:null}
          {preview&&catalogError?<View style={{gap:8}}><Notice>{catalogError}</Notice><ReportButton secondary label="Retry products" onPress={()=>setCatalogRetry(v=>v+1)}/></View>:null}
          {rows.map((item,index)=>{
            const product = item.product;
            const artwork = product?.category==='cleanser' ? require('@/assets/images/products/cleanser-v1.png') : product?.category==='moisturizer' || product?.category==='spf' ? require('@/assets/images/products/moisturizer-v1.png') : product?.category==='treatment' ? require('@/assets/images/products/treatment-v1.png') : require('@/assets/images/products/serum-v1.png');
            return <View key={item.id}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${index+1}. ${item.label}`} onPress={()=>setExpanded(expanded===item.id?null:item.id)} style={{flexDirection:'row',alignItems:'center',gap:12,minHeight:72,borderBottomWidth:index<rows.length-1?1:0,borderColor:'#EEE7DD'}}>
                <View style={{width:26,height:26,borderRadius:14,borderWidth:1,borderColor:'#E9E1D6',alignItems:'center',justifyContent:'center'}}><Copy style={{fontSize:14,color:t.ink}}>{index+1}</Copy></View>
                <Image source={product?.image_url?{uri:product.image_url}:artwork} contentFit="contain" accessible={false} style={{width:42,height:60}}/>
                <View style={{flex:1,gap:3}}><Copy style={{fontSize:13,lineHeight:18,fontWeight:'600',color:t.ink}}>{item.label}</Copy><Copy kind="small" style={{fontSize:11,lineHeight:16,color:t.muted}}>{product?`${product.brand?.name||''} ${product.name}`.trim():preview?item.reason:item.completed?'Completed':'Tap for details'}</Copy></View>
                {expanded===item.id?<ChevronDown size={16} color={t.muted}/>:<ChevronRight size={16} color={t.muted}/>} 
              </Pressable>
              {expanded===item.id?<View style={{padding:12,gap:10}}><Copy kind="small" style={{color:t.muted}}>{item.reason||product?.name||'Follow the product’s directions.'}</Copy>{!preview?<ReportButton secondary label={item.completed?'Completed · undo':'Mark complete'} disabled={stale||legacy} busy={busy} onPress={()=>void run(async()=>{if(!plan)return;const current=await readPlanInputs(userId,id);if(current.error)throw current.error;if(current.data?.fingerprint!==plan.inputFingerprint){setStale(true);setRefreshRetry(v=>v+1);return;}const next={...plan,items:plan.items?.map(i=>i.id===item.id?{...i,completed:!i.completed}:i)};const saved=await saveTodayRecommendationPlan(userId,id,next);if(saved.error)throw saved.error;setPlan(next);})}/>:null}</View>:null}
            </View>;
          })}
          {!refreshing&&!stale&&!rows.length&&!catalogLoading&&!catalogError?<Copy kind="small" style={{padding:16,color:t.muted}}>No steps saved for this part of your day.</Copy>:null}
          </ScrollView>
          <View style={{gap:10,paddingTop:12,flexShrink:0,borderTopWidth:1,borderColor:t.line}}>
            {!preview?<ReportButton copper label={full?'View Selected Routine':'View Full Routine'} busy={busy} onPress={()=>setFull(v=>!v)}/>:null}
            {stale&&!refreshing?<ReportButton secondary label="Retry routine update" busy={busy} onPress={()=>setRefreshRetry(v=>v+1)}/>:null}
            <Pressable accessibilityRole="button" accessibilityLabel="Adjust with Tate" onPress={openDayEditor} style={{minHeight:49,borderRadius:28,backgroundColor:'#031723',flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:12}}><Image source={require('@/assets/images/nautilus-daily-v4.png')} accessible={false} contentFit="contain" style={{width:32,height:32}}/><Copy style={{flex:1,textAlign:'center',marginRight:32,fontSize:13,color:'#FFFAF2'}}>Adjust with Tate</Copy></Pressable>
          </View>
        </Panel>
      </View>
    </ReportFrame>;
}
