import { useRef, useState } from "react";
import * as Linking from "expo-linking";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  useWindowDimensions,
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
export function AuthScreen({ admin = false, embedded = false, initialMode = "sign-in" }: { admin?: boolean; embedded?: boolean; initialMode?: AuthMode }) {
  const { user, completeSignIn } = useAuth();
  const { theme: t } = useReportTheme();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
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
    if (submitting.current) return;
    setError("");
    setMessage("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!forgot && password.length < 6) {
      setError(
        forgot
          ? "Enter your email address."
          : "Enter your email and a password of at least 6 characters.",
      );
      return;
    }
    submitting.current = true;
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
        if (result.data.session) completeSignIn();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to sign in. Try again.",
      );
    } finally {
      submitting.current = false;
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
  const { width } = useWindowDimensions();
  const narrow = width < 480;
  const Frame = embedded ? View : ReportFrame;
  return (
    <Frame {...(!embedded ? { wide: true } : {})}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: narrow ? 20 : 40,
            alignItems: "center",
          }}
        >
          {!embedded ? <View style={{ flexGrow: 1, flexBasis: narrow ? '100%' : 280, gap: 22 }}>
            <Copy kind="eyebrow" style={{ color: t.gold }}>
              SCIENCE FOR HEALTHIER SKIN
            </Copy>
            <Copy kind="title" style={{ fontSize: (narrow ? 36 : 56) * t.scale }}>
              Understand your skin.{"\n"}Find your direction.
            </Copy>
            <Copy style={{ color: t.muted, maxWidth: 470 }}>
              Your photo. Your context. A personal skin intelligence report
              connecting what you see to the ingredients and products that
              matter.
            </Copy>
            {!narrow ? <Spiral size={190} /> : null}
            <Copy kind="small" style={{ color: t.muted }}>
              Explore your personal skin summary and daily routine. The proposed
              $19.99/month subscription is simulated; no payment is collected.
            </Copy>
          </View> : null}
          <Panel style={{ flexGrow: 1, flexBasis: narrow ? '100%' : 280, gap: 22 }}>
            {embedded && !forgot ? <View style={{ flexDirection: 'row', gap: 8 }}>
              {([{ value: 'sign-up', label: 'Create an Account' }, { value: 'sign-in', label: 'Sign In' }] as const).map(option => <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected: mode === option.value }} disabled={busy} onPress={() => changeMode(option.value)} style={{ flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderColor: mode === option.value ? t.gold : t.line }}><Copy kind="small" style={{ textAlign: 'center', fontWeight: '600' }}>{option.label}</Copy></Pressable>)}
            </View> : null}
            {admin ? <Copy kind="eyebrow" style={{ color: t.gold }}>ADMINISTRATOR ACCESS</Copy> : null}
            {forgot || signIn ? <Copy kind="heading">
              {forgot ? "Reset your password" : "Welcome back."}
            </Copy> : null}
            <Copy kind="small" style={{ color: t.muted }}>
              {forgot
                ? "We’ll email you a secure reset link."
                : signIn
                  ? embedded ? "Sign in to continue setting up your Substrate profile." : "Sign in to create or revisit your personal report."
                  : "Create an account to get started."}
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
                disabled={busy}
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
              disabled={busy}
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
    </Frame>
  );
}
