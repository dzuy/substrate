import { useRouter, type Href } from "expo-router";
import { Camera, ScanFace, Sparkles, ShieldCheck } from "lucide-react-native";
import { Image } from "expo-image";
import { View, useWindowDimensions } from "react-native";
import { Copy, Panel, ReportButton, ReportFrame } from "@/report/ui";
import { useReportTheme } from "@/report/theme";

const benefits = [
  {
    icon: ScanFace,
    title: "Understand your skin",
    body: "Connect the visible signs in your photo with your skin history, lifestyle, and goals.",
  },
  {
    icon: Sparkles,
    title: "Find your next step",
    body: "Get personal insights and product guidance that give your routine a clearer direction.",
  },
  {
    icon: Camera,
    title: "Build your skin story",
    body: "Save your report and revisit your insights as you learn what works for you.",
  },
];

export default function ReportHome() {
  const { theme: t } = useReportTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const startReport = () => router.navigate("/assessment" as Href);

  return (
    <ReportFrame wide showStyleGuide={false}>
      <View
        style={{
          flexDirection: compact ? "column" : "row",
          gap: compact ? 28 : 48,
          alignItems: "center",
        }}
      >
        <View
          style={{
            gap: 22,
            flex: compact ? undefined : 1,
            width: compact ? "100%" : undefined,
            paddingVertical: compact ? 12 : 36,
          }}
        >
          <Copy kind="eyebrow" style={{ color: t.gold }}>
            SCIENCE FOR HEALTHIER SKIN
          </Copy>
          <Copy
            kind="title"
            style={{ fontSize: (compact ? 42 : 56) * t.scale }}
          >
            Your skin.{"\n"}A clearer direction.
          </Copy>
          <Copy style={{ color: t.muted, maxWidth: 520 }}>
            Meet your Skin Intelligence Report. Personal insights connecting
            your photo, your life, and the products you use—so you can take your
            next step with clarity.
          </Copy>
          <View style={{ alignSelf: compact ? "stretch" : "flex-start" }}>
            <ReportButton
              label="Get my Skin Intelligence Report"
              onPress={startReport}
            />
          </View>
          <Copy kind="small" style={{ color: t.muted }}>
            A photo. A few questions. A clearer picture of your skin.
          </Copy>
        </View>
        <Image
          source={require("@/assets/images/skin-hero-v1.png")}
          accessibilityLabel="Close-up portrait with natural, clear skin in soft daylight"
          contentFit="cover"
          style={{
            width: compact ? "100%" : "43%",
            aspectRatio: compact ? 1.15 : 0.8,
            borderRadius: t.radius,
            backgroundColor: t.surface,
          }}
        />
      </View>
      <View style={{ gap: 20 }}>
        <Copy kind="heading">Less guesswork. More understanding.</Copy>
        <View style={{ flexDirection: compact ? "column" : "row", gap: 16 }}>
          {benefits.map(({ icon: Icon, title, body }) => (
            <Panel key={title} style={{ flex: compact ? undefined : 1 }}>
              <Icon size={26} color={t.gold} />
              <Copy kind="heading" style={{ fontSize: 23 * t.scale }}>
                {title}
              </Copy>
              <Copy style={{ color: t.muted }}>{body}</Copy>
            </Panel>
          ))}
        </View>
      </View>
      <Panel style={{ gap: 22 }}>
        <Copy kind="eyebrow" style={{ color: t.gold }}>
          YOUR REPORT STARTS HERE
        </Copy>
        <Copy kind="heading">Make sense of what your skin is telling you.</Copy>
        <Copy style={{ color: t.muted }}>
          Share a clear photo, tell us about your skin, and explore your
          personalized report. Your next chapter starts with understanding.
        </Copy>
        <ReportButton label="Start my report" onPress={startReport} />
      </Panel>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <ShieldCheck size={20} color={t.gold} />
        <Copy kind="small" style={{ flex: 1, color: t.muted }}>
          Your report is private to your account. Share a PDF only when you
          choose.
        </Copy>
      </View>
    </ReportFrame>
  );
}
