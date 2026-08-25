import { Link, type Href, useFocusEffect } from 'expo-router';
import { CircleAlert, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import {
  AppShell,
  BackLink,
  Card,
  PrimaryButton,
  ScreenHeader,
  StepProgress,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { formatDisplayDate, getActiveEntryDate, getOrCreateDailyEntry } from '@/services/daily-entries';
import { getOrCreateTodayRecommendation } from '@/services/recommendations';
import { stateLabels } from '@/skin-intelligence/skinStoryRules';
import type { SkinStory, SkinStoryState } from '@/skin-intelligence/skinStoryTypes';

export default function SkinStoryScreen() {
  const { user } = useAuth();
  const [skinStory, setSkinStory] = useState<SkinStory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [entryDate, setEntryDate] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadStory() {
        if (!user) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setErrorMessage('');

        const activeDate = await getActiveEntryDate(user.id);
        const entry = await getOrCreateDailyEntry(user.id, activeDate);

        if (!isMounted) return;

        if (entry.error || !entry.data) {
          setErrorMessage(entry.error?.message ?? "Couldn't load today's entry.");
          setIsLoading(false);
          return;
        }

        setEntryDate(activeDate);
        const recommendation = await getOrCreateTodayRecommendation(user.id, entry.data.id);

        if (!isMounted) return;

        if (recommendation.error || !recommendation.data) {
          setErrorMessage(recommendation.error?.message ?? "Couldn't generate today's story.");
          setIsLoading(false);
          return;
        }

        setSkinStory(recommendation.data.skinStory);
        setIsLoading(false);
      }

      loadStory();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  if (isLoading) {
    return (
      <AppShell>
        <BackLink href={'/environment' as Href} />
        <StepProgress currentStep={4} totalSteps={5} currentLabel="Skin Story" nextLabel="Today’s Plan" />
        <SkinStorySkeleton entryDate={entryDate} />
      </AppShell>
    );
  }

  const reasons = skinStory?.reasons?.length ? skinStory.reasons : skinStory?.contributors?.map((item) => item.detail) ?? [];
  const frameworkRead = skinStory?.frameworkRead ?? [];

  return (
    <AppShell>
      <BackLink href={'/environment' as Href} />
      <StepProgress currentStep={4} totalSteps={5} currentLabel="Skin Story" nextLabel="Today’s Plan" />
      <ScreenHeader eyebrow={entryDate ? formatDisplayDate(entryDate) : 'Test day'} title="Today’s Skin Story" />

      {errorMessage ? (
        <Card style={styles.errorCard}>
          <SubstrateText variant="section">Story unavailable</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            {errorMessage}
          </SubstrateText>
        </Card>
      ) : null}

      <Card style={styles.storyCard}>
        <View style={styles.iconBadge}>
          <Sparkles color={Colors.light.accentDeep} size={22} strokeWidth={2.4} />
        </View>
        <SubstrateText variant="subtitle">
          {skinStory?.headline ?? 'Your skin story is coming together'}
        </SubstrateText>
        <SubstrateText variant="body" color={Colors.light.textMuted}>
          {skinStory?.summary ?? 'Complete today’s check-in to generate a clearer story.'}
        </SubstrateText>
        {skinStory ? (
          <View style={styles.stateRow}>
            <StatePill label="Primary" state={skinStory.primaryState} />
            {skinStory.secondaryState ? <StatePill label="Secondary" state={skinStory.secondaryState} /> : null}
          </View>
        ) : null}
      </Card>

      <StoryListCard
        title="Why"
        emptyText="Complete today’s photo, check-in, and environment steps to identify likely contributors."
        items={reasons}
      />

      <Card style={styles.card}>
        <SubstrateText variant="section">Framework read</SubstrateText>
        {frameworkRead.length > 0 ? (
          <View style={styles.frameworkList}>
            {frameworkRead.map((item) => (
              <View key={item.dimension} style={styles.frameworkItem}>
                <View style={styles.frameworkTopRow}>
                  <SubstrateText variant="small" color={Colors.light.text}>
                    {formatFrameworkDimension(item.dimension)}
                  </SubstrateText>
                  <SubstrateText variant="tag" color={Colors.light.accentDeep}>
                    {item.status}
                  </SubstrateText>
                </View>
                <SubstrateText variant="small" color={Colors.light.textMuted}>
                  {item.detail}
                </SubstrateText>
              </View>
            ))}
          </View>
        ) : (
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            The framework read will appear after today’s story is generated.
          </SubstrateText>
        )}
      </Card>

      <Link href={'/daily-plan' as Href} asChild>
        <Pressable style={styles.next}>
          <PrimaryButton label="See Today's Plan" />
        </Pressable>
      </Link>
    </AppShell>
  );
}

function StoryListCard({
  emptyText,
  items,
  title,
}: {
  emptyText: string;
  items: string[];
  title: string;
}) {
  return (
    <Card style={styles.card}>
      <SubstrateText variant="section">{title}</SubstrateText>
      {items.length > 0 ? (
        <View style={styles.list}>
          {items.slice(0, 4).map((item) => (
            <StoryListItem key={item} text={item} />
          ))}
        </View>
      ) : (
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          {emptyText}
        </SubstrateText>
      )}
    </Card>
  );
}

function StoryListItem({ text }: { text: string }) {
  return (
    <View style={styles.listItem}>
      <View style={styles.listIcon}>
        <CircleAlert color={Colors.light.accentDeep} size={17} strokeWidth={2.4} />
      </View>
      <SubstrateText variant="small" color={Colors.light.text}>
        {text}
      </SubstrateText>
    </View>
  );
}

function formatFrameworkDimension(dimension: SkinStory['frameworkRead'][number]['dimension']) {
  if (dimension === 'barrier') return 'Barrier';
  if (dimension === 'inflammation') return 'Inflammation';
  if (dimension === 'hydration') return 'Hydration';
  if (dimension === 'collagen') return 'Collagen';
  return 'Pigmentation';
}

function StatePill({ label, state }: { label: string; state: SkinStoryState }) {
  return (
    <View style={styles.statePill}>
      <SubstrateText variant="tag" color={Colors.light.textMuted}>
        {label}
      </SubstrateText>
      <SubstrateText variant="small" color={Colors.light.accentDeep}>
        {stateLabels[state]}
      </SubstrateText>
    </View>
  );
}

function SkinStorySkeleton({ entryDate }: { entryDate: string | null }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [pulse]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.52, 1],
  });

  return (
    <>
      <View style={styles.skeletonHeader}>
        {entryDate ? (
          <SubstrateText variant="small" color={Colors.light.accent}>
            {formatDisplayDate(entryDate)}
          </SubstrateText>
        ) : (
          <SkeletonBlock opacity={opacity} width="28%" height={18} />
        )}
        <SkeletonBlock opacity={opacity} width="78%" height={38} />
        <SkeletonBlock opacity={opacity} width="92%" height={22} />
        <SkeletonBlock opacity={opacity} width="64%" height={22} />
      </View>

      <Card style={styles.storyCard}>
        <SkeletonBlock opacity={opacity} width="72%" height={28} radius={12} />
        <SkeletonBlock opacity={opacity} width="100%" height={18} />
        <SkeletonBlock opacity={opacity} width="82%" height={18} />
      </Card>

      <Card style={styles.card}>
        <SkeletonBlock opacity={opacity} width="34%" height={24} />
        <SkeletonBlock opacity={opacity} width="100%" height={44} radius={14} />
        <SkeletonBlock opacity={opacity} width="100%" height={44} radius={14} />
        <SkeletonBlock opacity={opacity} width="84%" height={44} radius={14} />
      </Card>
    </>
  );
}

