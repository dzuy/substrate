import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

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

        const recentEntries = await listDailyEntries(user.id, 100);

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
        title="Previous days"
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
        <SubstrateText variant="section">Progress Analysis</SubstrateText>
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          {progressSummary || 'Complete a few check-ins to generate a useful progress summary.'}
        </SubstrateText>
      </Card>

      <View style={styles.sectionHeader}>
        <SubstrateText variant="section">Previous days</SubstrateText>
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          {completedEntries} completed
        </SubstrateText>
      </View>

      <View style={styles.entryList}>
        {entries.length > 0 ? entries.map((entry) => (
          <ProgressEntryCard key={entry.id} entry={entry} />
        )) : (
          <Card style={styles.entryCard}>
            <SubstrateText variant="section">No previous days yet</SubstrateText>
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
        <PrimaryButton label={isStarting ? 'Preparing Check-in' : 'Start New Check-in'} />
      </Pressable>
    </AppShell>
  );
}

function ProgressEntryCard({ entry }: { entry: DailyEntry }) {
  const chips = buildEntryChips(entry);

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

function buildEntryChips(entry: DailyEntry) {
  return [
    {
      label: 'Sleep',
      tone: getSleepTone(entry.check_in.sleepQuality),
    },
    {
      label: 'Stress',
      tone: getStressTone(entry.check_in.stressLevel),
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

function formatStatus(status: DailyEntry['status']) {
  if (status === 'planned') return 'Complete';
  if (status === 'analyzed') return 'Analyzed';
  if (status === 'check_in_added') return 'Check-in saved';
  if (status === 'photo_added') return 'Photo saved';
  return 'Draft';
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

const chipTones = {
  good: { color: '#3D7D55', soft: Colors.light.successSoft },
  neutral: { color: '#B98222', soft: '#FFF2D8' },
  pressure: { color: Colors.light.accentDeep, soft: Colors.light.blush },
  missing: { color: Colors.light.textMuted, soft: '#F4ECEC' },
} satisfies Record<string, ChipTone>;

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
  next: {
    paddingTop: Spacing.two,
  },
  disabled: {
    opacity: 0.65,
  },
});
