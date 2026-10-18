import { Link, usePathname, useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { ChevronLeft, MessageCircle, House, FilePlus2, Files, ShoppingBag } from 'lucide-react-native';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useReportTheme } from '@/report/theme';

import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';

type TextVariant =
  | 'brand'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'small'
  | 'section'
  | 'tag'
  | 'metricLabel';

export function AppShell({
  children,
  contentStyle,
}: {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={styles.viewport}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export function SubstrateText({
  children,
  variant = 'body',
  color = Colors.light.text,
  style,
}: {
  children: React.ReactNode;
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[stylesText[variant], { color }, style]}>{children}</Text>;
}

export function ScreenHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
}) {
  return (
    <View style={styles.header}>
      {eyebrow ? (
        <SubstrateText variant="small" color={Colors.light.accent}>
          {eyebrow}
        </SubstrateText>
      ) : null}
      <SubstrateText variant="title">{title}</SubstrateText>
      {body ? (
        <SubstrateText variant="body" color={Colors.light.textMuted}>
          {body}
        </SubstrateText>
      ) : null}
    </View>
  );
}

export function BackLink({ href }: { href: Href }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityLabel="Go back" accessibilityRole="button" style={styles.backButton}>
        <ChevronLeft color={Colors.light.accentDeep} size={24} strokeWidth={2.2} />
      </Pressable>
    </Link>
  );
}

export function PrimaryButton({ label }: { label: string }) {
  return (
    <View style={styles.primaryButton}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.pill, selected && styles.pillSelected]}>
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function SignalRow({
  label,
  detail,
  compact,
}: {
  label: string;
  detail?: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.signalRow, compact && styles.signalRowCompact]}>
      <View style={styles.signalIcon}>
        <View style={styles.signalIconDot} />
      </View>
      <View style={styles.signalCopy}>
        <SubstrateText variant="small">{label}</SubstrateText>
        {detail ? (
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {detail}
          </SubstrateText>
        ) : null}
      </View>
    </View>
  );
}

