import { useRouter, type Href } from 'expo-router';
import { Platform, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { ArrowRight } from 'lucide-react-native';
import { Copy, ReportFrame } from '@/report/ui';
import { useReportTheme } from '@/report/theme';
import { categories } from '@/experience/categories';

export default function Explore() {
  const router = useRouter();
  const { theme: t } = useReportTheme();
  const go = (path: string) => router.push(path as Href);
  const collabs = categories.find(c => c.id === 'collabs')!;
  const grid = categories.filter(c => c.id !== 'collabs');
  return <ReportFrame compact dark footer={false} showStyleGuide={false}>
    <View style={{width:'100%',maxWidth:390,alignSelf:'center',gap:12}}>
      <View style={{gap:4,paddingHorizontal:12,paddingTop:5}}>
        <Copy kind="title" style={{fontSize:28,lineHeight:32,fontWeight:'400',letterSpacing:-0.6,fontFamily:Platform.OS==='web'?'"Times New Roman", serif':Platform.OS==='ios'?'Times New Roman':'serif'}}>Your Inside-Out Experience</Copy>
        <Copy style={{fontSize:14,lineHeight:20}}>Tap a category to explore.</Copy>
      </View>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>
        {grid.map(c=><Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Open ${c.title}${c.upcoming?' · coming soon':''}`} onPress={()=>go(c.route)} style={({pressed})=>({flexBasis:'48%',flexGrow:1,opacity:pressed?0.8:1,borderRadius:15,overflow:'hidden',backgroundColor:'#FFFCF7',borderWidth:1,borderColor:'#E8E2D9'})}>
          <Image source={c.artwork} accessible={false} contentFit="cover" contentPosition="center" style={{width:'100%',aspectRatio:1.8}}/>
          <View style={{paddingHorizontal:10,paddingTop:7,paddingBottom:8,minHeight:49,gap:1}}>
            <Copy style={{fontSize:13,lineHeight:17,fontWeight:'600',color:t.ink}}>{c.title}</Copy>
            <Copy kind="small" style={{fontSize:10.5,lineHeight:14,color:'#3D5265'}}>{c.subtitle}</Copy>
          </View>
        </Pressable>)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open Collabs · coming soon" onPress={()=>go(collabs.route)} style={({pressed})=>({flexDirection:'row',alignItems:'center',borderRadius:15,overflow:'hidden',backgroundColor:'#FFFCF7',opacity:pressed?0.8:1})}>
        <Image source={collabs.artwork} accessible={false} contentFit="cover" style={{width:90,height:74}}/>
        <View style={{flex:1,paddingHorizontal:12,gap:3}}><Copy style={{fontSize:13,lineHeight:17,fontWeight:'600',color:t.ink}}>Collabs</Copy><Copy kind="small" style={{fontSize:11,lineHeight:15,color:t.muted}}>Routines, recipes & inspiration</Copy></View>
        <ArrowRight size={17} color={t.ink} style={{marginRight:14}}/>
      </Pressable>
    </View>
  </ReportFrame>;
}
