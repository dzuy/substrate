import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { AlertTriangle, CheckCircle2, ShieldCheck, Sparkles, Target } from 'lucide-react-native';
import { type ComponentType, useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import {
  AppShell,
  BackLink,
  Card,
  PrimaryButton,
  ScreenHeader,
  StepProgress,
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
  const [isLoading, setIsLoading] = useState(true);
  const [isAdvancing, setIsAdvancing] = useState(false);
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
        setIsLoading(false);
      }

      loadPlan();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  const plan = dailyPlan?.priorities ?? [];
  const primaryPlan = plan[0];
  const secondaryPlans = plan.slice(1);

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
      <StepProgress currentStep={5} totalSteps={5} currentLabel="Today’s Plan" />
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

      {primaryPlan ? (
        <Card style={styles.focusCard}>
          <View style={styles.focusTopRow}>
            <View style={styles.focusIcon}>
              <Target color="#FFFFFF" size={20} strokeWidth={2.5} />
            </View>
            <View style={styles.focusCopy}>
              <SubstrateText variant="small" color={Colors.light.accentDeep}>
                Must focus today
              </SubstrateText>
              <SubstrateText variant="section">{primaryPlan.title}</SubstrateText>
            </View>
          </View>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {primaryPlan.detail}
          </SubstrateText>
          <View style={styles.actionStack}>
            {primaryPlan.actions.slice(0, 4).map((item, index) => (
              <ActionItem key={item} index={index + 1} label={item} />
            ))}
          </View>
        </Card>
      ) : (
          <Card style={styles.planCard}>
            <SubstrateText variant="section">No plan yet</SubstrateText>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Complete today’s photo and check-in to create your plan.
            </SubstrateText>
          </Card>
      )}

      {secondaryPlans.length ? (
        <View style={styles.planList}>
          <View style={styles.sectionHeader}>
            <SubstrateText variant="section">Also support</SubstrateText>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Smaller moves that help today’s priority
            </SubstrateText>
          </View>
          {secondaryPlans.map((section, index) => (
            <PlanCard key={section.title} plan={section} variant={index} />
          ))}
        </View>
      ) : null}

      {dailyPlan?.avoid?.length ? (
        <Card style={styles.avoidCard}>
          <View style={styles.avoidHeader}>
            <View style={styles.avoidIcon}>
              <AlertTriangle color="#B98222" size={18} strokeWidth={2.4} />
            </View>
            <SubstrateText variant="section">Avoid today</SubstrateText>
          </View>
          <View style={styles.tags}>
            {dailyPlan.avoid.map((item) => (
              <SubstrateText key={item} variant="tag">
                {item}
              </SubstrateText>
            ))}
          </View>
        </Card>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isLoading || isAdvancing}
        onPress={finishRoutine}
        style={[styles.next, (isLoading || isAdvancing) && styles.disabled]}>
        <PrimaryButton label="Done" />
      </Pressable>
    </AppShell>
  );
}

type PlanPriority = NonNullable<DailyPlan['priorities']>[number];

function PlanCard({ plan, variant }: { plan: PlanPriority; variant: number }) {
  const tone = variant % 2 === 0 ? planTones.plum : planTones.green;
  const Icon = variant % 2 === 0 ? Sparkles : ShieldCheck;

  return (
    <Card style={styles.supportCard}>
      <View style={styles.supportHeader}>
        <View style={[styles.supportIcon, { backgroundColor: tone.soft }]}>
          <Icon color={tone.color} size={18} strokeWidth={2.4} />
        </View>
        <View style={styles.supportCopy}>
          <SubstrateText variant="section">{plan.title}</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {plan.detail}
          </SubstrateText>
        </View>
      </View>
      <View style={styles.compactActions}>
        {plan.actions.slice(0, 3).map((item) => (
          <BulletItem key={item} label={item} />
        ))}
      </View>
    </Card>
  );
}

function ActionItem({ index, label }: { index: number; label: string }) {
  return (
    <View style={[styles.actionItem, styles.actionItemPrimary]}>
      <View style={[styles.actionIndex, styles.actionIndexPrimary]}>
        <SubstrateText variant="small" color="#FFFFFF">
          {index}
        </SubstrateText>
      </View>
      <SubstrateText variant="small" color={Colors.light.text}>
        {label}
      </SubstrateText>
    </View>
  );
}

function BulletItem({ label }: { label: string }) {
  return (
    <View style={styles.bulletItem}>
      <View style={styles.bulletDot} />
      <SubstrateText variant="small" color={Colors.light.text}>
        {label}
      </SubstrateText>
    </View>
  );
}

const planTones = {
  green: { color: '#3D7D55', soft: Colors.light.successSoft },
  plum: { color: Colors.light.accent, soft: Colors.light.backgroundSelected },
};

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  planList: {
    gap: Spacing.three,
  },
  planCard: {
    gap: Spacing.two,
  },
  focusCard: {
    gap: Spacing.three,
    borderColor: Colors.light.accentSoft,
    backgroundColor: '#FFFDFB',
  },
  focusTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  focusIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.light.accent,
  },
  focusCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  actionStack: {
    gap: Spacing.two,
  },
  actionItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: 16,
    padding: Spacing.two,
  },
  actionItemPrimary: {
    backgroundColor: Colors.light.backgroundSelected,
  },
  actionIndex: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  actionIndexPrimary: {
    backgroundColor: Colors.light.accent,
  },
  sectionHeader: {
    gap: Spacing.half,
  },
  supportCard: {
    gap: Spacing.two,
  },
  supportHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  supportIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  supportCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  compactActions: {
    gap: Spacing.two,
    paddingLeft: Spacing.one,
  },
  bulletItem: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    backgroundColor: Colors.light.accent,
  },
  avoidCard: {
    gap: Spacing.two,
    backgroundColor: Colors.light.warningSoft,
  },
  avoidHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  avoidIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF9EF',
  },
  errorCard: {
    gap: Spacing.one,
    backgroundColor: Colors.light.blush,
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
