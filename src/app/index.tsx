import { useState } from "react";
import { AuthModal } from "@/components/auth-modal";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Copy, Spiral } from "@/report/ui";
import { fontFamily, useReportTheme } from "@/report/theme";

export default function LandingPage() {
  const { theme: t } = useReportTheme();
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const { user } = useAuth();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.paper }}>
      <Head>
        <title>Substrate — Your skin has a story</title>
        <meta name="description" content="Your skin has a story. We’re building a new way to understand it." />
      </Head>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flexGrow: 1, flexShrink: 0, width: "100%", maxWidth: 1440, alignSelf: "center", paddingHorizontal: compact ? 24 : 64 }}>
          <View style={{ paddingVertical: compact ? 24 : 32, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: t.line }}>
            <Copy kind="brand" style={{ fontSize: compact ? 28 : 32 }}>Substrate<Copy kind="small">™</Copy></Copy>
            <Pressable
              accessibilityRole="button"
              onPress={() => user ? router.push("/home") : setAuthOpen(true)}
              style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: t.line, borderRadius: 24, opacity: pressed ? 0.6 : 1 })}
            >
              <Copy kind="small" style={{ fontWeight: "600" }}>{user ? "My account" : "Sign in"}</Copy>
            </Pressable>
          </View>
          <View style={{ flexGrow: 1, flexShrink: 0, alignItems: "center", justifyContent: "center", paddingVertical: compact ? 48 : 60, gap: 26 }}>
            <View accessible={false} importantForAccessibility="no-hide-descendants">
              <Spiral size={compact ? 148 : 190} />
            </View>
            <Text accessibilityRole="header" style={{ fontFamily: fontFamily(t.headingFont), fontSize: (compact ? 32 : 48) * t.scale, lineHeight: (compact ? 39 : 57) * t.scale, letterSpacing: compact ? -0.5 : -1, color: t.ink, textAlign: "center", maxWidth: 900 }}>
              Your skin has a story.{"\n"}We’re building a new way to understand it.
            </Text>
          </View>
          <View style={{ borderTopWidth: 1, borderColor: t.line, paddingVertical: 24, flexDirection: compact ? "column" : "row", justifyContent: "space-between", gap: 10 }}>
            <Copy kind="small" style={{ color: t.muted, fontSize: 11 }}>© {new Date().getFullYear()} Substrate</Copy>
          </View>
        </View>
      </ScrollView>
      <AuthModal visible={authOpen && !user} initialMode="sign-in" onClose={() => setAuthOpen(false)} />
    </SafeAreaView>
  );
}