function SkeletonBlock({
  height,
  opacity,
  radius = 999,
  width,
}: {
  height: number;
  opacity: Animated.AnimatedInterpolation<string | number>;
  radius?: number;
  width: `${number}%`;
}) {
  return <Animated.View style={[styles.skeletonBlock, { borderRadius: radius, height, opacity, width }]} />;
}

const styles = StyleSheet.create({
  skeletonHeader: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  skeletonBlock: {
    backgroundColor: Colors.light.backgroundSelected,
  },
  storyCard: {
    gap: Spacing.two,
  },
  iconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.light.backgroundSelected,
  },
  stateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  statePill: {
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FBF8F6',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: Spacing.two,
  },
  card: {
    gap: Spacing.two,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
  frameworkList: {
    gap: Spacing.two,
  },
  frameworkItem: {
    gap: Spacing.one,
    borderRadius: 14,
    backgroundColor: '#FBF8F6',
    padding: Spacing.two,
  },
  frameworkTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  list: {
    gap: Spacing.two,
  },
  listItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: 14,
    backgroundColor: '#FBF8F6',
    padding: Spacing.two,
  },
  listIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSelected,
  },
  errorCard: {
    gap: Spacing.one,
    backgroundColor: Colors.light.blush,
  },
  next: {
    marginTop: 'auto',
    paddingTop: Spacing.two,
  },
});
