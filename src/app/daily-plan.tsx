import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

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

const plan = [
  {
    title: '1. Calm inflammation',
    detail: 'Use a low-friction routine and reduce active ingredients for 24 hours.',
    items: ['Centella or panthenol serum', 'Cool compress for 5 minutes', 'Skip retinoids tonight'],
  },
  {
    title: '2. Support the barrier',
    detail: 'Prioritize hydration and lipid support before adding treatment steps.',
    items: ['Ceramide moisturizer', 'Gentle cleanser only', 'Avoid physical exfoliation'],
  },
  {
    title: '3. Protect against UV',
    detail: 'Your exposure signal is elevated, so protection matters more today.',
    items: ['Broad-spectrum SPF 50', 'Reapply before afternoon sun', 'Add hat or shade when outside'],
  },
];

export default function DailyPlanScreen() {
  return (
    <AppShell>
      <BackLink href={'/skin-story' as Href} />
      <ScreenHeader
        eyebrow="Daily plan"
        title="A focused routine for today's skin state."
        body="Recommendations are prioritized by what is most likely to help today, not by product category."
      />

      <View style={styles.planList}>
        {plan.map((section) => (
          <Card key={section.title} style={styles.planCard}>
            <SubstrateText variant="section">{section.title}</SubstrateText>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              {section.detail}
            </SubstrateText>
            <View style={styles.items}>
              {section.items.map((item) => (
                <SignalRow key={item} label={item} compact />
              ))}
            </View>
          </Card>
        ))}
      </View>

      <Link href="/" asChild>
        <Pressable style={styles.next}>
          <PrimaryButton label="Finish Routine" />
        </Pressable>
      </Link>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  planList: {
    gap: Spacing.two,
  },
  planCard: {
    gap: Spacing.two,
  },
  items: {
    gap: Spacing.one,
  },
  next: {
    paddingTop: Spacing.two,
  },
});
