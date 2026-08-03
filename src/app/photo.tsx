import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppShell,
  BackLink,
  Card,
  FaceGuide,
  PrimaryButton,
  ScreenHeader,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Spacing } from '@/constants/theme';

const checklist = [
  'Face the camera directly',
  'Use soft, even lighting',
  'Remove glasses where appropriate',
  'Keep your face centered',
];

export default function PhotoScreen() {
  return (
    <AppShell>
      <BackLink href="/" />
      <ScreenHeader
        eyebrow="Step 1"
        title="Take your photo"
        body="Keep the image consistent with your recent baseline."
      />

      <FaceGuide />

      <Card style={styles.card}>
        <SubstrateText variant="section">For best results</SubstrateText>
        <View style={styles.list}>
          {checklist.map((item) => (
            <View key={item} style={styles.row}>
              <View style={styles.dot} />
              <SubstrateText variant="small">{item}</SubstrateText>
            </View>
          ))}
        </View>
      </Card>

      <View style={styles.actions}>
        <View style={styles.captureRing}>
          <View style={styles.captureButton} />
        </View>
        <Link href={'/check-in' as Href} asChild>
          <Pressable>
            <PrimaryButton label="Use Simulated Capture" />
          </Pressable>
        </Link>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.accent,
  },
  actions: {
    marginTop: 'auto',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  captureRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: Colors.light.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.light.accent,
  },
});
