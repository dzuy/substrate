import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppShell, BrandMark, Card, PrimaryButton, SubstrateText } from '@/components/substrate-ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { signInWithEmailPassword, signUpWithEmailPassword } from '@/services/auth';

type AuthMode = 'sign-in' | 'sign-up';

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isSignIn = mode === 'sign-in';

  async function handleSubmit() {
    const trimmedEmail = email.trim();
    setMessage('');
    setError('');

    if (!trimmedEmail || !password) {
      setError('Enter your email and password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);

    const { data, error: authError } = isSignIn
      ? await signInWithEmailPassword(trimmedEmail, password)
      : await signUpWithEmailPassword(trimmedEmail, password);

    setIsSubmitting(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (!isSignIn && !data.session) {
      setMessage('Check your email to confirm your account, then sign in.');
    }
  }

  function toggleMode() {
    setMode(isSignIn ? 'sign-up' : 'sign-in');
    setMessage('');
    setError('');
  }

  return (
    <AppShell contentStyle={styles.content}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <View style={styles.hero}>
          <BrandMark size={86} />
          <View style={styles.brandBlock}>
            <SubstrateText variant="brand">SUBSTRATE</SubstrateText>
            <SubstrateText variant="body" color={Colors.light.textMuted} style={styles.center}>
              Every beautiful outcome begins beneath the surface
            </SubstrateText>
          </View>
        </View>

        <Card style={styles.card}>
          <View style={styles.header}>
            <SubstrateText variant="title">{isSignIn ? 'Welcome back' : 'Create your account'}</SubstrateText>
            <SubstrateText variant="body" color={Colors.light.textMuted}>
              {isSignIn
                ? 'Sign in to continue tracking your skin signals.'
                : 'Start a private profile for your daily photos, check-ins, and plans.'}
            </SubstrateText>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <SubstrateText variant="small" color={Colors.light.textMuted}>
                Email
              </SubstrateText>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                inputMode="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={Colors.light.textMuted}
                style={styles.input}
                textContentType="emailAddress"
                value={email}
              />
            </View>

            <View style={styles.field}>
              <SubstrateText variant="small" color={Colors.light.textMuted}>
                Password
              </SubstrateText>
              <TextInput
                autoCapitalize="none"
                autoComplete={isSignIn ? 'current-password' : 'new-password'}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={Colors.light.textMuted}
                secureTextEntry
                style={styles.input}
                textContentType={isSignIn ? 'password' : 'newPassword'}
                value={password}
              />
            </View>
          </View>

          {error ? (
            <View style={styles.feedbackError}>
              <SubstrateText variant="small" color={Colors.light.accentDeep}>
                {error}
              </SubstrateText>
            </View>
          ) : null}

          {message ? (
            <View style={styles.feedbackSuccess}>
              <SubstrateText variant="small" color={Colors.light.textMuted}>
                {message}
              </SubstrateText>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={isSubmitting && styles.disabled}>
            <PrimaryButton label={isSignIn ? 'Sign In' : 'Create Account'} />
          </Pressable>

          <Pressable accessibilityRole="button" onPress={toggleMode} style={styles.modeButton}>
            <SubstrateText variant="small" color={Colors.light.accent}>
              {isSignIn ? 'Need an account? Create one' : 'Already have an account? Sign in'}
            </SubstrateText>
          </Pressable>

          {isSubmitting ? (
            <View style={styles.loading}>
              <ActivityIndicator color={Colors.light.accent} />
            </View>
          ) : null}
        </Card>
      </KeyboardAvoidingView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    minHeight: '100%',
    paddingBottom: Spacing.four,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  brandBlock: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  center: {
    maxWidth: 260,
    textAlign: 'center',
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
  },
  header: {
    gap: Spacing.one,
  },
  form: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FBF8F6',
    color: Colors.light.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: Spacing.three,
  },
  feedbackError: {
    borderRadius: 12,
    backgroundColor: Colors.light.blush,
    padding: Spacing.two,
  },
  feedbackSuccess: {
    borderRadius: 12,
    backgroundColor: Colors.light.successSoft,
    padding: Spacing.two,
  },
  disabled: {
    opacity: 0.65,
  },
  modeButton: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.three,
  },
});
