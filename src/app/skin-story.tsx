import { Link, type Href, useFocusEffect } from 'expo-router';
import {
  CircleAlert,
  CircleCheck,
  CircleMinus,
  Droplets,
  Flame,
  Moon,
  ScanFace,
  Zap,
} from 'lucide-react-native';
import { type ComponentType, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import {
  AppShell,
  BackLink,
  Card,
  MetricRing,
  PrimaryButton,
  ScreenHeader,
  StepProgress,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { formatDisplayDate, getActiveEntryDate, getOrCreateDailyEntry } from '@/services/daily-entries';
import { getOrCreateTodayRecommendation } from '@/services/recommendations';
import type { AnalysisSignals, SkinStory } from '@/types/database';

export default function SkinStoryScreen() {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<AnalysisSignals>({});
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

        setAnalysis(recommendation.data.analysis);
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

  const metric = getSkinHealthMetric(analysis);
  const contributors = skinStory?.contributors ?? [];
  const driverCards = buildDriverCards(analysis, contributors);
  const photoSignals = buildPhotoSignalCards(analysis);
  const avoid = buildAvoidTags(analysis);

  return (
    <AppShell>
      <BackLink href={'/environment' as Href} />
      <StepProgress currentStep={4} totalSteps={5} currentLabel="Skin Story" nextLabel="Today’s Plan" />
      <ScreenHeader
        eyebrow={entryDate ? formatDisplayDate(entryDate) : 'Test day'}
        title={skinStory?.headline ?? "Preparing today's skin story."}
        body={skinStory?.summary ?? 'Substrate is reading your saved photo and check-in signals.'}
      />

      {errorMessage ? (
        <Card style={styles.errorCard}>
          <SubstrateText variant="section">Story unavailable</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            {errorMessage}
          </SubstrateText>
        </Card>
      ) : null}

      <Card style={styles.heroCard}>
        <MetricRing value={String(metric.value)} label={metric.label} />
        <View style={styles.priority}>
          <SubstrateText variant="section">{formatScoreBand(analysis.scoreBand)}</SubstrateText>
          {typeof analysis.scoreDelta === 'number' ? (
            <SubstrateText variant="small" color={getDeltaColor(analysis.scoreDelta)}>
              {formatScoreDelta(analysis.scoreDelta)} from last check-in
            </SubstrateText>
          ) : (
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              First scored check-in
            </SubstrateText>
          )}
          <SubstrateText variant="body">{skinStory?.priority ?? 'Complete today’s check-in to personalize this.'}</SubstrateText>
        </View>
      </Card>

      {analysis.photoAnalysis?.analyzedAt ? (
        <Card style={styles.card}>
          <SubstrateText variant="section">Photo signals</SubstrateText>
          <View style={styles.signalGrid}>
            {photoSignals.map((item) => (
              <SignalTile key={item.label} {...item} />
            ))}
          </View>
        </Card>
      ) : null}

      <Card style={styles.driverSection}>
        <View style={styles.sectionHeader}>
          <SubstrateText variant="section">Top drivers</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Scan what helped or pressured today’s score
          </SubstrateText>
        </View>
        <View style={styles.driverList}>
          {driverCards.length > 0 ? driverCards.map((item) => (
            <DriverCard key={item.label} {...item} />
          )) : (
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Complete today’s check-in to identify likely contributors.
            </SubstrateText>
          )}
        </View>
      </Card>

      <Card style={styles.avoidCard}>
        <SubstrateText variant="section">What to avoid today</SubstrateText>
        <View style={styles.tags}>
          {avoid.map((item) => (
            <SubstrateText key={item} variant="tag">
              {item}
            </SubstrateText>
          ))}
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

      <Card style={styles.skeletonHeroCard}>
        <Animated.View style={[styles.skeletonRing, { opacity }]}>
          <View style={styles.skeletonRingInner} />
        </Animated.View>
        <SkeletonBlock opacity={opacity} width="48%" height={24} />
        <SkeletonBlock opacity={opacity} width="72%" height={18} />
      </Card>

      <Card style={styles.card}>
        <SkeletonBlock opacity={opacity} width="34%" height={24} />
        <View style={styles.skeletonGrid}>
          <SkeletonBlock opacity={opacity} width="47%" height={92} radius={16} />
          <SkeletonBlock opacity={opacity} width="47%" height={92} radius={16} />
          <SkeletonBlock opacity={opacity} width="47%" height={92} radius={16} />
          <SkeletonBlock opacity={opacity} width="47%" height={92} radius={16} />
        </View>
      </Card>

      <Card style={styles.driverSection}>
        <SkeletonBlock opacity={opacity} width="36%" height={24} />
        <View style={styles.driverList}>
          <SkeletonBlock opacity={opacity} width="100%" height={66} radius={16} />
          <SkeletonBlock opacity={opacity} width="100%" height={66} radius={16} />
          <SkeletonBlock opacity={opacity} width="100%" height={66} radius={16} />
        </View>
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

type StoryIcon = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
type StoryTone = { color: string; soft: string };

type DriverCardItem = {
  detail: string;
  icon: StoryIcon;
  impact?: number;
  label: string;
  tone: StoryTone;
};

type SignalTileItem = {
  icon: StoryIcon;
  label: string;
  tone: StoryTone;
  value: string;
};

function DriverCard({ detail, icon: Icon, impact, label, tone }: DriverCardItem) {
  return (
    <View style={[styles.driverCard, { backgroundColor: tone.soft }]}>
      <View style={[styles.driverIcon, { backgroundColor: '#FFFFFF' }]}>
        <Icon color={tone.color} size={18} strokeWidth={2.4} />
      </View>
      <View style={styles.driverCopy}>
        <View style={styles.driverTopRow}>
          <SubstrateText variant="small" color={Colors.light.text}>
            {label}
          </SubstrateText>
          {typeof impact === 'number' ? (
            <SubstrateText variant="tag" color={tone.color}>
              {formatImpact(impact)}
            </SubstrateText>
          ) : null}
        </View>
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          {detail}
        </SubstrateText>
      </View>
    </View>
  );
}

function SignalTile({ icon: Icon, label, tone, value }: SignalTileItem) {
  return (
    <View style={[styles.signalTile, { backgroundColor: tone.soft }]}>
      <View style={styles.signalTileTop}>
        <Icon color={tone.color} size={17} strokeWidth={2.4} />
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          {label}
        </SubstrateText>
      </View>
      <SubstrateText variant="section" color={Colors.light.text}>
        {value}
      </SubstrateText>
    </View>
  );
}

function getSkinHealthMetric(analysis: AnalysisSignals) {
  if (typeof analysis.skinHealthScore === 'number') {
    return { label: 'skin health score', value: analysis.skinHealthScore };
  }

  const entries = [
    { label: 'reactivity signal', value: analysis.redness ?? 0 },
    { label: 'dryness signal', value: analysis.dryness ?? 0 },
    { label: 'congestion signal', value: analysis.congestion ?? 0 },
    { label: 'recovery signal', value: analysis.fatigue ?? 0 },
  ];

  return entries.sort((a, b) => b.value - a.value)[0] ?? entries[0];
}

function formatScoreBand(scoreBand: AnalysisSignals['scoreBand']) {
  if (scoreBand === 'stable') return 'Stable and resilient';
  if (scoreBand === 'balanced') return 'Generally balanced';
  if (scoreBand === 'stressed') return 'Some stress showing';
  if (scoreBand === 'reactive') return 'Elevated reactivity';
  if (scoreBand === 'high_stress') return 'High skin stress state';
  return "Today's priority";
}

function formatScoreDelta(delta: number) {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function getDeltaColor(delta: number) {
  if (delta > 0) return '#3D7D55';
  if (delta < 0) return Colors.light.accentDeep;
  return Colors.light.textMuted;
}

function buildAvoidTags(analysis: AnalysisSignals) {
  const negativeDrivers = analysis.drivers?.filter((driver) => driver.direction === 'negative') ?? [];
  const tags = ['Strong exfoliation', 'High-heat treatments'];

  if (negativeDrivers.some((driver) => driver.label === 'Strong actives')) {
    tags.unshift('Retinoids');
  }
  if (negativeDrivers.some((driver) => driver.label.includes('alcohol'))) {
    tags.push('Dehydrating masks');
  }
  if (negativeDrivers.some((driver) => driver.label.includes('UV'))) {
    tags.push('Unprotected midday sun');
  }

  return Array.from(new Set(tags)).slice(0, 4);
}

function buildDriverCards(analysis: AnalysisSignals, contributors: Array<{ label: string; detail: string }>) {
  const contributorDetails = new Map(contributors.map((item) => [item.label, item.detail]));
  const driverCards =
    analysis.drivers
      ?.slice()
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
      .slice(0, 5)
      .map((driver) => {
        const tone = getDriverTone(driver.impact, driver.direction);
        return {
          detail: contributorDetails.get(driver.label) ?? describeDriver(driver.label, driver.impact, driver.direction),
          icon: getDriverIcon(driver.label, driver.impact, driver.direction),
          impact: driver.impact,
          label: driver.label,
          tone,
        };
      }) ?? [];

  if (driverCards.length > 0) {
    return driverCards;
  }

  return contributors.slice(0, 5).map((item) => ({
    detail: item.detail,
    icon: CircleMinus,
    label: item.label,
    tone: tones.neutral,
  }));
}

function buildPhotoSignalCards(analysis: AnalysisSignals): SignalTileItem[] {
  const photo = analysis.photoAnalysis;

  return [
    {
      icon: Flame,
      label: 'Redness',
      tone: getVisualSignalTone(photo?.redness),
      value: formatNumber(photo?.redness),
    },
    {
      icon: Droplets,
      label: 'Dryness',
      tone: getVisualSignalTone(photo?.dryness),
      value: formatNumber(photo?.dryness),
    },
    {
      icon: ScanFace,
      label: 'Congestion',
      tone: getVisualSignalTone(photo?.congestion),
      value: formatNumber(photo?.congestion),
    },
    {
      icon: Moon,
      label: 'Fatigue',
      tone: getVisualSignalTone(photo?.fatigue),
      value: formatNumber(photo?.fatigue),
    },
  ];
}

function getDriverTone(impact: number, direction: 'positive' | 'negative') {
  if (direction === 'positive' || impact > 0) return tones.green;
  if (Math.abs(impact) >= 8) return tones.berry;
  if (Math.abs(impact) >= 4) return tones.gold;
  return tones.neutral;
}

function getDriverIcon(label: string, impact: number, direction: 'positive' | 'negative'): StoryIcon {
  if (direction === 'positive' || impact > 0) return CircleCheck;
  if (/sleep|fatigue/i.test(label)) return Moon;
  if (/stress|reactiv|redness|uv|heat|air|alcohol|active|treatment/i.test(label)) return CircleAlert;
  if (/photo|face|focus|lighting/i.test(label)) return ScanFace;
  return Zap;
}

function describeDriver(label: string, impact: number, direction: 'positive' | 'negative') {
  if (direction === 'positive' || impact > 0) {
    return 'This appears to support today’s skin health score.';
  }

  if (/environment|uv|humidity|air|heat|cold/i.test(label)) {
    return 'External exposure may be adding pressure today.';
  }

  if (/photo|face|focus|lighting/i.test(label)) {
    return 'Photo quality can reduce confidence in today’s read.';
  }

  return 'This may be increasing visible skin stress today.';
}

function getVisualSignalTone(value?: number) {
  if (typeof value !== 'number') return tones.neutral;
  if (value >= 70) return tones.berry;
  if (value >= 45) return tones.gold;
  return tones.green;
}

function formatImpact(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function formatNumber(value?: number) {
  return typeof value === 'number' ? value.toFixed(1) : 'Not available';
}

const tones = {
  berry: { color: Colors.light.accent, soft: '#F7E6EF' },
  gold: { color: '#B98222', soft: '#FFF2D8' },
  green: { color: '#3D7D55', soft: Colors.light.successSoft },
  neutral: { color: Colors.light.textMuted, soft: '#F4ECEC' },
} satisfies Record<string, StoryTone>;

const styles = StyleSheet.create({
  skeletonHeader: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  skeletonBlock: {
    backgroundColor: Colors.light.backgroundSelected,
  },
  skeletonHeroCard: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  skeletonRing: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: Colors.light.backgroundSelected,
  },
  skeletonRingInner: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: Colors.light.backgroundElement,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
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
  driverSection: {
    gap: Spacing.three,
  },
  sectionHeader: {
    gap: Spacing.two,
  },
  driverList: {
    gap: Spacing.two,
  },
  driverCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: 16,
    padding: Spacing.two,
  },
  driverIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  driverCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  driverTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  signalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  signalTile: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 140,
    borderRadius: 16,
    gap: Spacing.one,
    padding: Spacing.two,
  },
  signalTileTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
  avoidCard: {
    gap: Spacing.two,
    backgroundColor: Colors.light.warningSoft,
  },
  errorCard: {
    gap: Spacing.one,
    backgroundColor: Colors.light.blush,
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
