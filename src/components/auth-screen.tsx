import { useState } from "react";
import * as Linking from "expo-linking";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { isSupabaseConfigured } from "@/lib/env";
import { useAuth } from "@/lib/auth-context";
import {
  sendPasswordResetEmail,
  signInWithEmailPassword,
  signUpWithEmailPassword,
} from "@/services/auth";
import {
  Copy,
  Notice,
  Panel,
  ReportButton,
  ReportFrame,
  Spiral,
} from "@/report/ui";
import { fontFamily, useReportTheme } from "@/report/theme";

type AuthMode = "sign-in" | "sign-up" | "forgot-password";
export function AuthScreen({ admin = false }: { admin?: boolean }) {
  const { user } = useAuth();
  const { theme: t } = useReportTheme();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const signIn = mode === "sign-in",
    forgot = mode === "forgot-password";
  const changeMode = (mode: AuthMode) => {
    setMode(mode);
    setError("");
    setMessage("");
  };
  async function submit() {
    if (busy) return;
    setError("");
    setMessage("");
    if (!email.trim() || (!forgot && password.length < 6)) {
      setError(
        forgot
          ? "Enter your email address."
          : "Enter your email and a password of at least 6 characters.",
      );
      return;
    }
    setBusy(true);
    try {
      if (forgot) {
        const url =
          Platform.OS === "web" && typeof window !== "undefined"
            ? `${window.location.origin}/reset-password`
            : Linking.createURL("reset-password");
        const result = await sendPasswordResetEmail(email.trim(), url);
        if (result.error) throw result.error;
        setMessage("If that email is registered, a reset link is on its way.");
      } else {
        const result = await (
          signIn ? signInWithEmailPassword : signUpWithEmailPassword
        )(email.trim(), password);
        if (result.error) throw result.error;
        if (!signIn && !result.data.session)
          setMessage("Check your email to confirm your account, then sign in.");
        setPassword("");
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to sign in. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const input = {
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 12,
    padding: 16,
    color: t.ink,
    fontFamily: fontFamily(t.bodyFont),
    fontSize: 16,
    backgroundColor: t.surface,
  };
  return (
    <ReportFrame wide>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 40,
            alignItems: "center",
          }}
        >
          <View style={{ flexGrow: 1, flexBasis: 280, gap: 22 }}>
            <Copy kind="eyebrow" style={{ color: t.gold }}>
              SCIENCE FOR HEALTHIER SKIN
            </Copy>
            <Copy kind="title" style={{ fontSize: 56 * t.scale }}>
              Understand your skin.{"\n"}Find your direction.
            </Copy>
            <Copy style={{ color: t.muted, maxWidth: 470 }}>
              Your photo. Your context. A personal skin intelligence report
              connecting what you see to the ingredients and products that
              matter.
            </Copy>
            <Spiral size={190} />
            <Copy kind="small" style={{ color: t.muted }}>
              Preview your report, then unlock the full picture for $79. We’re
              testing the experience—no payment is collected.
            </Copy>
          </View>
          <Panel style={{ flexGrow: 1, flexBasis: 280, gap: 22 }}>
            <Copy kind="eyebrow" style={{ color: t.gold }}>
              {admin ? "ADMINISTRATOR ACCESS" : "YOUR PRIVATE SKIN PROFILE"}
            </Copy>
            <Copy kind="heading">
              {forgot
                ? "Reset your password"
                : signIn
                  ? "Welcome back."
                  : "Start with you."}
            </Copy>
            <Copy kind="small" style={{ color: t.muted }}>
              {forgot
                ? "We’ll email you a secure reset link."
                : signIn
                  ? "Sign in to create or revisit your personal report."
                  : "Create an account to keep your assessment and reports together."}
            </Copy>
            {admin && user ? (
              <Notice>
                Your current account does not have administrator access. Sign in
                with an administrator account.
              </Notice>
            ) : null}
            <View style={{ gap: 8 }}>
              <Copy kind="small">Email</Copy>
              <TextInput
                accessibilityLabel="Email"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={t.muted}
                style={input}
              />
            </View>
            {!forgot ? (
              <View style={{ gap: 8 }}>
                <Copy kind="small">Password</Copy>
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete={signIn ? "current-password" : "new-password"}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={t.muted}
                  onSubmitEditing={() => void submit()}
                  style={input}
                />
              </View>
            ) : null}
            {error ? <Notice>{error}</Notice> : null}
            {message ? <Notice>{message}</Notice> : null}
            {!isSupabaseConfigured ? (
              <Notice>
                Account services are not configured for this deployment.
              </Notice>
            ) : null}
            <ReportButton
              label={
                forgot
                  ? "Send reset link"
                  : signIn
                    ? "Sign in"
                    : "Create my account"
              }
              busy={busy}
              disabled={!isSupabaseConfigured}
              onPress={() => void submit()}
            />
            {signIn ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => changeMode("forgot-password")}
              >
                <Copy
                  kind="small"
                  style={{ color: t.muted, textAlign: "center" }}
                >
                  Forgot password?
                </Copy>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => changeMode(signIn ? "sign-up" : "sign-in")}
            >
              <Copy kind="small" style={{ textAlign: "center" }}>
                {signIn
                  ? "New to Substrate? Create an account"
                  : "Already have an account? Sign in"}
              </Copy>
            </Pressable>
          </Panel>
        </View>
      </KeyboardAvoidingView>
    </ReportFrame>
  );
}
