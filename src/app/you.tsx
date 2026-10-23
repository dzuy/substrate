import { useTate } from "@/components/tate-drawer";
import { useRouter, type Href } from 'expo-router';
import { Copy, Panel, ReportButton, ReportFrame } from '@/report/ui';
import { ProfileContent } from '@/components/profile-content';
export default function You() { const router = useRouter(); const {openTate}=useTate(); return <ReportFrame showStyleGuide={false}><Copy kind="eyebrow">YOU</Copy><Copy kind="title">Your context matters.</Copy><Panel><Copy>Subscription experience: simulation only. No payment has been collected or subscription activated. Wearable connections are unavailable.</Copy><ReportButton secondary label="Setup & wellness preferences" onPress={() => router.push('/onboarding' as Href)}/><ReportButton secondary label="Saved report history" onPress={() => router.push('/past-reports' as Href)}/><ReportButton secondary label="Ask Tate about skincare" onPress={() => openTate()}/></Panel><ProfileContent onNavigate={() => { }}/></ReportFrame>; }
