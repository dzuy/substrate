import { GoldButtonSurface } from "@/components/gold-button-surface";
import { Link, usePathname, type Href } from "expo-router";
import { ArrowRight, Layers3 } from "lucide-react-native";
import { createContext, useContext, type PropsWithChildren } from "react";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useAuth } from "@/lib/auth-context";
import { fontFamily, useReportTheme } from "./theme";

const DarkSurface = createContext(false);
const CompactLayout = createContext(false);

export function NautilusArt({size = 220}: {size?: number}) {
  return <Image source={require("@/assets/images/nautilus-daily-v3.png")} accessible={false} style={{width:size,height:size,maxWidth:"100%",alignSelf:"center",borderRadius:24}} contentFit="contain"/>;
}

export function Copy({
  children,
  kind = "body",
  style,
}: PropsWithChildren<{
  kind?: "body" | "small" | "eyebrow" | "title" | "heading" | "brand";
  style?: TextStyle;
}>) {
  const { theme: t } = useReportTheme();
  const dark = useContext(DarkSurface);
  const compact = useContext(CompactLayout);
  const size = {
    body: compact ? 14 : 16,
    small: compact ? 12 : 13,
    eyebrow: 10,
    title: compact ? 29 : 36,
    heading: compact ? 21 : 27,
    brand: 34,
  }[kind];
  return (
    <Text
      accessibilityRole={kind === "title" || kind === "heading" ? "header" : undefined}
      aria-level={kind === "title" ? 1 : kind === "heading" ? 2 : undefined}
      style={{
        color: dark ? t.paper : t.ink,
        fontFamily: fontFamily(
          ["title", "heading", "brand"].includes(kind)
            ? t.headingFont
            : t.bodyFont,
        ),
        fontSize: size * t.scale,
        lineHeight:
          size *
          t.scale *
          (["title", "heading", "brand"].includes(kind) ? 1.12 : 1.55),
        ...(["eyebrow"].includes(kind)
          ? { letterSpacing: 2, fontWeight: "600" }
          : {}),
        ...style,
      }}
    >
      {children}
    </Text>
  );
}
export function ReportButton({
  label,
  accessibilityLabel,
  onPress,
  secondary = false,
  copper = false,
  destructive = false,
  disabled = false,
  busy = false,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  secondary?: boolean;
  copper?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  const { theme: t } = useReportTheme();
  const dark = useContext(DarkSurface);
  const compact = useContext(CompactLayout);
  const foreground = destructive ? "#FFFFFF" : copper ? t.ink : secondary ? (dark ? t.paper : t.ink) : t.paper;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: compact ? 44 : 52,
        borderRadius: 28,
        paddingHorizontal: compact ? 16 : 22,
        paddingVertical: compact ? 10 : 14,
        backgroundColor: destructive
          ? "#B42318"
          : secondary
            ? "transparent"
            : copper ? "#F2C18D" : t.ink,
        borderWidth: 1,
        borderColor: destructive ? "#B42318" : copper ? "#F2C18D" : secondary ? (dark ? "#49616F" : t.line) : t.ink,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      })}
    >
      {copper && !secondary && !destructive ? <GoldButtonSurface /> : null}
      {busy ? (
        <ActivityIndicator
          color={foreground}
        />
      ) : null}
      <Copy
        style={{
          color: foreground,
          fontSize: 14,
          fontWeight: "600",
          flexShrink: 1,
          textAlign: "center",
        }}
      >
        {label}
      </Copy>
      {!secondary && !destructive && !busy ? (
        <View><ArrowRight size={17} color={foreground} /></View>
      ) : null}
    </Pressable>
  );
}
export function Panel({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  const { theme: t } = useReportTheme();
  const compact = useContext(CompactLayout);
  return (
    <DarkSurface.Provider value={false}><View
      style={{
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.line,
        borderRadius: compact ? 16 : t.radius,
        padding: compact ? 14 : 20,
        gap: compact ? 10 : 16,
        ...style,
      }}
    >
      {children}
    </View></DarkSurface.Provider>
  );
}
export function ReportFrame({
  children,
  wide = false,
  compact = false,
  dark = false,
  footer = true,
  showStyleGuide = true,
  fixed = false,
}: PropsWithChildren<{
  wide?: boolean;
  compact?: boolean;
  dark?: boolean;
  footer?: boolean;
  showStyleGuide?: boolean;
  fixed?: boolean;
}>) {
  const { theme: t } = useReportTheme();
  const { session } = useAuth();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const narrow = width < 400;
  const localHeader = !session || pathname === "/style-guide";
  return (
    <CompactLayout.Provider value={compact}><DarkSurface.Provider value={dark}><ScrollView
      scrollEnabled={!fixed}
      alwaysBounceVertical={false}
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag"
      style={{ flex: 1, minHeight: 0, minWidth: 0, backgroundColor: dark ? t.ink : t.paper }}
      contentContainerStyle={{
        ...(fixed ? { flex: 1, minHeight: 0 } : {}),
        paddingHorizontal: compact || narrow ? 12 : 18,
        paddingTop: compact ? 12 : 28,
        paddingBottom: fixed ? 12 : compact ? 24 : 48,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          width: "100%",
          minWidth: 0,
          ...(fixed ? { flex: 1, minHeight: 0 } : {}),
          maxWidth: wide ? 960 : compact ? 520 : 640,
          alignSelf: "center",
          gap: compact ? 12 : 20,
        }}
      >
        {localHeader ? (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              borderBottomWidth: 1,
              borderColor: t.line,
              paddingBottom: 22,
            }}
          >
            <Link
              href={"/" as Href}
              accessibilityLabel="Substrate home"
              onPress={(event) => {
                if (!session && Platform.OS === "web") {
                  event.preventDefault();
                  window.location.assign("/");
                }
              }}
            >
              <Copy kind="brand">
                Substrate<Copy kind="small">™</Copy>
              </Copy>
            </Link>
            {showStyleGuide ? (
              <Link
                href={"/style-guide" as Href}
                accessibilityLabel="Design system"
                onPress={(event) => {
                  if (!session && Platform.OS === "web") {
                    event.preventDefault();
                    window.location.assign("/style-guide");
                  }
                }}
              >
                <Layers3 size={21} color={t.muted} />
              </Link>
            ) : null}
          </View>
        ) : null}
        {children}
        {footer ? (
          <View
            style={{
              paddingTop: 26,
              borderTopWidth: 1,
              borderColor: t.line,
              gap: 8,
            }}
          >
            <Copy
              kind="eyebrow"
              style={{ textAlign: "center", color: dark ? "#BECAD1" : t.muted }}
            >
              REAL BIOLOGY · SMARTER CHOICES · HEALTHIER SKIN
            </Copy>
            <Copy kind="small" style={{ textAlign: "center", color: dark ? "#BECAD1" : t.muted }}>
              Understand today. Shape tomorrow.
            </Copy>
          </View>
        ) : null}
      </View>
    </ScrollView></DarkSurface.Provider></CompactLayout.Provider>
  );
}
export function Spiral({ size = 210 }: { size?: number }) {
  const { theme: t } = useReportTheme();
  const paths = Array.from({ length: 13 }, (_, i) => {
    const points = Array.from({ length: 85 }, (_, j) => {
      const angle = (j / 84) * Math.PI * 4.6 + i * 0.052;
      const r = 4 * Math.exp(angle * 0.235);
      return `${j ? "L" : "M"}${150 + Math.cos(angle) * r} ${150 + Math.sin(angle) * r}`;
    });
    return points.join(" ");
  });
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 300 300"
      accessibilityElementsHidden
    >
      <Circle
        cx="150"
        cy="150"
        r="136"
        fill="none"
        stroke={t.gold}
        strokeOpacity={0.15}
      />
      {paths.map((d, i) => (
        <Path
          key={i}
          d={d}
          fill="none"
          stroke={t.gold}
          strokeWidth={0.7}
          opacity={0.25 + i / 18}
        />
      ))}
    </Svg>
  );
}
export function Notice({ children }: PropsWithChildren) {
  const { theme: t } = useReportTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        padding: 16,
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.gold,
        borderRadius: 12,
      }}
    >
      <Copy kind="small" style={{color:t.ink}}>{children}</Copy>
    </View>
  );
}


/** Responsive evidence cards; content remains the saved analysis, never mockup metrics. */
export function SummaryGrid({cards}: {cards: {title:string;body:string;source:string}[]}) {
  const {theme:t}=useReportTheme();
  return <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{cards.map(c=><Panel key={c.title} style={{flexGrow:1,flexBasis:230,minWidth:0,padding:18,gap:12}}><Copy kind="eyebrow" style={{letterSpacing:1.2}}>{c.title}</Copy><View style={{width:30,height:2,backgroundColor:t.gold}}/><Copy style={{fontSize:14,lineHeight:21}}>{c.body}</Copy><Copy kind="small" style={{color:t.muted,fontSize:11}}>Source: {c.source}</Copy></Panel>)}</View>;
}
