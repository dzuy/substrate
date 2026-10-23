import { useRouter } from 'expo-router';
import { Copy, Panel, ReportButton, ReportFrame } from '@/report/ui';
export default function Membership(){
 const router=useRouter();
 return <ReportFrame compact dark footer={false} showStyleGuide={false}><Copy kind="eyebrow">PROFILE · MEMBERSHIP</Copy><Copy kind="title">Your SUBSTRATE membership</Copy><Panel><Copy kind="eyebrow">MEMBERSHIP PREVIEW</Copy><Copy kind="title">$19.99<Copy> / month</Copy></Copy><Copy>This is a preview. No payment has been collected and no subscription is active.</Copy><Copy kind="small">Billing and membership management are coming soon.</Copy><ReportButton copper label="Review setup & first insights" onPress={()=>router.push('/onboarding')}/></Panel><ReportButton secondary label="Back to Profile" onPress={()=>router.push('/profile')}/></ReportFrame>;
}