export function BrandMark({ size = 104 }: { size?: number }) {
  const ringSize = size;
  return (
    <View style={[styles.brandMark, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}>
      <View style={styles.brandArcTop} />
      <View style={styles.brandArcSide} />
      <View style={styles.brandSpokeVertical} />
      <View style={styles.brandSpokeHorizontal} />
      <View style={[styles.brandCenter, { left: ringSize / 2 - 4, top: ringSize / 2 - 4 }]} />
    </View>
  );
}

export function FaceGuide() {
  return (
    <View style={styles.faceFrame}>
      <Image
        source={require('@/assets/images/photo-placeholder-woman.png')}
        style={styles.faceImage}
        contentFit="contain"
      />
    </View>
  );
}

export function MetricRing({ value, label }: { value: string; label: string }) {
  const labelLines = label.split(' ');

  return (
    <View style={styles.metricRing}>
      <View style={styles.metricInner}>
        <SubstrateText variant="subtitle" color={Colors.light.accent}>
          {value}
        </SubstrateText>
        <View style={styles.metricLabel}>
          {labelLines.map((line) => (
            <SubstrateText key={line} variant="metricLabel" color={Colors.light.textMuted}>
              {line}
            </SubstrateText>
          ))}
        </View>
      </View>
    </View>
  );
}

export function StepProgress({
  currentStep,
  totalSteps,
  currentLabel,
  nextLabel,
}: {
  currentStep: number;
  totalSteps: number;
  currentLabel: string;
  nextLabel?: string;
}) {
  const progress = Math.max(0, Math.min(1, currentStep / totalSteps));

  return (
    <View style={styles.stepProgress}>
      <View style={styles.stepProgressHeader}>
        <SubstrateText variant="small" color={Colors.light.accentDeep}>
          Step {currentStep} of {totalSteps}
        </SubstrateText>
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          {currentLabel}
        </SubstrateText>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      {nextLabel ? (
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          {nextLabel}
        </SubstrateText>
      ) : null}
    </View>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const activeItem = getActiveNavItem(pathname);
  const { theme: t } = useReportTheme();

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.navWrap, { backgroundColor: t.paper }]}>
      <View accessibilityRole="tablist" style={[styles.navBar, { backgroundColor: t.surface, borderColor: t.line }]}>
        {navItems.map((item) => {
          const isActive = activeItem === item.key;
          const Icon = item.icon;

          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: isActive }}
              onPress={() => { if (pathname !== item.href) router.navigate(item.href); }}
              style={({ pressed }) => [styles.navItem, { backgroundColor: isActive ? t.ink : "transparent", opacity: pressed ? 0.7 : 1 }]}>
              <Icon
                size={19}
                strokeWidth={2.2}
                color={isActive ? t.paper : t.muted}
              />
              <Text style={[styles.navLabel, { color: isActive ? t.paper : t.muted, fontWeight: isActive ? "600" : "400" }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const navItems = [
  { key: 'home', label: 'Home', href: '/home' as Href, icon: House },
  { key: 'new', label: 'New Report', href: '/assessment' as Href, icon: FilePlus2 },
  { key: 'past', label: 'Reports', href: '/past-reports' as Href, icon: Files },
  { key: 'wardrobe', label: 'Wardrobe', href: '/skin-wardrobe' as Href, icon: ShoppingBag },
  { key: 'tate', label: 'Tate', href: '/ask-tate' as Href, icon: MessageCircle },
] as const;

function getActiveNavItem(pathname: string) {
  if (pathname === '/ask-tate') return 'tate';
  if (pathname === '/assessment') return 'new';
  if (pathname === '/past-reports' || pathname === '/report') return 'past';
  if (pathname === '/skin-wardrobe' || pathname.startsWith('/skin-wardrobe/')) return 'wardrobe';
  if (pathname === '/home') return 'home';
  return undefined;
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    backgroundColor: Colors.light.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: Spacing.two,
    paddingBottom: 92,
  },
  header: {
    gap: Spacing.one,
  },
  backButton: {
    alignSelf: 'flex-start',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -6,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
  card: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: Colors.light.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.light.border,
    boxShadow: '0 12px 24px rgba(45, 23, 35, 0.06)',
  },
  pill: {
    minHeight: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FBF8F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pillSelected: {
    backgroundColor: Colors.light.accent,
    borderColor: Colors.light.accent,
  },
  pillText: {
    color: Colors.light.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '400',
  },
  pillTextSelected: {
    color: '#FFFFFF',
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  signalRowCompact: {
    minHeight: 26,
  },
  signalIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.light.plumSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalIconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.accent,
  },
  signalCopy: {
    flex: 1,
  },
  brandMark: {
    borderWidth: 1,
    borderColor: Colors.light.text,
    overflow: 'hidden',
  },
  brandArcTop: {
    position: 'absolute',
    left: '20%',
    right: '20%',
    top: '16%',
    height: '52%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.light.text,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 80,
  },
  brandArcSide: {
    position: 'absolute',
    left: '34%',
    right: '34%',
    top: '8%',
    bottom: '8%',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.light.text,
  },
  brandSpokeVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: Colors.light.text,
  },
  brandSpokeHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: Colors.light.text,
  },
  brandCenter: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.accent,
  },
  faceFrame: {
    minHeight: 188,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  faceImage: {
    width: '100%',
    height: 224,
    opacity: 1,
  },
  metricRing: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 11,
    borderColor: Colors.light.accentSoft,
    borderRightColor: Colors.light.accent,
    borderBottomColor: '#F4D9AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricInner: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: '#FFFDFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
  },
  metricLabel: {
    alignItems: 'center',
  },
  stepProgress: {
    gap: Spacing.one,
  },
  stepProgressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.light.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.light.accent,
  },
  navWrap: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: Spacing.two,
    paddingTop: Spacing.one,
    backgroundColor: Colors.light.background,
  },
  navBar: {
    width: '100%',
    maxWidth: MaxContentWidth - 28,
    minHeight: 62,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    boxShadow: '0 10px 28px rgba(45, 23, 35, 0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 6,
  },
  navItem: {
    flex: 1,
    minHeight: 54,
    minWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  navLabel: {
    color: Colors.light.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
    fontWeight: '400',
  },
});

const stylesText = StyleSheet.create({
  brand: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '400',
    letterSpacing: 6,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '400',
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 34,
    lineHeight: 37,
    fontWeight: '400',
  },
  body: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  small: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  section: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
  tag: {
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    color: Colors.light.accentDeep,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metricLabel: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
});
