import { Link, usePathname, type Href } from "expo-router";
import { ArrowRight, Layers3 } from "lucide-react-native";
import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useAuth } from "@/lib/auth-context";
import { fontFamily, useReportTheme } from "./theme";

export function Copy({
  children,
  kind = "body",
  style,
}: PropsWithChildren<{
  kind?: "body" | "small" | "eyebrow" | "title" | "heading" | "brand";
  style?: TextStyle;
}>) {
  const { theme: t } = useReportTheme();
  const size = {
    body: 16,
    small: 13,
    eyebrow: 10,
    title: 46,
    heading: 27,
    brand: 34,
  }[kind];
  return (
    <Text
      style={{
        color: t.ink,
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
  onPress,
  secondary = false,
  destructive = false,
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  const { theme: t } = useReportTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: Math.min(t.radius, 28),
        paddingHorizontal: 22,
        paddingVertical: 14,
        backgroundColor: destructive
          ? "#B42318"
          : secondary
            ? "transparent"
            : t.ink,
        borderWidth: 1,
        borderColor: destructive ? "#B42318" : secondary ? t.line : t.ink,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      })}
    >
      {busy ? (
        <ActivityIndicator
          color={destructive ? "#FFFFFF" : secondary ? t.ink : t.paper}
        />
      ) : null}
      <Copy
        style={{
          color: destructive ? "#FFFFFF" : secondary ? t.ink : t.paper,
          fontSize: 14,
          fontWeight: "600",
          flexShrink: 1,
          textAlign: "center",
        }}
      >
        {label}
      </Copy>
      {!secondary && !destructive && !busy ? (
        <ArrowRight size={17} color={t.paper} />
      ) : null}
    </Pressable>
  );
}
export function Panel({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  const { theme: t } = useReportTheme();
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.line,
        borderRadius: t.radius,
        padding: 24,
        gap: 16,
        ...style,
      }}
    >
      {children}
    </View>
  );
}
export function ReportFrame({
  children,
  wide = false,
  footer = true,
  showStyleGuide = true,
}: PropsWithChildren<{
  wide?: boolean;
  footer?: boolean;
  showStyleGuide?: boolean;
}>) {
  const { theme: t } = useReportTheme();
  const { session } = useAuth();
  const pathname = usePathname();
  const localHeader = !session || pathname === "/style-guide";
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.paper }}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 48,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          width: "100%",
          maxWidth: wide ? 1080 : 740,
          alignSelf: "center",
          gap: 32,
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
              style={{ textAlign: "center", color: t.muted }}
            >
              REAL BIOLOGY · SMARTER CHOICES · HEALTHIER SKIN
            </Copy>
            <Copy kind="small" style={{ textAlign: "center", color: t.muted }}>
              Understand today. Shape tomorrow.
            </Copy>
          </View>
        ) : null}
      </View>
    </ScrollView>
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
        borderWidth: 1,
        borderColor: t.gold,
        borderRadius: 12,
      }}
    >
      <Copy kind="small">{children}</Copy>
    </View>
  );
}
