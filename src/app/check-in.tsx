import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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

const feelings = ['Calm', 'Dry', 'Reactive', 'Congested'];
const stress = ['Low', 'Medium', 'High'];
const sleep = ['Poor', 'Okay', 'Rested'];
const activity = ['Light', 'Moderate', 'Intense'];
const cycle = ['Follicular', 'Ovulatory', 'Luteal', 'Not tracking'];

export default function CheckInScreen() {
  const [skinFeel, setSkinFeel] = useState('Reactive');
  const [stressLevel, setStressLevel] = useState('Medium');
  const [sleepQuality, setSleepQuality] = useState('Poor');
  const [activityLevel, setActivityLevel] = useState('Light');
  const [cyclePhase, setCyclePhase] = useState('Luteal');

  return (
    <AppShell>
      <BackLink href={'/photo' as Href} />
      <ScreenHeader
        eyebrow="Step 2"
        title="Daily check-in"
        body="Add the context signals that may explain today's skin."
      />

      <Card style={styles.card}>
        <Question title="How does your skin feel?">
          {feelings.map((item) => (
            <Pill key={item} label={item} selected={skinFeel === item} onPress={() => setSkinFeel(item)} />
          ))}
        </Question>

        <Question title="Stress level">
          {stress.map((item) => (
            <Pill
              key={item}
              label={item}
              selected={stressLevel === item}
              onPress={() => setStressLevel(item)}
            />
          ))}
        </Question>

        <Question title="Sleep quality">
          {sleep.map((item) => (
            <Pill
              key={item}
              label={item}
              selected={sleepQuality === item}
              onPress={() => setSleepQuality(item)}
            />
          ))}
        </Question>

        <Question title="Activity level">
          {activity.map((item) => (
            <Pill
              key={item}
              label={item}
              selected={activityLevel === item}
              onPress={() => setActivityLevel(item)}
            />
          ))}
        </Question>

        <Question title="Cycle phase">
          {cycle.map((item) => (
            <Pill
              key={item}
              label={item}
              selected={cyclePhase === item}
              onPress={() => setCyclePhase(item)}
            />
          ))}
        </Question>
      </Card>

      <View style={styles.summary}>
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          Mock state only for this prototype.
        </SubstrateText>
      </View>

      <Link href={'/skin-story' as Href} asChild>
        <Pressable style={styles.next}>
          <PrimaryButton label="View Today's Skin Story" />
        </Pressable>
      </Link>
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
    gap: 12,
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
});
