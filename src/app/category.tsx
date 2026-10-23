import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { Copy, Panel, ReportButton, ReportFrame } from '@/report/ui';
import { categories } from '@/experience/categories';
export default function Category() {
  const { id } = useLocalSearchParams<{id:string}>();
  const c = categories.find(item => item.id === id && item.upcoming);
  const router = useRouter();
  return <ReportFrame compact dark footer={false} showStyleGuide={false}>
    <ReportButton secondary label="All categories" onPress={()=>router.push('/explore')}/>
    {c ? <><Copy kind="eyebrow">YOUR SUBSTRATE · COMING SOON</Copy><Copy kind="title">{c.title}</Copy><Image source={c.artwork} accessible={false} contentFit="cover" style={{height:190,width:"100%",borderRadius:16}}/><Panel><Copy kind="heading">{c.subtitle}</Copy><Copy>{c.description}</Copy>{c.features?.map(f=><Copy key={f} kind="small">{f}</Copy>)}<Copy kind="small" style={{color:"#536478"}}>This experience is not available yet.</Copy></Panel>{c.id==='cart'||c.id==='science'?<ReportButton copper label="Explore the product catalog" onPress={()=>router.push('/shop')}/>:null}<ReportButton secondary label="Explore your skin wardrobe" onPress={()=>router.push('/skin-wardrobe' as Href)}/></> : <Copy kind="title">Category unavailable</Copy>}
  </ReportFrame>;
}
