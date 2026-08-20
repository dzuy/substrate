import { Link, type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';

import {
  AppShell,
  BackLink,
  Card,
  PrimaryButton,
  ScreenHeader,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import {
  formatDisplayDate,
  getActiveOrNextEntryDate,
  listDailyEntries,
} from '@/services/daily-entries';
import { generateProgressSummary, type ProgressSummaryEntry } from '@/services/progress-summary';
import { getAnalysisScoresForEntries } from '@/services/recommendations';
import type { AnalysisSignals, Database } from '@/types/database';

type DailyEntry = Database['public']['Tables']['daily_entries']['Row'];

export default function ProgressScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [scoresByEntryId, setScoresByEntryId] = useState<Record<string, AnalysisSignals>>({});
  const [progressSummary, setProgressSummary] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadProgress() {
        if (!user) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setErrorMessage('');

        const recentEntries = await listDailyEntries(user.id);

        if (!isMounted) {
          return;
        }

        if (recentEntries.error) {
          setErrorMessage(recentEntries.error.message);
          setIsLoading(false);
          return;
        }

        const loadedEntries = recentEntries.data ?? [];
        const scores = await getAnalysisScoresForEntries(
          user.id,
          loadedEntries.map((entry) => entry.id)
        );

        if (!isMounted) {
          return;
        }

        if (scores.error) {
          setErrorMessage(scores.error.message);
          setIsLoading(false);
          return;
        }

        const summaryEntries = buildSummaryEntries(loadedEntries, scores.data ?? {});
        const summary = await generateProgressSummary(summaryEntries.slice(-30));

        if (!isMounted) {
          return;
        }

        setEntries(loadedEntries);
        setScoresByEntryId(scores.data ?? {});
        setProgressSummary(summary.data ?? '');
        setIsLoading(false);
      }

      loadProgress();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  const completedEntries = entries.filter((entry) => entry.status === 'planned').length;
  const scoredTrend = buildScoredTrend(entries, scoresByEntryId).slice(-30);
  const latestScore = scoredTrend.at(-1)?.score;
  const recentEntries = entries.slice(0, 3);

  async function startTestDay() {
    if (!user) {
      return;
    }

    setIsStarting(true);
    const active = await getActiveOrNextEntryDate(user.id);
    setIsStarting(false);

    if (active.error) {
      setErrorMessage(active.error.message);
      return;
    }

    router.push('/photo');
  }

  return (
    <AppShell>
      <BackLink href="/" />
      <ScreenHeader
        eyebrow="Progress"
        title={latestScore ? `Skin Score ${latestScore}` : 'Track your skin trend'}
      />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.light.accent} />
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Loading progress
          </SubstrateText>
        </View>
      ) : null}

      {errorMessage ? (
        <Card style={styles.errorCard}>
          <SubstrateText variant="section">Progress unavailable</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            {errorMessage}
          </SubstrateText>
        </Card>
      ) : null}

      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View>
            <SubstrateText variant="section">Last 30 scores</SubstrateText>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Completed test days
            </SubstrateText>
          </View>
          <SubstrateText variant="subtitle" color={Colors.light.accent}>
            {latestScore ?? '--'}
          </SubstrateText>
        </View>
        <ScoreChart points={scoredTrend} />
      </Card>

      <Card style={styles.summaryCard}>
        <SubstrateText variant="section">Progress Analysis</SubstrateText>
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          {progressSummary || 'Complete a few scored check-ins to generate a useful progress summary.'}
        </SubstrateText>
      </Card>

      <View style={styles.sectionHeader}>
        <SubstrateText variant="section">Recent days</SubstrateText>
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          {completedEntries} completed
        </SubstrateText>
      </View>

      <View style={styles.entryList}>
        {recentEntries.length > 0 ? recentEntries.map((entry) => (
          <ProgressEntryCard key={entry.id} entry={entry} signals={scoresByEntryId[entry.id]} />
        )) : (
          <Card style={styles.entryCard}>
            <SubstrateText variant="section">No simulated days yet</SubstrateText>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Start a test day, add photo/check-in data, then finish the plan.
            </SubstrateText>
          </Card>
        )}
      </View>

      {entries.length > 0 ? (
        <Link href={'/progress-history' as Href} asChild>
          <Pressable accessibilityRole="button" style={styles.textLink}>
            <SubstrateText variant="small" color={Colors.light.accentDeep}>
              See Full History
            </SubstrateText>
          </Pressable>
        </Link>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isLoading || isStarting}
        onPress={startTestDay}
        style={[styles.next, (isLoading || isStarting) && styles.disabled]}>
        <PrimaryButton label={isStarting ? 'Preparing Check-in' : 'Start New Check-in'} />
      </Pressable>
    </AppShell>
  );
}

