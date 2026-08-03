import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppShell,
  BrandMark,
  PrimaryButton,
  ScreenHeader,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Spacing } from '@/constants/theme';

export default function WelcomeScreen() {
  return (
    <AppShell contentStyle={styles.content}>
      <View style={styles.hero}>
        <BrandMark size={108} />
        <View style={styles.brandBlock}>
          <SubstrateText variant="brand">SUBSTRATE</SubstrateText>
          <SubstrateText variant="body" color={Colors.light.textMuted} style={styles.center}>
            Every beautiful outcome begins beneath the surface
          </SubstrateText>
        </View>
      </View>

      <View style={styles.copy}>
        <ScreenHeader
          eyebrow="Daily skin intelligence"
          title="Every beautiful outcome begins beneath the surface."
          body="Capture today's signals, see what may be changing, and get a calm plan for what to do next."
        />
      </View>

      <Link href={'/photo' as Href} asChild>
        <Pressable>
          <PrimaryButton label="Start Today" />
        </Pressable>
      </Link>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'space-between',
    minHeight: '100%',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingTop: Spacing.four,
  },
  brandBlock: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  center: {
    textAlign: 'center',
    maxWidth: 260,
  },
  copy: {
    paddingBottom: Spacing.three,
  },
});
