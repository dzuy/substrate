import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
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
import { getOrCreateTodayRecommendation, saveTodayRecommendationPlan } from '@/services/recommendations';
import type { DailyPlan } from '@/types/database';

export default function DailyPlanScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [entryId, setEntryId] = useState<string | null>(null);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);
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
        setEntryId(entry.data.id);
        const recommendation = await getOrCreateTodayRecommendation(user.id, entry.data.id);

        if (!isMounted) return;

        if (recommendation.error || !recommendation.data) {
          setErrorMessage(recommendation.error?.message ?? "Couldn't load today's plan.");
          setIsLoading(false);
          return;
        }

        const planWithChecklist = ensurePlanChecklist(recommendation.data.dailyPlan);
        const shouldSaveChecklist = shouldPersistChecklist(recommendation.data.dailyPlan, planWithChecklist);
        setDailyPlan(planWithChecklist);

        if (shouldSaveChecklist) {
          const savedPlan = await saveTodayRecommendationPlan(user.id, entry.data.id, planWithChecklist);

          if (!isMounted) return;

          if (savedPlan.error) {
            setErrorMessage(savedPlan.error.message);
          }
        }

        setIsLoading(false);
      }

      loadPlan();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  const checklist = useMemo(() => ensurePlanChecklist(dailyPlan).checklist ?? [], [dailyPlan]);
  const checklistById = useMemo(
    () => new Map(checklist.map((item) => [item.id, item])),
    [checklist]
  );

  async function toggleChecklistItem(itemId: string) {
    if (!dailyPlan || !entryId || !user) {
      return;
    }

    const currentPlan = ensurePlanChecklist(dailyPlan);
    const nextPlan: DailyPlan = {
      ...currentPlan,
      checklist: currentPlan.checklist?.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      ),
    };

    setDailyPlan(nextPlan);
    setIsSavingChecklist(true);
    const { error } = await saveTodayRecommendationPlan(user.id, entryId, nextPlan);
    setIsSavingChecklist(false);

    if (error) {
      setDailyPlan(currentPlan);
      setErrorMessage(error.message);
    }
  }

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
        title="Today’s checklist"
        body="A simple saved list for today. Check items off as you complete them, and Substrate will keep the status for tomorrow’s check-in."
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

      {checklist.length ? (
        <Card style={styles.todoCard}>
          <View style={styles.todoHeader}>
            <SubstrateText variant="section">To do today</SubstrateText>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              {getCompletedCount(checklist)} of {checklist.length} done
            </SubstrateText>
          </View>
          <View style={styles.todoList}>
            {checklist.map((item) => (
              <ActionItem
                key={item.id}
                checklistItem={checklistById.get(item.id)}
                fallbackLabel={item.label}
                onToggle={toggleChecklistItem}
              />
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

      <Pressable
        accessibilityRole="button"
        disabled={isLoading || isAdvancing || isSavingChecklist}
        onPress={finishRoutine}
        style={[styles.next, (isLoading || isAdvancing || isSavingChecklist) && styles.disabled]}>
        <PrimaryButton label="Done" />
      </Pressable>
    </AppShell>
  );
}

type ChecklistItem = NonNullable<DailyPlan['checklist']>[number];

function ActionItem({
  checklistItem,
  fallbackLabel,
  onToggle,
}: {
  checklistItem?: ChecklistItem;
  fallbackLabel: string;
  onToggle: (itemId: string) => void;
}) {
  const isComplete = Boolean(checklistItem?.completed);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isComplete }}
      disabled={!checklistItem}
      onPress={() => checklistItem && onToggle(checklistItem.id)}
      style={[styles.actionItem, isComplete && styles.actionItemComplete]}>
      <View style={[styles.checkbox, isComplete && styles.checkboxComplete]}>
        {isComplete ? <CheckCircle2 color="#FFFFFF" size={18} strokeWidth={2.6} /> : null}
      </View>
      <View style={styles.actionCopy}>
        <SubstrateText
          variant="small"
          color={isComplete ? Colors.light.textMuted : Colors.light.text}
          style={isComplete && styles.completedText}>
          {checklistItem?.title ?? checklistItem?.label ?? fallbackLabel}
        </SubstrateText>
        {checklistItem?.detail ? (
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {checklistItem.detail}
          </SubstrateText>
        ) : null}
      </View>
    </Pressable>
  );
}