function ScoreChart({ points }: { points: Array<{ date: string; score: number }> }) {
  const paddedPoints = points.length > 0 ? points : [];

  if (paddedPoints.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          Scores will appear here after Skin Story is generated.
        </SubstrateText>
      </View>
    );
  }

  const chartWidth = 320;
  const chartHeight = 156;
  const paddingX = 18;
  const paddingY = 18;
  const usableWidth = chartWidth - paddingX * 2;
  const usableHeight = chartHeight - paddingY * 2;
  const coordinates = paddedPoints.map((point, index) => {
    const x = paddedPoints.length === 1 ? chartWidth / 2 : paddingX + (index / (paddedPoints.length - 1)) * usableWidth;
    const y = paddingY + (1 - point.score / 100) * usableHeight;
    return { ...point, x, y };
  });
  const linePath = buildLinePath(coordinates);
  const areaPath = `${linePath} L ${coordinates.at(-1)?.x ?? paddingX} ${chartHeight - paddingY} L ${coordinates[0].x} ${chartHeight - paddingY} Z`;

  return (
    <View style={styles.lineChartWrap}>
      <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        <Defs>
          <LinearGradient id="scoreFill" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={Colors.light.accent} stopOpacity="0.22" />
            <Stop offset="1" stopColor={Colors.light.accent} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
        {[25, 50, 75].map((value) => {
          const y = paddingY + (1 - value / 100) * usableHeight;
          return (
            <Line
              key={value}
              x1={paddingX}
              x2={chartWidth - paddingX}
              y1={y}
              y2={y}
              stroke={Colors.light.border}
              strokeDasharray="4 8"
              strokeWidth={1}
            />
          );
        })}
        <Path d={areaPath} fill="url(#scoreFill)" />
        <Path d={linePath} fill="none" stroke={Colors.light.accent} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} />
        {coordinates.map((point) => (
          <Circle key={point.date} cx={point.x} cy={point.y} r={3.75} fill={Colors.light.backgroundElement} stroke={Colors.light.accent} strokeWidth={2} />
        ))}
      </Svg>
      <View style={styles.chartLabels}>
        {paddedPoints.map((point, index) => (
          <SubstrateText key={point.date} variant="small" color={Colors.light.textMuted}>
            {shouldShowChartLabel(index, paddedPoints.length) ? formatChartLabel(point.date) : ''}
          </SubstrateText>
        ))}
      </View>
    </View>
  );
}

function ProgressEntryCard({ entry, signals }: { entry: DailyEntry; signals?: AnalysisSignals }) {
  const chips = buildEntryChips(entry, signals);

  return (
    <Card style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <View style={styles.entryCopy}>
          <SubstrateText variant="section">{formatDisplayDate(entry.entry_date)}</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {formatStatus(entry.status)}
          </SubstrateText>
        </View>
      </View>
      <View style={styles.chipRow}>
        {chips.map((chip) => (
          <StatusChip key={chip.label} {...chip} />
        ))}
      </View>
    </Card>
  );
}

type ChipTone = { color: string; soft: string };

function StatusChip({ label, tone }: { label: string; tone: ChipTone }) {
  return (
    <View style={[styles.statusChip, { backgroundColor: tone.soft, borderColor: tone.color }]}>
      <SubstrateText variant="small" color={tone.color}>
        {label}
      </SubstrateText>
    </View>
  );
}

function buildEntryChips(entry: DailyEntry, signals?: AnalysisSignals) {
  const score = hasSkinHealthScore(signals) ? signals.skinHealthScore : undefined;

  return [
    {
      label: 'Sleep',
      tone: getSleepTone(entry.check_in.sleepQuality),
    },
    {
      label: 'Stress',
      tone: getStressTone(entry.check_in.stressLevel),
    },
    {
      label: typeof score === 'number' ? `Score ${score}` : 'Score',
      tone: getScoreTone(score),
    },
  ];
}

