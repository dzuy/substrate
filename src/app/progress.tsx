import { Link, type Href, useFocusEffect } from 'expo-router';
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
  listDailyEntries,
} from '@/services/daily-entries';
import type { Database } from '@/types/database';

type DailyEntry = Database['public']['Tables']['daily_entries']['Row'];

export default function ProgressScreen() {
  const { user } = useAuth();
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

        setActiveDate(nextDate);
        setEntries(recentEntries.data ?? []);
        setIsLoading(false);
      }

      loadProgress();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  const completedEntries = entries.filter((entry) => entry.status === 'planned').length;

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
          <ProgressStat label="In progress" value={String(entries.length - completedEntries)} />
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

      <Link href={'/photo' as Href} asChild>
        <Pressable style={styles.next}>
          <PrimaryButton label="Start Current Test Day" />
        </Pressable>
      </Link>
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
    entry.check_in.skinFeel,
    entry.check_in.stressLevel ? `${entry.check_in.stressLevel} stress` : undefined,
    entry.check_in.sleepQuality ? `${entry.check_in.sleepQuality} sleep` : undefined,
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
});
