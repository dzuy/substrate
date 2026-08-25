import { useRouter } from 'expo-router';
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

import { AppShell, Card, PrimaryButton, SubstrateText } from '@/components/substrate-ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { updatePassword } from '@/services/auth';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit() {
    setMessage('');
    setError('');

    if (!password || !confirmPassword) {
      setError('Enter and confirm your new password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setIsSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setMessage('Your password has been updated.');
  }

  return (
    <AppShell contentStyle={styles.content}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <Card style={styles.card}>
          <View style={styles.header}>
            <SubstrateText variant="title">Set a new password</SubstrateText>
            <SubstrateText variant="body" color={Colors.light.textMuted}>
              Choose a new password for your Substrate account.
            </SubstrateText>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <SubstrateText variant="small" color={Colors.light.textMuted}>
                New password
              </SubstrateText>
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={Colors.light.textMuted}
                secureTextEntry
                style={styles.input}
                textContentType="newPassword"
                value={password}
              />
            </View>

            <View style={styles.field}>
              <SubstrateText variant="small" color={Colors.light.textMuted}>
                Confirm password
              </SubstrateText>
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                onChangeText={setConfirmPassword}
                placeholder="Repeat your new password"
                placeholderTextColor={Colors.light.textMuted}
                secureTextEntry
                style={styles.input}
                textContentType="newPassword"
                value={confirmPassword}
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
            <PrimaryButton label="Update Password" />
          </Pressable>

          <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.modeButton}>
            <SubstrateText variant="small" color={Colors.light.accent}>
              Continue to Substrate
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
    fontWeight: '400',
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