function buildSummaryEntries(entries: DailyEntry[], scoresByEntryId: Record<string, AnalysisSignals>): ProgressSummaryEntry[] {
  return entries
    .slice()
    .reverse()
    .map((entry) => ({
      entryDate: entry.entry_date,
      score: scoresByEntryId[entry.id]?.skinHealthScore,
      scoreBand: scoresByEntryId[entry.id]?.scoreBand,
      scoreDelta: scoresByEntryId[entry.id]?.scoreDelta,
    }));
}

function buildScoredTrend(entries: DailyEntry[], scoresByEntryId: Record<string, AnalysisSignals>) {
  return buildSummaryEntries(entries, scoresByEntryId)
    .filter((entry): entry is ProgressSummaryEntry & { score: number } => typeof entry.score === 'number')
    .map((entry) => ({ date: entry.entryDate, score: entry.score }));
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x - 18} ${point.y} L ${point.x + 18} ${point.y}`;
  }

  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function formatStatus(status: DailyEntry['status']) {
  if (status === 'planned') return 'Complete';
  if (status === 'analyzed') return 'Analyzed';
  if (status === 'check_in_added') return 'Check-in saved';
  if (status === 'photo_added') return 'Photo saved';
  return 'Draft';
}

function hasSkinHealthScore(signals?: AnalysisSignals): signals is AnalysisSignals & { skinHealthScore: number } {
  return typeof signals?.skinHealthScore === 'number';
}

function formatScoreBand(scoreBand: AnalysisSignals['scoreBand']) {
  if (scoreBand === 'stable') return 'Stable';
  if (scoreBand === 'balanced') return 'Balanced';
  if (scoreBand === 'stressed') return 'Stressed';
  if (scoreBand === 'reactive') return 'Reactive';
  if (scoreBand === 'high_stress') return 'High stress';
  return 'Unscored';
}

function getSleepTone(value: DailyEntry['check_in']['sleepQuality']): ChipTone {
  if (value === 'Rested') return chipTones.good;
  if (value === 'Okay') return chipTones.neutral;
  if (value === 'Poor') return chipTones.pressure;
  return chipTones.missing;
}

function getStressTone(value: DailyEntry['check_in']['stressLevel']): ChipTone {
  if (value === 'Low') return chipTones.good;
  if (value === 'Medium') return chipTones.neutral;
  if (value === 'High') return chipTones.pressure;
  return chipTones.missing;
}

function getScoreTone(value?: number): ChipTone {
  if (typeof value !== 'number') return chipTones.missing;
  if (value >= 75) return chipTones.good;
  if (value >= 60) return chipTones.neutral;
  return chipTones.pressure;
}

const chipTones = {
  good: { color: '#3D7D55', soft: Colors.light.successSoft },
  neutral: { color: '#B98222', soft: '#FFF2D8' },
  pressure: { color: Colors.light.accentDeep, soft: Colors.light.blush },
  missing: { color: Colors.light.textMuted, soft: '#F4ECEC' },
} satisfies Record<string, ChipTone>;

function formatChartLabel(date: string) {
  const [, month, day] = date.split('-').map(Number);
  return `${month}/${day}`;
}

function shouldShowChartLabel(index: number, total: number) {
  if (total <= 7) return true;
  if (index === 0 || index === total - 1) return true;
  return index % Math.ceil(total / 4) === 0;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  errorCard: {
    gap: Spacing.one,
    backgroundColor: Colors.light.blush,
  },
  chartCard: {
    gap: Spacing.three,
  },
  chartHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  lineChartWrap: {
    minHeight: 188,
    borderRadius: 18,
    backgroundColor: '#FBF8F6',
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.one,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  emptyChart: {
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSelected,
    padding: Spacing.three,
  },
  summaryCard: {
    gap: Spacing.two,
    backgroundColor: Colors.light.plumSoft,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  entryList: {
    gap: Spacing.two,
  },
  entryCard: {
    gap: Spacing.two,
  },
  entryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  entryCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  statusChip: {
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  textLink: {
    alignSelf: 'center',
    minHeight: 36,
    justifyContent: 'center',
  },
  next: {
    paddingTop: Spacing.two,
  },
  disabled: {
    opacity: 0.65,
  },
});
