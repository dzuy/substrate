import { type Href, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  AppShell,
  BackLink,
  Card,
  ScreenHeader,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { formatDisplayDate, listDailyEntries } from '@/services/daily-entries';
import { getAnalysisScoresForEntries } from '@/services/recommendations';
import type { AnalysisSignals, Database } from '@/types/database';

type DailyEntry = Database['public']['Tables']['daily_entries']['Row'];

export default function ProgressHistoryScreen() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [scoresByEntryId, setScoresByEntryId] = useState<Record<string, AnalysisSignals>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadHistory() {
        if (!user) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setErrorMessage('');

        const history = await listDailyEntries(user.id, 100);

        if (!isMounted) {
          return;
        }

        if (history.error) {
          setErrorMessage(history.error.message);
          setIsLoading(false);
          return;
        }

        const loadedEntries = history.data ?? [];
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

        setEntries(loadedEntries);
        setScoresByEntryId(scores.data ?? {});
        setIsLoading(false);
      }

      loadHistory();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  return (
    <AppShell>
      <BackLink href={'/progress' as Href} />
      <ScreenHeader
        eyebrow="Progress"
        title="Full history"
        body="All saved simulated test days and Skin Scores."
      />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.light.accent} />
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Loading history
          </SubstrateText>
        </View>
      ) : null}

      {errorMessage ? (
        <Card style={styles.errorCard}>
          <SubstrateText variant="section">History unavailable</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            {errorMessage}
          </SubstrateText>
        </Card>
      ) : null}

      <View style={styles.entryList}>
        {entries.length > 0 ? entries.map((entry) => (
          <HistoryEntry key={entry.id} entry={entry} signals={scoresByEntryId[entry.id]} />
        )) : (
          <Card style={styles.entryCard}>
            <SubstrateText variant="section">No history yet</SubstrateText>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Completed test days will appear here.
            </SubstrateText>
          </Card>
        )}
      </View>
    </AppShell>
  );
}

function HistoryEntry({ entry, signals }: { entry: DailyEntry; signals?: AnalysisSignals }) {
  return (
    <Card style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <View style={styles.entryCopy}>
          <SubstrateText variant="section">{formatDisplayDate(entry.entry_date)}</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {formatStatus(entry.status)}
          </SubstrateText>
        </View>
        <View style={styles.scoreBadge}>
          <SubstrateText variant="section" color={Colors.light.accent}>
            {typeof signals?.skinHealthScore === 'number' ? signals.skinHealthScore : '--'}
          </SubstrateText>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {formatScoreBand(signals?.scoreBand)}
          </SubstrateText>
        </View>
      </View>
    </Card>
  );
}

function formatStatus(status: DailyEntry['status']) {
  if (status === 'planned') return 'Complete';
  if (status === 'analyzed') return 'Analyzed';
  if (status === 'check_in_added') return 'Check-in saved';
  if (status === 'photo_added') return 'Photo saved';
  return 'Draft';
}

function formatScoreBand(scoreBand: AnalysisSignals['scoreBand']) {
  if (scoreBand === 'stable') return 'Stable';
  if (scoreBand === 'balanced') return 'Balanced';
  if (scoreBand === 'stressed') return 'Stressed';
  if (scoreBand === 'reactive') return 'Reactive';
  if (scoreBand === 'high_stress') return 'High stress';
  return 'Unscored';
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
  scoreBadge: {
    minWidth: 76,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSelected,
    padding: Spacing.two,
  },
});
