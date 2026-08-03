import { Link, type Href } from 'expo-router';
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

import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';

type TextVariant = 'brand' | 'title' | 'subtitle' | 'body' | 'small' | 'section' | 'tag';

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
      <Pressable accessibilityRole="button" style={styles.backButton}>
        <SubstrateText variant="small" color={Colors.light.accentDeep}>
          Back
        </SubstrateText>
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
      <View style={styles.faceAura} />
      <View style={styles.face}>
        <View style={styles.hair} />
        <View style={styles.neck} />
        <View style={styles.head}>
          <View style={styles.eyeRow}>
            <View style={styles.eye} />
            <View style={styles.eye} />
          </View>
          <View style={styles.nose} />
          <View style={styles.mouth} />
        </View>
        <View style={styles.shoulders} />
      </View>
    </View>
  );
}

export function MetricRing({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metricRing}>
      <View style={styles.metricInner}>
        <SubstrateText variant="subtitle" color={Colors.light.accent}>
          {value}
        </SubstrateText>
        <SubstrateText variant="small" color={Colors.light.textMuted} style={styles.metricLabel}>
          {label}
        </SubstrateText>
      </View>
    </View>
  );
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
    paddingBottom: 12,
  },
  header: {
    gap: Spacing.one,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 30,
    justifyContent: 'center',
    paddingRight: Spacing.three,
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    backgroundColor: Colors.light.blush,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  faceAura: {
    position: 'absolute',
    width: 166,
    height: 166,
    borderRadius: 83,
    backgroundColor: '#F1D4C6',
  },
  face: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 150,
    height: 172,
  },
  hair: {
    width: 70,
    height: 54,
    borderTopLeftRadius: 52,
    borderTopRightRadius: 52,
    backgroundColor: '#3E251D',
  },
  neck: {
    position: 'absolute',
    bottom: 34,
    width: 30,
    height: 42,
    backgroundColor: '#DFA37E',
    borderRadius: 18,
    zIndex: 1,
  },
  head: {
    position: 'absolute',
    top: 38,
    width: 72,
    height: 92,
    borderRadius: 32,
    backgroundColor: '#E8B089',
    zIndex: 2,
    alignItems: 'center',
    paddingTop: 35,
  },
  eyeRow: {
    flexDirection: 'row',
    gap: 21,
  },
  eye: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.text,
  },
  nose: {
    marginTop: 10,
    width: 7,
    height: 15,
    borderRadius: 5,
    backgroundColor: '#D89271',
  },
  mouth: {
    marginTop: 10,
    width: 23,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#9C4B55',
  },
  shoulders: {
    position: 'absolute',
    bottom: 0,
    width: 112,
    height: 52,
    borderTopLeftRadius: 72,
    borderTopRightRadius: 72,
    backgroundColor: '#E0A07D',
  },
  metricRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 10,
    borderColor: Colors.light.accentSoft,
    borderRightColor: Colors.light.accent,
    borderBottomColor: '#F4D9AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFDFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
  },
  metricLabel: {
    textAlign: 'center',
  },
});

const stylesText = StyleSheet.create({
  brand: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: 6,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '700',
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 27,
    lineHeight: 31,
    fontWeight: '800',
  },
  body: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  small: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  section: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  tag: {
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    color: Colors.light.accentDeep,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
