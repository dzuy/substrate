import { Link, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppShell,
  BrandMark,
  PrimaryButton,
  ScreenHeader,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { formatDisplayDate, getActiveEntryDate } from '@/services/daily-entries';

export default function WelcomeScreen() {
  const { signOut, user } = useAuth();
  const [entryDate, setEntryDate] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadActiveDate() {
        if (!user) {
          return;
        }

        const activeDate = await getActiveEntryDate(user.id);

        if (isMounted) {
          setEntryDate(activeDate);
        }
      }

      loadActiveDate();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  return (
    <AppShell contentStyle={styles.content}>
      <View style={styles.hero}>
        <BrandMark size={108} />
        <View style={styles.brandBlock}>
          <SubstrateText variant="brand">SUBSTRATE</SubstrateText>
          <SubstrateText variant="body" color={Colors.light.textMuted} style={styles.center}>
            Every beautiful outcome begins beneath the surface
          </SubstrateText>
          {user?.email ? (
            <SubstrateText variant="small" color={Colors.light.textMuted} style={styles.center}>
              Signed in as {user.email}
            </SubstrateText>
          ) : null}
        </View>
      </View>

      <View style={styles.copy}>
        <ScreenHeader
          eyebrow="Daily skin intelligence"
          title={entryDate ? `Test day ${formatDisplayDate(entryDate)}` : 'Every beautiful outcome begins beneath the surface.'}
          body="Capture a simulated day, generate a plan, then advance to the next test day to build progress history."
        />
      </View>

      <View style={styles.actions}>
        <Link href={'/photo' as Href} asChild>
          <Pressable>
            <PrimaryButton label="Start Today" />
          </Pressable>
        </Link>

        <Link href={'/progress' as Href} asChild>
          <Pressable style={styles.progressButton}>
            <SubstrateText variant="small" color={Colors.light.accent}>
              View Progress
            </SubstrateText>
          </Pressable>
        </Link>

        <Pressable accessibilityRole="button" onPress={signOut} style={styles.signOutButton}>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Sign out
          </SubstrateText>
        </Pressable>
      </View>
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
  actions: {
    gap: Spacing.two,
  },
  signOutButton: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressButton: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
