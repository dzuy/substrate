import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { Copy, Notice, SummaryGrid, ReportButton, ReportFrame } from '@/report/ui';
import { loadJourney } from '@/services/journey';
import { getProfile, toProfileContext } from '@/services/profile';
import { listUserWardrobe } from '@/services/catalog';
import { summaryCards, stableInput } from '../../shared/journey.mjs';
export default function Summary() { const { user } = useAuth(); const router = useRouter(); const [cards, setCards] = useState<ReturnType<typeof summaryCards>>([]); const [date, setDate] = useState(''); const [error, setError] = useState('');const [stale,setStale]=useState(false); useFocusEffect(useCallback(() => { let alive = true; if (user)
    Promise.all([loadJourney(user.id), getProfile(user.id), listUserWardrobe(user.id)]).then(([j, p, w]) => { if (!alive)
        return; if (p.error || w.error)
        throw p.error || w.error; setCards(summaryCards(j.state.report || null, toProfileContext(p.data), w.data || [])); setDate(j.state.report?.createdAt || '');setStale(j.state.report?.provenance.journeyInput!==stableInput({profile:toProfileContext(p.data),wardrobe:w.data||[]})); }).catch(() => { if (alive)
        setError('Summary context unavailable. Retry by reopening this page.'); }); return () => { alive = false; }; }, [user])); return <ReportFrame showStyleGuide={false}><Copy kind="eyebrow">MEMBER SUMMARY</Copy><Copy kind="title">Here’s what we learned about your skin.</Copy>{error ? <Notice>{error}</Notice> : null}{date ? <Notice>Photo and ingredient findings are dated {new Date(date).toLocaleString()}. Profile and wardrobe may have changed since then. Review your baseline before treating it as current.</Notice> : <Copy>Complete setup or reuse a saved report to create a baseline summary.</Copy>}{stale && date ? <Notice>This baseline does not match the current profile/wardrobe, or predates change tracking. Update the baseline before relying on its personalized guidance.</Notice> : null}<SummaryGrid cards={cards}/><ReportButton label="Review baseline setup" onPress={() => router.push('/onboarding' as Href)}/><ReportButton secondary label="Saved report history" onPress={() => router.push('/past-reports' as Href)}/></ReportFrame>; }
