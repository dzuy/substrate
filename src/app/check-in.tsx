import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  AppShell,
  BackLink,
  Card,
  Pill,
  PrimaryButton,
  ScreenHeader,
  StepProgress,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import {
  getActiveEntryDate,
  getOrCreateDailyEntry,
  getPreviousDailyEntry,
  saveDailyCheckIn,
} from '@/services/daily-entries';
import { getLatestRecommendation, saveTodayRecommendationPlan } from '@/services/recommendations';
import type { CheckInResponses, DailyPlan } from '@/types/database';

const sleep = ['Poor', 'Okay', 'Rested'];
const stress = ['Low', 'Medium', 'High'];
const cycle = [
  { value: 'Menstrual', label: 'Menstrual (Days 1-5)' },
  { value: 'Follicular', label: 'Follicular (Days 6-13)' },
  { value: 'Ovulatory', label: 'Ovulatory (Days 14-15)' },
  { value: 'Luteal', label: 'Luteal (Days 16-28)' },
  { value: 'Not tracking', label: 'Not tracking' },
] satisfies { value: NonNullable<CheckInResponses['cyclePhase']>; label: string }[];
const movement = ['Yoga', 'Pilates', 'Indoors', 'Outdoors'] as const;
const skinFeel = ['Dry', 'Itchy', 'Oily', 'Normal'] as const;

type MovementPlan = NonNullable<CheckInResponses['movementPlan']>[number];
type ChecklistItem = NonNullable<DailyPlan['checklist']>[number];
type PlanItem = NonNullable<DailyPlan['items']>[number];

