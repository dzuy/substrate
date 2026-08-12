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
  saveDailyCheckIn,
} from '@/services/daily-entries';
import type { CheckInResponses } from '@/types/database';

const sleep = ['Poor', 'Okay', 'Rested'];
const stress = ['Low', 'Medium', 'High'];
const alcohol = ['None', 'Light', 'Moderate', 'High'];
const cycle = ['Menstrual', 'Follicular', 'Ovulatory', 'Luteal', 'Not tracking'];

export default function CheckInScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [entryId, setEntryId] = useState<string | null>(null);
  const [sleepQuality, setSleepQuality] = useState<NonNullable<CheckInResponses['sleepQuality']>>('Poor');
  const [stressLevel, setStressLevel] = useState<NonNullable<CheckInResponses['stressLevel']>>('Medium');
  const [alcoholConsumption, setAlcoholConsumption] = useState<NonNullable<CheckInResponses['alcoholConsumption']>>('None');
  const [cyclePhase, setCyclePhase] = useState<NonNullable<CheckInResponses['cyclePhase']>>('Luteal');
  const [routineNote, setRoutineNote] = useState('');
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
    if (checkIn.alcoholConsumption) {
      setAlcoholConsumption(checkIn.alcoholConsumption);
    }
    if (checkIn.cyclePhase) {
      setCyclePhase(checkIn.cyclePhase);
    }
    if (checkIn.routineNote) {
      setRoutineNote(checkIn.routineNote);
    } else if (checkIn.routineChange && checkIn.routineChange !== 'No change') {
      setRoutineNote(checkIn.routineChange);
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
      alcoholConsumption,
      cyclePhase,
      routineNote: routineNote.trim() || undefined,
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
              Loading today's entry
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

        <Question title="Did you drink alcohol?">
          {alcohol.map((item) => (
            <Pill
              key={item}
              label={item}
              selected={alcoholConsumption === item}
              onPress={() => setAlcoholConsumption(item as NonNullable<CheckInResponses['alcoholConsumption']>)}
            />
          ))}
        </Question>

        <Question title="Where are you in your cycle?">
          {cycle.map((item) => (
            <Pill
              key={item}
              label={item}
              selected={cyclePhase === item}
              onPress={() => setCyclePhase(item as NonNullable<CheckInResponses['cyclePhase']>)}
            />
          ))}
        </Question>

        <Question title="Anything different to note?">
          <TextInput
            autoCapitalize="sentences"
            autoCorrect
            onChangeText={setRoutineNote}
            placeholder="Optional note"
            placeholderTextColor={Colors.light.textMuted}
            returnKeyType="done"
            style={styles.input}
            value={routineNote}
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
