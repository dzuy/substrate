import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { getLatestRecommendation } from '@/services/recommendations';
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
  const [yesterdayChecklist, setYesterdayChecklist] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

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
        setYesterdayChecklist(previousRecommendation.data?.dailyPlan.checklist ?? []);
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

        <Question title="Yesterday's Checklist">
          <View style={styles.yesterdayChecklistBox}>
            {yesterdayChecklist.length ? (
              yesterdayChecklist.map((item) => <YesterdayChecklistItem key={item.id} item={item} />)
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
        disabled={isLoading || isSaving}
        onPress={handleSaveAndContinue}
        style={[styles.next, (isLoading || isSaving) && styles.disabled]}>
        <PrimaryButton label={isSaving ? 'Saving Check-In' : 'Next'} />
      </Pressable>
    </AppShell>
  );
}

function YesterdayChecklistItem({ item }: { item: ChecklistItem }) {
  return (
    <View style={styles.yesterdayChecklistItem}>
      <View style={[styles.statusDot, item.completed && styles.statusDotComplete]} />
      <View style={styles.yesterdayChecklistCopy}>
        <SubstrateText variant="small" color={item.completed ? Colors.light.textMuted : Colors.light.text}>
          {item.title ?? item.label}
        </SubstrateText>
        {item.detail ? (
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {item.detail}
          </SubstrateText>
        ) : null}
      </View>
      <SubstrateText variant="tag" color={item.completed ? '#3D7D55' : Colors.light.textMuted}>
        {item.completed ? 'Done' : 'Not done'}
      </SubstrateText>
    </View>
  );
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
    fontWeight: '500',
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FBF8F6',
    gap: Spacing.two,
    padding: Spacing.two,
  },
  yesterdayChecklistItem: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  yesterdayChecklistCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FFFFFF',
    marginTop: 4,
  },
  statusDotComplete: {
    borderColor: '#3D7D55',
    backgroundColor: '#3D7D55',
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