export default function CheckInScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [entryId, setEntryId] = useState<string | null>(null);
  const [sleepQuality, setSleepQuality] = useState<NonNullable<CheckInResponses['sleepQuality']>>('Poor');
  const [stressLevel, setStressLevel] = useState<NonNullable<CheckInResponses['stressLevel']>>('Medium');
  const [cyclePhase, setCyclePhase] = useState<NonNullable<CheckInResponses['cyclePhase']>>('Luteal');
  const [movementPlan, setMovementPlan] = useState<MovementPlan[]>([]);
  const [movementPlanNote, setMovementPlanNote] = useState('');
  const [skinFeelToday, setSkinFeelToday] = useState<NonNullable<CheckInResponses['skinFeelToday']>>('Normal');
  const [yesterdayNote, setYesterdayNote] = useState('');
  const [yesterdayEntryId, setYesterdayEntryId] = useState<string | null>(null);
  const [yesterdayPlan, setYesterdayPlan] = useState<DailyPlan | null>(null);
  const [yesterdayChecklist, setYesterdayChecklist] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingYesterdayChecklist, setIsSavingYesterdayChecklist] = useState(false);
  const [saveError, setSaveError] = useState('');
  const yesterdayChecklistGroups = useMemo(() => groupChecklistByMoment(yesterdayChecklist), [yesterdayChecklist]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadDailyEntry() {
        if (!user) {
          setIsLoading(false);
          return;
        }

        const activeDate = await getActiveEntryDate(user.id);
        const { data, error } = await getOrCreateDailyEntry(user.id, activeDate);
        const previousEntry = await getPreviousDailyEntry(user.id, activeDate);
        const previousRecommendation =
          previousEntry.data && !previousEntry.error
            ? await getLatestRecommendation(user.id, previousEntry.data.id)
            : { data: null, error: null };

        if (!isMounted) {
          return;
        }

        if (error) {
          setSaveError(error.message);
          setIsLoading(false);
          return;
        }

        if (!data) {
          setSaveError("Couldn't load today's entry.");
          setIsLoading(false);
          return;
        }

        setEntryId(data.id);
        hydrateCheckIn(data.check_in);
        setYesterdayEntryId(previousEntry.data?.id ?? null);
        setYesterdayPlan(previousRecommendation.data?.dailyPlan ?? null);
        setYesterdayChecklist(buildChecklistFromPlan(previousRecommendation.data?.dailyPlan));
        setIsLoading(false);
      }

      loadDailyEntry();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  function hydrateCheckIn(checkIn: CheckInResponses) {
    if (checkIn.sleepQuality) {
      setSleepQuality(checkIn.sleepQuality);
    }
    if (checkIn.stressLevel) {
      setStressLevel(checkIn.stressLevel);
    }
    if (checkIn.cyclePhase) {
      setCyclePhase(checkIn.cyclePhase);
    }
    if (checkIn.movementPlan) {
      setMovementPlan(checkIn.movementPlan);
    } else if (checkIn.activityLevel) {
      setMovementPlan([checkIn.activityLevel === 'Light' ? 'Indoors' : 'Outdoors']);
    }
    setMovementPlanNote(checkIn.movementPlanNote ?? '');
    if (checkIn.skinFeelToday) {
      setSkinFeelToday(checkIn.skinFeelToday);
    } else if (checkIn.skinFeel === 'Dry') {
      setSkinFeelToday('Dry');
    } else if (checkIn.skinFeel === 'Congested') {
      setSkinFeelToday('Oily');
    } else if (checkIn.skinFeel === 'Calm') {
      setSkinFeelToday('Normal');
    }
    setYesterdayNote(checkIn.yesterdayNote ?? '');
  }

  function toggleMovementPlan(item: MovementPlan) {
    setMovementPlan((current) =>
      current.includes(item) ? current.filter((selected) => selected !== item) : [...current, item]
    );
  }

  async function toggleYesterdayChecklistItem(itemId: string) {
    if (!user || !yesterdayEntryId || !yesterdayPlan) {
      return;
    }

    const currentChecklist = buildChecklistFromPlan(yesterdayPlan);
    const nextChecklist = currentChecklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    const completionById = new Map(nextChecklist.map((item) => [item.id, item.completed]));
    const nextPlan: DailyPlan = {
      ...yesterdayPlan,
      items: yesterdayPlan.items?.map((item) => ({
        ...item,
        completed: completionById.get(item.id) ?? item.completed,
      })),
      checklist: nextChecklist,
    };

    setYesterdayPlan(nextPlan);
    setYesterdayChecklist(nextChecklist);
    setIsSavingYesterdayChecklist(true);
    const { error } = await saveTodayRecommendationPlan(user.id, yesterdayEntryId, nextPlan);
    setIsSavingYesterdayChecklist(false);

    if (error) {
      setYesterdayPlan(yesterdayPlan);
      setYesterdayChecklist(currentChecklist);
      setSaveError(error.message);
    }
  }

  async function handleSaveAndContinue() {
    if (!entryId) {
      setSaveError('Daily entry is not ready yet. Try again in a moment.');
      return;
    }

    setIsSaving(true);
    setSaveError('');

    const { error } = await saveDailyCheckIn(entryId, {
      sleepQuality,
      stressLevel,
      cyclePhase,
      movementPlan,
      movementPlanNote: movementPlanNote.trim(),
      skinFeelToday,
      yesterdayNote: yesterdayNote.trim(),
    });

    setIsSaving(false);

    if (error) {
      setSaveError(error.message);
      return;
    }

    router.push('/environment');
  }

  return (
    <AppShell>
      <BackLink href={'/photo' as Href} />
      <StepProgress currentStep={2} totalSteps={5} currentLabel="Check-in" nextLabel="Environment" />
      <ScreenHeader
        title="Daily check-in"
      />

      <Card style={styles.card}>
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.light.accent} />
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              {"Loading today's entry"}
            </SubstrateText>
          </View>
        ) : null}

        <Question title="How did you sleep?">
          {sleep.map((item) => (
            <Pill
              key={item}
              label={item}
              selected={sleepQuality === item}
              onPress={() => setSleepQuality(item as NonNullable<CheckInResponses['sleepQuality']>)}
            />
          ))}
        </Question>

        <Question title="How stressed do you feel?">
          {stress.map((item) => (
            <Pill
              key={item}
              label={item}
              selected={stressLevel === item}
              onPress={() => setStressLevel(item as NonNullable<CheckInResponses['stressLevel']>)}
            />
          ))}
        </Question>

        <Question title="Where are you in your cycle?">
          {cycle.map((item) => (
            <Pill
              key={item.value}
              label={item.label}
              selected={cyclePhase === item.value}
              onPress={() => setCyclePhase(item.value)}
            />
          ))}
        </Question>

        <Question title="Movement plan for today?">
          {movement.map((item) => (
            <Pill
              key={item}
              label={item}
              selected={movementPlan.includes(item)}
              onPress={() => toggleMovementPlan(item)}
            />
          ))}
          <TextInput
            autoCapitalize="sentences"
            autoCorrect
            onChangeText={setMovementPlanNote}
            placeholder="Add your own movement plan"
            placeholderTextColor={Colors.light.textMuted}
            returnKeyType="done"
            style={styles.input}
            value={movementPlanNote}
          />
        </Question>

        <Question title="How does your skin feel today?">
          {skinFeel.map((item) => (
            <Pill
              key={item}
              label={item}
              selected={skinFeelToday === item}
              onPress={() => setSkinFeelToday(item)}
            />
          ))}
        </Question>

        <Question title="How did yesterday go?">
          <View style={styles.yesterdayChecklistBox}>
            {yesterdayChecklist.length ? (
              <>
                <View style={styles.todoHeader}>
                  <SubstrateText variant="section">Yesterday’s plan</SubstrateText>
                  <SubstrateText variant="small" color={Colors.light.textMuted}>
                    {getCompletedCount(yesterdayChecklist)} of {yesterdayChecklist.length} done
                  </SubstrateText>
                </View>
                {yesterdayPlan?.context ? (
                  <SubstrateText variant="small" color={Colors.light.textMuted}>
                    {yesterdayPlan.context}
                  </SubstrateText>
                ) : null}
                <View style={styles.todoList}>
                  {yesterdayChecklistGroups.map((group) => (
                    <View key={group.moment} style={styles.momentGroup}>
                      <SubstrateText variant="small" color={Colors.light.accentDeep}>
                        {group.label}
                      </SubstrateText>
                      <View style={styles.momentItems}>
                        {group.items.map((item) => (
                          <YesterdayChecklistItem
                            key={item.id}
                            disabled={isSavingYesterdayChecklist}
                            item={item}
                            onToggle={toggleYesterdayChecklistItem}
                          />
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <SubstrateText variant="small" color={Colors.light.textMuted}>
                Yesterday’s saved plan will appear here once there is a completed plan from the prior day.
              </SubstrateText>
            )}
          </View>
        </Question>

        <Question title="Did anything happen yesterday?">
          <TextInput
            autoCapitalize="sentences"
            autoCorrect
            multiline
            onChangeText={setYesterdayNote}
            placeholder="Optional note"
            placeholderTextColor={Colors.light.textMuted}
            style={[styles.input, styles.textArea]}
            value={yesterdayNote}
          />
        </Question>
      </Card>

      {saveError ? (
        <View style={styles.summary}>
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            {saveError}
          </SubstrateText>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isLoading || isSaving || isSavingYesterdayChecklist}
        onPress={handleSaveAndContinue}
        style={[styles.next, (isLoading || isSaving || isSavingYesterdayChecklist) && styles.disabled]}>
        <PrimaryButton label={isSaving ? 'Saving Check-In' : 'Next'} />
      </Pressable>
    </AppShell>
  );
}

function YesterdayChecklistItem({
  disabled,
  item,
  onToggle,
}: {
  disabled: boolean;
  item: ChecklistItem;
  onToggle: (itemId: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.completed, disabled }}
      disabled={disabled}
      onPress={() => onToggle(item.id)}
      style={[styles.actionItem, item.completed && styles.actionItemComplete]}>
      <View style={[styles.checkbox, item.completed && styles.checkboxComplete]}>
        {item.completed ? <CheckCircle2 color="#FFFFFF" size={18} strokeWidth={2.6} /> : null}
      </View>
      <View style={styles.actionCopy}>
        <SubstrateText
          variant="small"
          color={item.completed ? Colors.light.textMuted : Colors.light.text}
          style={item.completed && styles.completedText}>
          {item.title ?? item.label}
        </SubstrateText>
        {item.detail ? (
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {item.detail}
          </SubstrateText>
        ) : null}
      </View>
    </Pressable>
  );
}

function buildChecklistFromPlan(plan: DailyPlan | null | undefined): ChecklistItem[] {
  if (!plan) {
    return [];
  }

  if (plan.checklist?.length) {
    const completionById = new Map(plan.items?.map((item) => [item.id, item.completed]) ?? []);

    return plan.checklist.map((item) => ({
      ...item,
      completed: completionById.get(item.id) ?? item.completed,
    }));
  }

  return (
    plan.items?.map((item) => ({
      id: item.id,
      moment: item.moment,
      title: item.label,
      detail: item.reason,
      label: item.label,
      sectionTitle: formatMomentLabel(item.moment),
      completed: item.completed,
    })) ?? []
  );
}

function formatMomentLabel(moment: PlanItem['moment']) {
  if (moment === 'morning') return 'Morning';
  if (moment === 'day') return 'During the Day';
  return 'Evening';
}

function getCompletedCount(checklist: ChecklistItem[]) {
  return checklist.filter((item) => item.completed).length;
}

function groupChecklistByMoment(checklist: ChecklistItem[]) {
  const moments = [
    { moment: 'morning' as const, label: 'Morning' },
    { moment: 'day' as const, label: 'During the Day' },
    { moment: 'evening' as const, label: 'Evening' },
  ];

  return moments
    .map((moment) => ({
      ...moment,
      items: checklist.filter((item) => (item.moment ?? inferMomentFromSection(item.sectionTitle)) === moment.moment),
    }))
    .filter((group) => group.items.length > 0);
}

function inferMomentFromSection(sectionTitle: string): NonNullable<ChecklistItem['moment']> {
  if (/morning|favor|1\./i.test(sectionTitle)) return 'morning';
  if (/day|during|2\./i.test(sectionTitle)) return 'day';
  return 'evening';
}

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.question}>
      <SubstrateText variant="section">{title}</SubstrateText>
      <View style={styles.pills}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  loading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  question: {
    gap: Spacing.two,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  input: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FBF8F6',
    color: Colors.light.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '400',
    paddingHorizontal: Spacing.three,
  },
  textArea: {
    minHeight: 84,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  yesterdayChecklistBox: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 96,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.accentSoft,
    backgroundColor: '#FFFDFB',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  todoHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  todoList: {
    gap: Spacing.three,
  },
  momentGroup: {
    gap: Spacing.one,
  },
  momentItems: {
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
    borderColor: Colors.light.accent,
    backgroundColor: Colors.light.accent,
  },
  completedText: {
    textDecorationLine: 'line-through',
  },
  actionCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  summary: {
    paddingHorizontal: Spacing.one,
  },
  next: {
    marginTop: 'auto',
    paddingTop: Spacing.two,
  },
  disabled: {
    opacity: 0.65,
  },
});
