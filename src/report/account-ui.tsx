// Shared design-system primitives for the account and wardrobe screens.
import type { PropsWithChildren } from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { ArrowRight } from "lucide-react-native";
import { Copy, Panel, ReportFrame } from "./ui";
import { useReportTheme } from "./theme";
export function AppShell({ children, footer = true }: PropsWithChildren<{ footer?: boolean }>) {
  return <ReportFrame showStyleGuide={false} footer={footer}>{children}</ReportFrame>;
}
export function SubstrateText({
  children,
  variant = "body",
  color,
  style,
}: PropsWithChildren<{
  variant?:
    | "brand"
    | "title"
    | "subtitle"
    | "body"
    | "small"
    | "section"
    | "tag"
    | "metricLabel";
  color?: string;
  style?: StyleProp<TextStyle>;
}>) {
  const kind =
    variant === "section" || variant === "subtitle" || variant === "title"
      ? "heading"
      : variant === "tag" || variant === "metricLabel"
        ? "small"
        : variant;
  return (
    <Copy
      kind={kind}
      style={{ ...(color ? { color } : {}), ...StyleSheet.flatten(style) }}
    >
      {children}
    </Copy>
  );
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
  const { theme: t } = useReportTheme();
  return (
    <View style={{ gap: 14, paddingTop: 12, paddingBottom: 8 }}>
      {eyebrow ? (
        <Copy kind="eyebrow" style={{ color: t.gold }}>
          {eyebrow.toUpperCase()}
        </Copy>
      ) : null}
      <Copy kind="title">{title}</Copy>
      {body ? (
        <Copy style={{ color: t.muted, maxWidth: 600 }}>{body}</Copy>
      ) : null}
    </View>
  );
}
export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <Panel style={StyleSheet.flatten(style)}>{children}</Panel>;
}
// Existing callers own the Pressable, so this primitive remains non-interactive.
export function PrimaryButton({ label }: { label: string }) {
  const { theme: t } = useReportTheme();
  return (
    <View
      style={{
        minHeight: 52,
        borderRadius: t.radius,
        backgroundColor: t.ink,
        padding: 16,
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Copy style={{ color: t.paper, fontWeight: "600", fontSize: 14 }}>
        {label}
      </Copy>
      <ArrowRight size={17} color={t.paper} />
    </View>
  );
}
export function SignalRow({
  label,
  detail,
}: {
  label: string;
  detail?: string;
}) {
  const { theme: t } = useReportTheme();
  return (
    <View style={{ gap: 4 }}>
      <Copy kind="small" style={{ color: t.muted }}>
        {label}
      </Copy>
      <Copy>{detail}</Copy>
    </View>
  );
}
