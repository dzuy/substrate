import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import {
  AppShell,
  BackLink,
  Card,
  PrimaryButton,
  ScreenHeader,
  SignalRow,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import {
  formatDisplayDate,
  getActiveEntryDate,
  getActiveOrNextEntryDate,
  listDailyEntries,
} from '@/services/daily-entries';
import { getAnalysisScoresForEntries } from '@/services/recommendations';
import type { AnalysisSignals, Database } from '@/types/database';

type DailyEntry = Database['public']['Tables']['daily_entries']['Row'];

export default function ProgressScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [scoresByEntryId, setScoresByEntryId] = useState<Record<string, AnalysisSignals>>({});
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

        const [nextDate, recentEntries] = await Promise.all([
          getActiveEntryDate(user.id),
          listDailyEntries(user.id),
        ]);

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

        setActiveDate(nextDate);
        setEntries(loadedEntries);
        setScoresByEntryId(scores.data ?? {});
        setIsLoading(false);
      }

      loadProgress();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  const completedEntries = entries.filter((entry) => entry.status === 'planned').length;
  const scoredEntries = entries.filter((entry) => typeof scoresByEntryId[entry.id]?.skinHealthScore === 'number');
  const averageScore =
    scoredEntries.length > 0
      ? Math.round(
          scoredEntries.reduce((total, entry) => total + (scoresByEntryId[entry.id]?.skinHealthScore ?? 0), 0) /
            scoredEntries.length
        )
      : null;

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
        eyebrow="Testing progress"
        title={`${completedEntries} completed test ${completedEntries === 1 ? 'day' : 'days'}`}
        body={activeDate ? `Next simulated check-in is ${formatDisplayDate(activeDate)}.` : 'Build progress by finishing simulated routines.'}
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

      <Card style={styles.summaryCard}>
        <View style={styles.statRow}>
          <ProgressStat label="Entries" value={String(entries.length)} />
          <ProgressStat label="Completed" value={String(completedEntries)} />
          <ProgressStat label="Avg score" value={averageScore ? String(averageScore) : '--'} />
        </View>
      </Card>

      <View style={styles.entryList}>
        {entries.length > 0 ? entries.map((entry) => (
          <Card key={entry.id} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <SubstrateText variant="section">{formatDisplayDate(entry.entry_date)}</SubstrateText>
              <SubstrateText variant="tag">{formatStatus(entry.status)}</SubstrateText>
            </View>
            <View style={styles.items}>
              <SignalRow
                label={hasCheckIn(entry) ? 'Check-in saved' : 'Check-in not saved'}
                detail={formatCheckIn(entry)}
                compact
              />
              <SignalRow
                label={entry.status === 'planned' ? 'Plan generated' : 'Plan not finished'}
                detail={entry.status === 'planned' ? 'Skin Story and Daily Plan are saved.' : 'Finish this flow to add it to progress.'}
                compact
              />
              <SignalRow
                label={hasSkinHealthScore(scoresByEntryId[entry.id]) ? 'Skin Health Score' : 'Score not generated'}
                detail={formatScore(scoresByEntryId[entry.id])}
                compact
              />
            </View>
          </Card>
        )) : (
          <Card style={styles.entryCard}>
            <SubstrateText variant="section">No simulated days yet</SubstrateText>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Start a test day, add photo/check-in data, then finish the plan.
            </SubstrateText>
          </Card>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isLoading || isStarting}
        onPress={startTestDay}
        style={[styles.next, (isLoading || isStarting) && styles.disabled]}>
        <PrimaryButton label={isStarting ? 'Preparing Test Day' : 'Start Next Test Day'} />
      </Pressable>
    </AppShell>
  );
}

function ProgressStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <SubstrateText variant="subtitle" color={Colors.light.accent}>
        {value}
      </SubstrateText>
      <SubstrateText variant="small" color={Colors.light.textMuted}>
        {label}
      </SubstrateText>
    </View>
  );
}

function hasCheckIn(entry: DailyEntry) {
  return Object.keys(entry.check_in).length > 0;
}

function formatCheckIn(entry: DailyEntry) {
  const values = [
    entry.check_in.sleepQuality ? `${entry.check_in.sleepQuality} sleep` : undefined,
    entry.check_in.stressLevel ? `${entry.check_in.stressLevel} stress` : undefined,
    entry.check_in.alcoholConsumption ? `${entry.check_in.alcoholConsumption} alcohol` : undefined,
    entry.check_in.cyclePhase && entry.check_in.cyclePhase !== 'Not tracking' ? entry.check_in.cyclePhase : undefined,
  ].filter(Boolean);

  return values.length > 0 ? values.join(' • ') : 'No responses recorded.';
}

function formatStatus(status: DailyEntry['status']) {
  if (status === 'planned') return 'Complete';
  if (status === 'analyzed') return 'Analyzed';
  if (status === 'check_in_added') return 'Check-in';
  if (status === 'photo_added') return 'Photo';
  return 'Draft';
}

function hasSkinHealthScore(signals?: AnalysisSignals): signals is AnalysisSignals & { skinHealthScore: number } {
  return typeof signals?.skinHealthScore === 'number';
}

function formatScore(signals?: AnalysisSignals) {
  if (!hasSkinHealthScore(signals)) {
    return 'Complete Skin Story to score this test day.';
  }

  const delta = typeof signals.scoreDelta === 'number' ? ` • ${formatScoreDelta(signals.scoreDelta)}` : '';

  return `${signals.skinHealthScore} • ${formatScoreBand(signals.scoreBand)}${delta}`;
}

function formatScoreBand(scoreBand: AnalysisSignals['scoreBand']) {
  if (scoreBand === 'stable') return 'Stable';
  if (scoreBand === 'balanced') return 'Balanced';
  if (scoreBand === 'stressed') return 'Stressed';
  if (scoreBand === 'reactive') return 'Reactive';
  if (scoreBand === 'high_stress') return 'High stress';
  return 'Unscored';
}

function formatScoreDelta(delta: number) {
  if (delta > 0) return `+${delta}`;
  return String(delta);
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
  summaryCard: {
    gap: Spacing.two,
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
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
  items: {
    gap: Spacing.one,
  },
  next: {
    paddingTop: Spacing.two,
  },
  disabled: {
    opacity: 0.65,
  },
});
