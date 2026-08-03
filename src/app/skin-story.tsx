import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppShell,
  BackLink,
  Card,
  MetricRing,
  PrimaryButton,
  ScreenHeader,
  SignalRow,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Spacing } from '@/constants/theme';

const contributors = [
  { label: 'Poor sleep', detail: '7h 12m with reduced recovery' },
  { label: 'High UV exposure', detail: 'Peak index was elevated today' },
  { label: 'Luteal phase', detail: 'Barrier may be more reactive' },
];

export default function SkinStoryScreen() {
  return (
    <AppShell>
      <BackLink href={'/check-in' as Href} />
      <ScreenHeader
        eyebrow="Today"
        title="Your skin appears more inflamed today."
        body="Visible redness and reactivity are trending above your recent baseline."
      />

      <Card style={styles.heroCard}>
        <MetricRing value="12%" label="more inflamed than baseline" />
        <View style={styles.priority}>
          <SubstrateText variant="section">Today's priority</SubstrateText>
          <SubstrateText variant="body">Calm inflammation and support the skin barrier.</SubstrateText>
        </View>
      </Card>

      <Card style={styles.card}>
        <SubstrateText variant="section">Potential contributors</SubstrateText>
        <View style={styles.list}>
          {contributors.map((item) => (
            <SignalRow key={item.label} label={item.label} detail={item.detail} />
          ))}
        </View>
      </Card>

      <Card style={styles.avoidCard}>
        <SubstrateText variant="section">What to avoid today</SubstrateText>
        <View style={styles.tags}>
          <SubstrateText variant="tag">Retinoids</SubstrateText>
          <SubstrateText variant="tag">Strong exfoliation</SubstrateText>
          <SubstrateText variant="tag">High-heat treatments</SubstrateText>
        </View>
      </Card>

      <Link href={'/daily-plan' as Href} asChild>
        <Pressable style={styles.next}>
          <PrimaryButton label="See Today's Plan" />
        </Pressable>
      </Link>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  priority: {
    gap: Spacing.one,
    alignItems: 'center',
  },
  card: {
    gap: Spacing.two,
  },
  avoidCard: {
    gap: Spacing.two,
    backgroundColor: Colors.light.warningSoft,
  },
  list: {
    gap: Spacing.two,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  next: {
    marginTop: 'auto',
    paddingTop: Spacing.two,
  },
});
