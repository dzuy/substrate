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
            ? 'Generated this test day’s story.'
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

  const metric = getSkinHealthMetric(analysis);
  const contributors = skinStory?.contributors ?? [];
  const avoid = buildAvoidTags(analysis);

  return (
    <AppShell>
      <BackLink href={'/environment' as Href} />
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
        <MetricRing value={String(metric.value)} label={metric.label} />
        <View style={styles.priority}>
          <SubstrateText variant="section">{formatScoreBand(analysis.scoreBand)}</SubstrateText>
          {typeof analysis.scoreDelta === 'number' ? (
            <SubstrateText variant="small" color={getDeltaColor(analysis.scoreDelta)}>
              {formatScoreDelta(analysis.scoreDelta)} from last check-in
            </SubstrateText>
          ) : (
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              First scored check-in
            </SubstrateText>
          )}
          <SubstrateText variant="body">{skinStory?.priority ?? 'Complete today’s check-in to personalize this.'}</SubstrateText>
        </View>
      </Card>

      {analysis.environment ? (
        <Card style={styles.card}>
          <View style={styles.environmentHeader}>
            <SubstrateText variant="section">Environment signals</SubstrateText>
            {analysis.environment.locationLabel ? (
              <SubstrateText variant="tag">{analysis.environment.locationLabel}</SubstrateText>
            ) : null}
          </View>
          <View style={styles.list}>
            <SignalRow label="UV index" detail={formatNumber(analysis.environment.uvIndex)} compact />
            <SignalRow label="Humidity" detail={formatPercent(analysis.environment.humidity)} compact />
            <SignalRow label="Air quality" detail={formatAqi(analysis.environment.usAqi)} compact />
          </View>
        </Card>
      ) : null}

      {analysis.photoAnalysis?.analyzedAt ? (
        <Card style={styles.card}>
          <SubstrateText variant="section">Photo signals</SubstrateText>
          <View style={styles.list}>
            <SignalRow label="Redness" detail={formatNumber(analysis.photoAnalysis.redness)} compact />
            <SignalRow label="Dryness" detail={formatNumber(analysis.photoAnalysis.dryness)} compact />
            <SignalRow label="Congestion" detail={formatNumber(analysis.photoAnalysis.congestion)} compact />
            <SignalRow label="Recovery fatigue" detail={formatNumber(analysis.photoAnalysis.fatigue)} compact />
          </View>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <SubstrateText variant="section">Top drivers</SubstrateText>
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

function getSkinHealthMetric(analysis: AnalysisSignals) {
  if (typeof analysis.skinHealthScore === 'number') {
    return { label: 'skin health score', value: analysis.skinHealthScore };
  }

  const entries = [
    { label: 'reactivity signal', value: analysis.redness ?? 0 },
    { label: 'dryness signal', value: analysis.dryness ?? 0 },
    { label: 'congestion signal', value: analysis.congestion ?? 0 },
    { label: 'recovery signal', value: analysis.fatigue ?? 0 },
  ];

  return entries.sort((a, b) => b.value - a.value)[0] ?? entries[0];
}

function formatScoreBand(scoreBand: AnalysisSignals['scoreBand']) {
  if (scoreBand === 'stable') return 'Stable and resilient';
  if (scoreBand === 'balanced') return 'Generally balanced';
  if (scoreBand === 'stressed') return 'Some stress showing';
  if (scoreBand === 'reactive') return 'Elevated reactivity';
  if (scoreBand === 'high_stress') return 'High skin stress state';
  return "Today's priority";
}

function formatScoreDelta(delta: number) {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function getDeltaColor(delta: number) {
  if (delta > 0) return '#3D7D55';
  if (delta < 0) return Colors.light.accentDeep;
  return Colors.light.textMuted;
}

function buildAvoidTags(analysis: AnalysisSignals) {
  const negativeDrivers = analysis.drivers?.filter((driver) => driver.direction === 'negative') ?? [];
  const tags = ['Strong exfoliation', 'High-heat treatments'];

  if (negativeDrivers.some((driver) => driver.label === 'Strong actives')) {
    tags.unshift('Retinoids');
  }
  if (negativeDrivers.some((driver) => driver.label.includes('alcohol'))) {
    tags.push('Dehydrating masks');
  }
  if (negativeDrivers.some((driver) => driver.label.includes('UV'))) {
    tags.push('Unprotected midday sun');
  }

  return Array.from(new Set(tags)).slice(0, 4);
}

function formatNumber(value?: number) {
  return typeof value === 'number' ? value.toFixed(1) : 'Not available';
}

function formatPercent(value?: number) {
  return typeof value === 'number' ? `${Math.round(value)}%` : 'Not available';
}

function formatAqi(value?: number) {
  if (typeof value !== 'number') {
    return 'Not available';
  }

  if (value <= 50) return `${Math.round(value)} · Good`;
  if (value <= 100) return `${Math.round(value)} · Moderate`;
  if (value <= 150) return `${Math.round(value)} · Sensitive`;
  return `${Math.round(value)} · Elevated`;
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
  environmentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
