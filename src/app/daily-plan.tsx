import { type Href, useFocusEffect, useRouter } from 'expo-router';
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
  advanceActiveEntryDate,
  formatDisplayDate,
  getActiveEntryDate,
  getOrCreateDailyEntry,
} from '@/services/daily-entries';
import { getOrCreateTodayRecommendation } from '@/services/recommendations';
import type { DailyPlan } from '@/types/database';

export default function DailyPlanScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [safetyNotes, setSafetyNotes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [entryDate, setEntryDate] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadPlan() {
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
          setErrorMessage(recommendation.error?.message ?? "Couldn't load today's plan.");
          setIsLoading(false);
          return;
        }

        setDailyPlan(recommendation.data.dailyPlan);
        setSafetyNotes(recommendation.data.safetyNotes);
        setStatusMessage(recommendation.data.isGenerated ? 'Generated and saved this test day’s plan.' : 'Loaded this test day’s saved plan.');
        setIsLoading(false);
      }

      loadPlan();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  const plan = dailyPlan?.priorities ?? [];

  async function finishRoutine() {
    if (!user) {
      return;
    }

    setIsAdvancing(true);
    await advanceActiveEntryDate(user.id);
    setIsAdvancing(false);
    router.push('/');
  }

  return (
    <AppShell>
      <BackLink href={'/skin-story' as Href} />
      <ScreenHeader
        eyebrow="Daily plan"
        title="A focused routine for this skin state."
        body="Recommendations are prioritized by what is most likely to help today, not by product category."
      />

      {entryDate ? (
        <View style={styles.summary}>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Test day {formatDisplayDate(entryDate)}
          </SubstrateText>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.light.accent} />
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Loading saved plan
          </SubstrateText>
        </View>
      ) : null}

      {errorMessage ? (
        <Card style={styles.errorCard}>
          <SubstrateText variant="section">Plan unavailable</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            {errorMessage}
          </SubstrateText>
        </Card>
      ) : null}

      <View style={styles.planList}>
        {plan.length > 0 ? plan.map((section) => (
          <Card key={section.title} style={styles.planCard}>
            <SubstrateText variant="section">{section.title}</SubstrateText>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              {section.detail}
            </SubstrateText>
            <View style={styles.items}>
              {section.actions.map((item) => (
                <SignalRow key={item} label={item} compact />
              ))}
            </View>
          </Card>
        )) : (
          <Card style={styles.planCard}>
            <SubstrateText variant="section">No plan yet</SubstrateText>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Complete today’s photo and check-in to create your plan.
            </SubstrateText>
          </Card>
        )}
      </View>

      {dailyPlan?.avoid?.length ? (
        <Card style={styles.avoidCard}>
          <SubstrateText variant="section">Avoid today</SubstrateText>
          <View style={styles.tags}>
            {dailyPlan.avoid.map((item) => (
              <SubstrateText key={item} variant="tag">
                {item}
              </SubstrateText>
            ))}
          </View>
        </Card>
      ) : null}

      {safetyNotes.length ? (
        <View style={styles.summary}>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {safetyNotes[0]}
          </SubstrateText>
        </View>
      ) : null}

      <View style={styles.summary}>
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          {statusMessage || 'Prototype recommendations use saved inputs and conservative rules.'}
        </SubstrateText>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isLoading || isAdvancing}
        onPress={finishRoutine}
        style={[styles.next, (isLoading || isAdvancing) && styles.disabled]}>
        <PrimaryButton label={isAdvancing ? 'Preparing Next Test Day' : 'Finish & Start Next Test Day'} />
      </Pressable>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  planList: {
    gap: Spacing.two,
  },
  planCard: {
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
  items: {
    gap: Spacing.one,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  summary: {
    paddingHorizontal: Spacing.one,
  },
  next: {
    paddingTop: Spacing.two,
  },
  disabled: {
    opacity: 0.65,
  },
});
