import { useEffect, useState } from 'react';
import { Platform, Pressable, TextInput, View, type StyleProp } from 'react-native';
import { Image, type ImageStyle } from 'expo-image';
import { ChevronRight, Search, X } from 'lucide-react-native';
import { Copy } from '@/report/ui';
import { fontFamily, useReportTheme } from '@/report/theme';
import { productArtwork } from '@/experience/product-artwork';

export type ProductTile = {
  id: string;
  name: string;
  category: string;
  image_url?: string | null;
  brand?: { name: string } | null;
  status?: string;
  subtitle?: string;
};

export function ProductImage({product,style,accessible=false}:{product:Pick<ProductTile,'name'|'category'|'image_url'>;style?:StyleProp<ImageStyle>;accessible?:boolean}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[product.image_url]);
  return <Image source={product.image_url&&!failed?{uri:product.image_url}:productArtwork(product.category)} contentFit="contain" accessible={accessible} accessibilityLabel={accessible?product.name:undefined} onError={()=>setFailed(true)} style={style}/>;
}

export function ProductCard({product,onPress,actionLabel='View product'}:{product:ProductTile;onPress:()=>void;actionLabel?:string}) {
  const {theme:t}=useReportTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${product.brand?.name||''} ${product.name}${product.status?`, ${product.status}`:''}`} onPress={onPress} style={({pressed})=>({flex:1,borderRadius:16,overflow:'hidden',backgroundColor:'#FFFAF2',opacity:pressed?0.8:1})}>
    <View style={{height:145,backgroundColor:'#F3EDE3',padding:15,alignItems:'center'}}><ProductImage product={product} style={{width:'100%',height:'100%'}}/>{product.status?<View style={{position:'absolute',right:8,top:8,borderRadius:12,paddingHorizontal:8,paddingVertical:3,backgroundColor:'#FFFAF2EB'}}><Copy kind="small" style={{color:t.ink,fontSize:10}}>{product.status}</Copy></View>:null}</View>
    <View style={{padding:12,gap:4,minHeight:113}}><Copy kind="small" style={{fontSize:10,lineHeight:14,color:t.muted,letterSpacing:0.3}}>{product.brand?.name||product.category}</Copy><Copy style={{fontSize:13,lineHeight:17,fontWeight:'600',color:t.ink}}>{product.name}</Copy>{product.subtitle?<Copy kind="small" style={{fontSize:10,lineHeight:14,color:t.muted}}>{product.subtitle}</Copy>:null}<View style={{flexDirection:'row',alignItems:'center',gap:3,marginTop:3}}><Copy kind="small" style={{fontSize:11,color:t.muted}}>{actionLabel}</Copy><ChevronRight size={12} color={t.muted}/></View></View>
  </Pressable>;
}

export function ProductGrid({products,onSelect,actionLabel}:{products:ProductTile[];onSelect:(id:string)=>void;actionLabel?:string}) {
  return <View style={{flexDirection:'row',flexWrap:'wrap',gap:9}}>{products.map(product=><View key={product.id} style={{flexBasis:'48%',flexGrow:1,maxWidth:'50%'}}><ProductCard product={product} onPress={()=>onSelect(product.id)} actionLabel={actionLabel}/></View>)}</View>;
}

export function ProductSearch({value,onChange,placeholder='Search product names'}:{value:string;onChange:(value:string)=>void;placeholder?:string}) {
  const {theme:t}=useReportTheme();
  return <View style={{flex:1,flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:13,borderRadius:24,backgroundColor:'#FFFAF2',minHeight:46}}><Search size={19} color={t.muted}/><TextInput accessibilityLabel="Search products" placeholder={placeholder} placeholderTextColor={t.muted} value={value} onChangeText={onChange} style={{...(Platform.OS === 'web' ? {outlineWidth:0} : {}),flex:1,minWidth:0,minHeight:46,fontFamily:fontFamily(t.bodyFont),fontSize:16,color:t.ink}}/>{value?<Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={()=>onChange('')} style={{width:32,height:44,alignItems:'center',justifyContent:'center'}}><X size={16} color={t.ink}/></Pressable>:null}</View>;
}
