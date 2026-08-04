import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import {
  AppShell,
  BackLink,
  Card,
  Pill,
  PrimaryButton,
  ScreenHeader,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import {
  formatDisplayDate,
  getActiveEntryDate,
  getOrCreateDailyEntry,
  saveDailyCheckIn,
} from '@/services/daily-entries';
import type { CheckInResponses } from '@/types/database';

const feelings = ['Calm', 'Dry', 'Reactive', 'Congested'];
const stress = ['Low', 'Medium', 'High'];
const sleep = ['Poor', 'Okay', 'Rested'];
const activity = ['Light', 'Moderate', 'Intense'];
const cycle = ['Follicular', 'Ovulatory', 'Luteal', 'Not tracking'];

export default function CheckInScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [entryId, setEntryId] = useState<string | null>(null);
  const [skinFeel, setSkinFeel] = useState<NonNullable<CheckInResponses['skinFeel']>>('Reactive');
  const [stressLevel, setStressLevel] = useState<NonNullable<CheckInResponses['stressLevel']>>('Medium');
  const [sleepQuality, setSleepQuality] = useState<NonNullable<CheckInResponses['sleepQuality']>>('Poor');
  const [activityLevel, setActivityLevel] = useState<NonNullable<CheckInResponses['activityLevel']>>('Light');
  const [cyclePhase, setCyclePhase] = useState<NonNullable<CheckInResponses['cyclePhase']>>('Luteal');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState<string | null>(null);

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
        setEntryDate(activeDate);
        hydrateCheckIn(data.check_in);
        setLastSavedAt(hasCheckInResponses(data.check_in) ? data.updated_at : null);
        setSaveMessage(hasCheckInResponses(data.check_in) ? 'Loaded saved responses for this test day.' : '');
        setIsLoading(false);
      }

      loadDailyEntry();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  function hydrateCheckIn(checkIn: CheckInResponses) {
    if (checkIn.skinFeel) {
      setSkinFeel(checkIn.skinFeel);
    }
    if (checkIn.stressLevel) {
      setStressLevel(checkIn.stressLevel);
    }
    if (checkIn.sleepQuality) {
      setSleepQuality(checkIn.sleepQuality);
    }
    if (checkIn.activityLevel) {
      setActivityLevel(checkIn.activityLevel);
    }
    if (checkIn.cyclePhase) {
      setCyclePhase(checkIn.cyclePhase);
    }
  }

  async function handleSaveAndContinue() {
    if (!entryId) {
      setSaveError('Daily entry is not ready yet. Try again in a moment.');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveMessage('');

    const { data, error } = await saveDailyCheckIn(entryId, {
      skinFeel,
      stressLevel,
      sleepQuality,
      activityLevel,
      cyclePhase,
    });

    setIsSaving(false);

    if (error) {
      setSaveError(error.message);
      return;
    }

    setLastSavedAt(data?.updated_at ?? new Date().toISOString());
    setSaveMessage('Check-in saved to Supabase.');
    router.push('/skin-story');
  }

  return (
    <AppShell>
      <BackLink href={'/photo' as Href} />
      <ScreenHeader
        eyebrow="Step 2"
        title="Daily check-in"
        body={`Test day ${entryDate ? formatDisplayDate(entryDate) : ''}. Add the context signals that may explain this skin state.`}
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

        <Question title="How does your skin feel?">
          {feelings.map((item) => (
            <Pill
              key={item}
              label={item}
              selected={skinFeel === item}
              onPress={() => setSkinFeel(item as NonNullable<CheckInResponses['skinFeel']>)}
            />
          ))}
        </Question>

        <Question title="Stress level">
          {stress.map((item) => (
            <Pill
              key={item}
              label={item}
              selected={stressLevel === item}
              onPress={() => setStressLevel(item as NonNullable<CheckInResponses['stressLevel']>)}
            />
          ))}
        </Question>

        <Question title="Sleep quality">
          {sleep.map((item) => (
            <Pill
              key={item}
              label={item}
              selected={sleepQuality === item}
              onPress={() => setSleepQuality(item as NonNullable<CheckInResponses['sleepQuality']>)}
            />
          ))}
        </Question>

        <Question title="Activity level">
          {activity.map((item) => (
            <Pill
              key={item}
              label={item}
              selected={activityLevel === item}
              onPress={() => setActivityLevel(item as NonNullable<CheckInResponses['activityLevel']>)}
            />
          ))}
        </Question>

        <Question title="Cycle phase">
          {cycle.map((item) => (
            <Pill
              key={item}
              label={item}
              selected={cyclePhase === item}
              onPress={() => setCyclePhase(item as NonNullable<CheckInResponses['cyclePhase']>)}
            />
          ))}
        </Question>
      </Card>

      <View style={styles.summary}>
        {saveError ? (
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            {saveError}
          </SubstrateText>
        ) : (
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {saveMessage || "Your responses save to this test day's private entry."}
            {lastSavedAt ? ` Last saved ${formatTime(lastSavedAt)}.` : ''}
          </SubstrateText>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isLoading || isSaving}
        onPress={handleSaveAndContinue}
        style={[styles.next, (isLoading || isSaving) && styles.disabled]}>
        <PrimaryButton label={isSaving ? 'Saving Check-In' : "Save & View Today's Skin Story"} />
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

function hasCheckInResponses(checkIn: CheckInResponses) {
  return Object.keys(checkIn).length > 0;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  loading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  question: {
    gap: 6,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
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
