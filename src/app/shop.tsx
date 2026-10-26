import { ProductGrid, ProductImage, ProductSearch } from '@/components/product-grid';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { X, SlidersHorizontal } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Copy, Notice, ReportButton, ReportFrame } from '@/report/ui';
import { useReportTheme } from '@/report/theme';
import { getCatalogProduct, type CatalogProduct } from '@/services/catalog';
import type { ProductCategory } from '@/types/database';

type Row = { id: string; name: string; category: ProductCategory; image_url: string | null; brand: { name: string } | null };
const filters: { value: ProductCategory | 'all'; label: string }[] = [
  { value:'all',label:'All' }, { value:'cleanser',label:'Cleansers' }, { value:'serum',label:'Serums' },
  { value:'moisturizer',label:'Moisturizers' }, { value:'spf',label:'SPF' }, { value:'treatment',label:'Treatments' },
  { value:'toner',label:'Toners' }, { value:'essence',label:'Essences' }, { value:'oil',label:'Oils' },
  { value:'mask',label:'Masks' }, { value:'exfoliant',label:'Exfoliants' }, { value:'retinoid',label:'Retinoids' },
  { value:'device',label:'Devices' }, { value:'other',label:'Other' },
];
const pageSize = 12;
export default function Shop() {
  const {theme:t}=useReportTheme();
  const [query,setQuery]=useState('');
  const [search,setSearch]=useState('');
  const [category,setCategory]=useState<ProductCategory|'all'>('all');
  const [page,setPage]=useState(0);
  const [rows,setRows]=useState<Row[]>([]);
  const [count,setCount]=useState(0);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const [showFilters,setShowFilters]=useState(false);
  const [selected,setSelected]=useState<Row|null>(null);
  const [detail,setDetail]=useState<CatalogProduct|null>(null);
  const [detailError,setDetailError]=useState('');
  const [detailBusy,setDetailBusy]=useState(false);
  const detailRequest=useRef(0);
  const list=useRef<ScrollView>(null);
  useEffect(()=>{const timer=setTimeout(()=>{setSearch(query.trim());setPage(0);},250);return()=>clearTimeout(timer);},[query]);
  useEffect(()=>{
    let alive=true;setBusy(true);setError('');setRows([]);
    let q=supabase.from('products').select('id,name,category,image_url,brand:brands(name)',{count:'exact'})
      .is('archived_at',null).order('name').order('id').range(page*pageSize,(page+1)*pageSize-1);
    if(search)q=q.ilike('name',`%${search.replace(/[%_\\]/g,'')}%`);
    if(category!=='all')q=q.eq('category',category);
    Promise.resolve(q).then(r=>{if(!alive)return;if(r.error)throw r.error;setRows((r.data||[]) as unknown as Row[]);setCount(r.count||0);})
      .catch(()=>{if(alive)setError('Could not load products. Please try again.');})
      .finally(()=>{if(alive)setBusy(false);});
    return()=>{alive=false;};
  },[search,category,page,retry]);
  function chooseCategory(value:ProductCategory|'all'){setCategory(value);setPage(0);list.current?.scrollTo({y:0,animated:false});}
  function closeDetail(){detailRequest.current++;setSelected(null);setDetail(null);setDetailBusy(false);}
  async function openDetail(row:Row){
    const request=++detailRequest.current;setSelected(row);setDetail(null);setDetailError('');setDetailBusy(true);
    try{const r=await getCatalogProduct(row.id);if(request!==detailRequest.current)return;if(r.error||!r.data)throw Error();setDetail(r.data);}
    catch{if(request===detailRequest.current)setDetailError('Could not load product details.');}
    finally{if(request===detailRequest.current)setDetailBusy(false);}
  }
  const filterControls=filters.map(f=><Pressable key={f.value} accessibilityRole="button" accessibilityState={{selected:category===f.value}} onPress={()=>chooseCategory(f.value)} style={{minHeight:36,paddingHorizontal:15,borderRadius:22,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:category===f.value?'#F1C28E':'#52616B',backgroundColor:category===f.value?'#F1C28E':'transparent'}}><Copy kind="small" style={{fontSize:12,color:category===f.value?t.ink:t.paper}}>{f.label}</Copy></Pressable>);
  return <ReportFrame compact dark fixed footer={false} showStyleGuide={false}>
    <View style={{flex:1,minHeight:0,width:'100%',maxWidth:440,alignSelf:'center',gap:12}}>
      <View style={{paddingHorizontal:10,gap:4}}><Copy kind="title" style={{fontSize:32,fontWeight:'400',fontFamily:Platform.OS==='web'?'"Times New Roman", serif':Platform.OS==='ios'?'Times New Roman':'serif'}}>Your Skin Shop</Copy><Copy style={{fontSize:13}}>Explore products for your skin.</Copy></View>
      <View style={{flexDirection:'row',gap:8}}>
        <ProductSearch value={query} onChange={setQuery}/>
        <Pressable accessibilityRole="button" accessibilityLabel="Show category filters" accessibilityState={{expanded:showFilters}} onPress={()=>setShowFilters(v=>!v)} style={{width:46,height:46,borderRadius:23,borderWidth:1,borderColor:'#52616B',alignItems:'center',justifyContent:'center'}}><SlidersHorizontal size={20} color="#F1C28E"/></Pressable>
      </View>
      {showFilters?<View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{filterControls}</View>:<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0,flexShrink:0}} contentContainerStyle={{gap:6}}>{filterControls}</ScrollView>}
      <View style={{flex:1,minHeight:0}}>
        <ScrollView ref={list} keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:10,paddingBottom:8}}>
          {busy?<ActivityIndicator accessibilityLabel="Loading products" color="#F1C28E" style={{padding:28}}/>:error?<><Notice>{error}</Notice><ReportButton label="Retry" onPress={()=>setRetry(v=>v+1)}/></>:<>
            <Copy kind="small" style={{fontSize:11,color:'#C7D0D6',paddingHorizontal:3}}>{count} {count===1?'product':'products'}</Copy>
            {!rows.length?<View style={{padding:25,gap:12}}><Copy kind="heading">No products found.</Copy><Copy kind="small">Try another search or category.</Copy><ReportButton secondary label="Clear filters" onPress={()=>{setQuery('');setSearch('');chooseCategory('all');}}/></View>:null}
            <ProductGrid products={rows} onSelect={id=>{const row=rows.find(r=>r.id===id);if(row)void openDetail(row);}}/>
            {count>pageSize?<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,paddingVertical:8}}><ReportButton secondary label="Previous" disabled={!page} onPress={()=>{setPage(p=>p-1);list.current?.scrollTo({y:0,animated:false});}}/><Copy kind="small">{page+1} / {Math.ceil(count/pageSize)}</Copy><ReportButton secondary label="Next" disabled={(page+1)*pageSize>=count} onPress={()=>{setPage(p=>p+1);list.current?.scrollTo({y:0,animated:false});}}/></View>:null}
          </>}
        </ScrollView>
      </View>
    </View>
    <Modal visible={!!selected} transparent animationType="slide" onRequestClose={closeDetail}>
      <View style={{flex:1,backgroundColor:'#00000088',justifyContent:'flex-end'}}><SafeAreaView edges={['bottom']} style={{maxHeight:'90%',width:'100%',maxWidth:500,alignSelf:'center',backgroundColor:t.paper,borderTopLeftRadius:24,borderTopRightRadius:24,overflow:'hidden'}}>
        <View style={{alignItems:'flex-end',paddingHorizontal:10,paddingTop:6}}><Pressable accessibilityRole="button" accessibilityLabel="Close product" onPress={closeDetail} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><X size={22} color={t.ink}/></Pressable></View>
        <ScrollView contentContainerStyle={{paddingHorizontal:22,paddingBottom:24,gap:13}}>{selected?<><ProductImage product={selected} accessible style={{height:200,width:'100%'}}/><Copy kind="small" style={{color:t.muted}}>{selected.brand?.name}</Copy><Copy kind="heading" style={{color:t.ink}}>{selected.name}</Copy>{detailBusy?<ActivityIndicator color={t.gold}/>:null}{detailError?<><Notice>{detailError}</Notice><ReportButton label="Retry details" onPress={()=>void openDetail(selected)}/></>:null}{detail?<><Copy style={{color:t.ink,fontSize:14}}>{detail.description||''}</Copy><Copy kind="heading" style={{color:t.ink,fontSize:20}}>Ingredients</Copy><Copy kind="small" style={{color:t.muted}}>{detail.ingredients.map(i=>i.ingredient?.inci_name||i.ingredient?.name).filter(Boolean).join(', ')||'Ingredient details are not available yet.'}</Copy></>:null}</>:null}</ScrollView>
      </SafeAreaView></View>
    </Modal>
  </ReportFrame>;
}
