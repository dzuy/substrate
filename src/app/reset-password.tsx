import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { AuthScreen } from '@/components/auth-screen';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { updatePassword } from '@/services/auth';
import { Copy, Notice, Panel, ReportButton, ReportFrame } from '@/report/ui';
import { fontFamily, useReportTheme } from '@/report/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { session, isLoading } = useAuth();
  const { theme: t } = useReportTheme();
  const url = Linking.useURL();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [linkError, setLinkError] = useState(false);
  const [checkingLink, setCheckingLink] = useState(Platform.OS !== 'web');
  const submitting = useRef(false);

  useEffect(() => {
    if (!url) {
      setCheckingLink(false);
      return;
    }
    setLinkError(false);
    const parsed = new URL(url);
    const params = new URLSearchParams(`${parsed.search.slice(1)}&${parsed.hash.slice(1)}`);
    if (params.has('error') || params.has('error_code')) {
      setLinkError(true);
      setCheckingLink(false);
      return;
    }
    // The web client consumes recovery tokens automatically. Native clients do not.
    if (Platform.OS === 'web') return;
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token || params.get('type') !== 'recovery') {
      setCheckingLink(false);
      return;
    }
    let active = true;
    setCheckingLink(true);
    void supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (active) setLinkError(!!error);
    }).catch(() => {
      if (active) setLinkError(true);
    }).finally(() => {
      if (active) setCheckingLink(false);
    });
    return () => { active = false; };
  }, [url]);

  async function submit() {
    if (submitting.current || !session || linkError || done) return;
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const result = await updatePassword(password);
      if (result.error) throw result.error;
      setPassword('');
      setConfirmation('');
      setDone(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update your password. Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const inputStyle = { borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 16, color: t.ink, backgroundColor: t.surface, fontFamily: fontFamily(t.bodyFont), fontSize: 16 };
  return <ReportFrame>
    <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
      {isLoading || checkingLink ? <ActivityIndicator accessibilityLabel="Checking reset link" color={t.ink} /> :
        linkError || !session ? <View style={{ gap: 16 }}>
          <Notice>This password reset link is missing, expired, or invalid. Request a new link below.</Notice>
          <AuthScreen embedded initialMode="forgot-password" />
        </View> :
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Panel style={{ gap: 22 }}>
            <Copy kind="heading">{done ? 'Password updated' : 'Set a new password'}</Copy>
            {done ? <>
              <Copy>Your password has been updated. You can now continue to your account.</Copy>
              <ReportButton label="Continue to Substrate" onPress={() => router.replace('/home')} />
            </> : <>
              <Copy kind="small">Choose a new password for your Substrate account.</Copy>
              <Copy kind="small">New password</Copy>
              <TextInput accessibilityLabel="New password" autoCapitalize="none" autoComplete="new-password" secureTextEntry editable={!busy} value={password} onChangeText={setPassword} placeholder="At least 6 characters" placeholderTextColor={t.muted} style={inputStyle} />
              <Copy kind="small">Confirm password</Copy>
              <TextInput accessibilityLabel="Confirm password" autoCapitalize="none" autoComplete="new-password" secureTextEntry editable={!busy} value={confirmation} onChangeText={setConfirmation} onSubmitEditing={() => void submit()} placeholder="Repeat your new password" placeholderTextColor={t.muted} style={inputStyle} />
              {error ? <Notice>{error}</Notice> : null}
              <ReportButton label="Update password" busy={busy} onPress={() => void submit()} />
            </>}
          </Panel>
        </KeyboardAvoidingView>}
    </View>
  </ReportFrame>;
}