function ensurePlanChecklist(plan: DailyPlan | null): DailyPlan {
  if (!plan) {
    return {};
  }

  const existingChecklist = plan.checklist ?? [];
  const existingCompletion = new Map(existingChecklist.map((item) => [item.id, item.completed]));
  const existingById = new Map(existingChecklist.map((item) => [item.id, item]));
  const priorityItems =
    plan.priorities?.flatMap((section, sectionIndex) =>
      section.actions.slice(0, 3).map((action, actionIndex) => {
        const id = buildChecklistItemId(sectionIndex, actionIndex);
        const existing = existingById.get(id);

        return {
          id,
          title: existing?.title ?? action,
          detail: existing?.detail ?? section.detail,
          label: action,
          sectionTitle: section.title,
          completed: existingCompletion.get(id) ?? false,
        };
      })
    ) ?? [];
  const ingredientItems = [
    ...buildIngredientChecklistItems('favor', 'Favor', plan.ingredientsToFavor, existingById, existingCompletion),
    ...buildIngredientChecklistItems('avoid', 'Avoid', plan.ingredientsToAvoid ?? plan.avoid, existingById, existingCompletion),
  ];
  const checklist = [...priorityItems, ...ingredientItems];

  return {
    ...plan,
    checklist,
  };
}

function buildChecklistItemId(sectionIndex: number, actionIndex: number) {
  return `priority-${sectionIndex}-action-${actionIndex}`;
}

function buildIngredientChecklistItems(
  type: 'favor' | 'avoid',
  verb: string,
  ingredients: string[] | undefined,
  existingById: Map<string, ChecklistItem>,
  existingCompletion: Map<string, boolean>
) {
  return (
    ingredients?.slice(0, 4).map((ingredient, index) => {
      const id = `ingredient-${type}-${index}`;
      const existing = existingById.get(id);

      return {
        id,
        title: existing?.title ?? `${verb} ${ingredient}`,
        detail:
          existing?.detail ??
          (type === 'favor'
            ? 'Use this as a helpful ingredient direction for today if it is already in your routine.'
            : 'Keep this lower priority today unless it is already prescribed or essential.'),
        label: `${verb} ${ingredient}`,
        sectionTitle: type === 'favor' ? 'Ingredients to favor' : 'Consider avoiding today',
        completed: existingCompletion.get(id) ?? false,
      };
    }) ?? []
  );
}

function getCompletedCount(checklist: ChecklistItem[]) {
  return checklist.filter((item) => item.completed).length;
}

function shouldPersistChecklist(originalPlan: DailyPlan, nextPlan: DailyPlan) {
  const originalChecklist = originalPlan.checklist ?? [];
  const nextChecklist = nextPlan.checklist ?? [];

  if (originalChecklist.length !== nextChecklist.length) {
    return true;
  }

  const originalById = new Map(originalChecklist.map((item) => [item.id, item]));

  return nextChecklist.some((item) => {
    const original = originalById.get(item.id);
    return !original || original.title !== item.title || original.detail !== item.detail || original.label !== item.label;
  });
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  planCard: {
    gap: Spacing.two,
  },
  todoCard: {
    gap: Spacing.three,
    borderColor: Colors.light.accentSoft,
    backgroundColor: '#FFFDFB',
  },
  todoHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  todoList: {
    gap: Spacing.two,
  },
  actionItem: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundSelected,
    minHeight: 44,
    padding: Spacing.two,
  },
  actionItemComplete: {
    backgroundColor: Colors.light.successSoft,
  },
  checkbox: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.accent,
    backgroundColor: '#FFFFFF',
  },
  checkboxComplete: {
    backgroundColor: Colors.light.accent,
  },
  completedText: {
    textDecorationLine: 'line-through',
  },
  actionCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  errorCard: {
    gap: Spacing.one,
    backgroundColor: Colors.light.blush,
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
