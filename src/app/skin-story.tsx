import { Link, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import {
  AppShell,
  BackLink,
  Card,
  MetricRing,
  PrimaryButton,
  ScreenHeader,
  SignalRow,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { formatDisplayDate, getActiveEntryDate, getOrCreateDailyEntry } from '@/services/daily-entries';
import { getOrCreateTodayRecommendation } from '@/services/recommendations';
import type { AnalysisSignals, SkinStory } from '@/types/database';

export default function SkinStoryScreen() {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<AnalysisSignals>({});
  const [skinStory, setSkinStory] = useState<SkinStory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [entryDate, setEntryDate] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadStory() {
        if (!user) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setErrorMessage('');

        const activeDate = await getActiveEntryDate(user.id);
        const entry = await getOrCreateDailyEntry(user.id, activeDate);

        if (!isMounted) return;

        if (entry.error || !entry.data) {
          setErrorMessage(entry.error?.message ?? "Couldn't load today's entry.");
          setIsLoading(false);
          return;
        }

        setEntryDate(activeDate);
        const recommendation = await getOrCreateTodayRecommendation(user.id, entry.data.id);

        if (!isMounted) return;

        if (recommendation.error || !recommendation.data) {
          setErrorMessage(recommendation.error?.message ?? "Couldn't generate today's story.");
          setIsLoading(false);
          return;
        }

        setAnalysis(recommendation.data.analysis);
        setSkinStory(recommendation.data.skinStory);
        setStatusMessage(
          recommendation.data.isGenerated
            ? 'Generated and saved this test day’s story.'
            : 'Loaded this test day’s saved story.'
        );
        setIsLoading(false);
      }

      loadStory();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  const metric = getPrimaryMetric(analysis);
  const contributors = skinStory?.contributors ?? [];
  const avoid = ['Retinoids', 'Strong exfoliation', 'High-heat treatments'];

  return (
    <AppShell>
      <BackLink href={'/check-in' as Href} />
      <ScreenHeader
        eyebrow={entryDate ? formatDisplayDate(entryDate) : 'Test day'}
        title={skinStory?.headline ?? "Preparing today's skin story."}
        body={skinStory?.summary ?? 'Substrate is reading your saved photo and check-in signals.'}
      />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.light.accent} />
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Loading saved signals
          </SubstrateText>
        </View>
      ) : null}

      {errorMessage ? (
        <Card style={styles.errorCard}>
          <SubstrateText variant="section">Story unavailable</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            {errorMessage}
          </SubstrateText>
        </Card>
      ) : null}

      <Card style={styles.heroCard}>
        <MetricRing value={`${metric.value}%`} label={metric.label} />
        <View style={styles.priority}>
          <SubstrateText variant="section">Today's priority</SubstrateText>
          <SubstrateText variant="body">{skinStory?.priority ?? 'Complete today’s check-in to personalize this.'}</SubstrateText>
        </View>
      </Card>

      <Card style={styles.card}>
        <SubstrateText variant="section">Potential contributors</SubstrateText>
        <View style={styles.list}>
          {contributors.length > 0 ? contributors.map((item) => (
            <SignalRow key={item.label} label={item.label} detail={item.detail} />
          )) : (
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Complete today’s check-in to identify likely contributors.
            </SubstrateText>
          )}
        </View>
      </Card>

      <Card style={styles.avoidCard}>
        <SubstrateText variant="section">What to avoid today</SubstrateText>
        <View style={styles.tags}>
          {avoid.map((item) => (
            <SubstrateText key={item} variant="tag">
              {item}
            </SubstrateText>
          ))}
        </View>
      </Card>

      <View style={styles.summary}>
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          {statusMessage || 'Prototype analysis uses saved inputs and conservative rules.'}
        </SubstrateText>
      </View>

      <Link href={'/daily-plan' as Href} asChild>
        <Pressable style={styles.next}>
          <PrimaryButton label="See Today's Plan" />
        </Pressable>
      </Link>
    </AppShell>
  );
}

function getPrimaryMetric(analysis: AnalysisSignals) {
  const entries = [
    { label: 'reactivity signal', value: analysis.redness ?? 0 },
    { label: 'dryness signal', value: analysis.dryness ?? 0 },
    { label: 'congestion signal', value: analysis.congestion ?? 0 },
    { label: 'recovery signal', value: analysis.fatigue ?? 0 },
  ];

  return entries.sort((a, b) => b.value - a.value)[0] ?? entries[0];
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  heroCard: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  priority: {
    gap: Spacing.one,
    alignItems: 'center',
  },
  card: {
    gap: Spacing.two,
  },
  avoidCard: {
    gap: Spacing.two,
    backgroundColor: Colors.light.warningSoft,
  },
  errorCard: {
    gap: Spacing.one,
    backgroundColor: Colors.light.blush,
  },
  list: {
    gap: Spacing.two,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  next: {
    marginTop: 'auto',
    paddingTop: Spacing.two,
  },
  summary: {
    paddingHorizontal: Spacing.one,
  },
});
