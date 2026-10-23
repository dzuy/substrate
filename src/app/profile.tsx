import { useRouter, type Href } from 'expo-router';
import { ShoppingBag, CreditCard, UserRound, ChevronRight, FileText } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Copy, Panel, ReportFrame } from '@/report/ui';
import { useReportTheme } from '@/report/theme';
import { useAuth } from '@/lib/auth-context';
export default function Profile(){
 const router=useRouter();const {theme:t}=useReportTheme();const {user}=useAuth();
 const links=[{label:'Your Products',body:'Your Skin Wardrobe',route:'/skin-wardrobe',icon:ShoppingBag},{label:'Membership',body:'Plan & membership status',route:'/membership',icon:CreditCard},{label:'Your details',body:'Profile, preferences & account',route:'/you',icon:UserRound},{label:'Saved insights',body:'Your skin report history',route:'/past-reports',icon:FileText}];
 return <ReportFrame compact dark footer={false} showStyleGuide={false}><Copy kind="eyebrow">PROFILE</Copy><Copy kind="title">A little about you.</Copy><Copy kind="small">{user?.email}</Copy><Panel style={{padding:0,gap:0}}>{links.map(({label,body,route,icon:Icon},i)=><Pressable key={route} accessibilityRole="button" onPress={()=>router.push(route as Href)} style={({pressed})=>({padding:18,minHeight:76,flexDirection:'row',gap:14,alignItems:'center',borderBottomWidth:i<links.length-1?1:0,borderColor:t.line,opacity:pressed?0.7:1})}><Icon size={22} color={t.gold}/><View style={{flex:1,gap:3}}><Copy style={{fontWeight:'600'}}>{label}</Copy><Copy kind="small" style={{color:t.muted}}>{body}</Copy></View><ChevronRight size={17} color={t.muted}/></Pressable>)}</Panel></ReportFrame>;
}
