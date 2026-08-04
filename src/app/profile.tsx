import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  AppShell,
  Card,
  PrimaryButton,
  ScreenHeader,
  SignalRow,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { getProfile, saveProfileLocation, toProfileLocation } from '@/services/profile';
import type { ProfileLocation } from '@/types/database';

export default function ProfileScreen() {
  const { signOut, user } = useAuth();
  const [locationInput, setLocationInput] = useState('');
  const [location, setLocation] = useState<ProfileLocation | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadProfile() {
        if (!user) {
          setIsLoadingProfile(false);
          return;
        }

        setIsLoadingProfile(true);
        setErrorMessage('');

        const profile = await getProfile(user.id);

        if (!isMounted) {
          return;
        }

        if (profile.error) {
          setErrorMessage(profile.error.message);
          setIsLoadingProfile(false);
          return;
        }

        const loadedLocation = toProfileLocation(profile.data);
        setLocation(loadedLocation);
        setLocationInput(loadedLocation?.query ?? loadedLocation?.label ?? '');
        setIsLoadingProfile(false);
      }

      loadProfile();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  async function handleSaveLocation() {
    if (!user) {
      return;
    }

    if (!locationInput.trim()) {
      setErrorMessage('Enter a city or ZIP code.');
      return;
    }

    setIsSavingLocation(true);
    setErrorMessage('');
    setStatusMessage('');

    const saved = await saveProfileLocation(user.id, locationInput);
    setIsSavingLocation(false);

    if (saved.error || !saved.data) {
      setErrorMessage(saved.error?.message ?? 'Location lookup failed.');
      return;
    }

    const savedLocation = toProfileLocation(saved.data);
    setLocation(savedLocation);
    setLocationInput(savedLocation?.query ?? savedLocation?.label ?? locationInput);
    setStatusMessage('Default environment location saved.');
  }

  return (
    <AppShell>
      <ScreenHeader
        eyebrow="Profile"
        title="Your Substrate account"
        body="Manage the private profile used for this prototype."
      />

      <Card style={styles.card}>
        <SubstrateText variant="section">Account</SubstrateText>
        <SignalRow label="Email" detail={user?.email ?? 'Signed in'} />
        <SignalRow label="Testing mode" detail="Simulated days are stored locally for this device." />
      </Card>

      <Card style={styles.card}>
        <SubstrateText variant="section">Environment location</SubstrateText>
        {isLoadingProfile ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.light.accent} />
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Loading profile
            </SubstrateText>
          </View>
        ) : null}
        {location ? (
          <SignalRow label="Saved location" detail={location.label ?? location.query ?? 'Profile location saved'} />
        ) : (
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Save a city or ZIP code so daily environment data can be added automatically.
          </SubstrateText>
        )}
        <TextInput
          autoCapitalize="words"
          autoCorrect={false}
          inputMode="search"
          onChangeText={setLocationInput}
          placeholder="San Francisco or 94107"
          placeholderTextColor={Colors.light.textMuted}
          style={styles.input}
          value={locationInput}
        />
        <Pressable
          accessibilityRole="button"
          disabled={isLoadingProfile || isSavingLocation}
          onPress={handleSaveLocation}
          style={(isLoadingProfile || isSavingLocation) && styles.disabled}>
          <PrimaryButton label={isSavingLocation ? 'Saving Location' : 'Save Location'} />
        </Pressable>
        {errorMessage ? (
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            {errorMessage}
          </SubstrateText>
        ) : null}
        {statusMessage ? (
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {statusMessage}
          </SubstrateText>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <SubstrateText variant="section">Prototype notes</SubstrateText>
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          Photos, check-ins, analysis, and plans are saved to Supabase for this signed-in user.
        </SubstrateText>
      </Card>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={signOut}>
          <PrimaryButton label="Sign Out" />
        </Pressable>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  loading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  input: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FBF8F6',
    color: Colors.light.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '500',
    paddingHorizontal: Spacing.three,
  },
  disabled: {
    opacity: 0.64,
  },
  actions: {
    marginTop: 'auto',
    paddingTop: Spacing.two,
  },
});
