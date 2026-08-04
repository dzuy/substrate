import * as Location from 'expo-location';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  AppShell,
  BackLink,
  Card,
  PrimaryButton,
  ScreenHeader,
  SignalRow,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { getActiveEntryDate, getOrCreateDailyEntry } from '@/services/daily-entries';
import {
  captureEnvironmentSnapshot,
  geocodeLocation,
  getEnvironmentSnapshot,
  toEnvironmentSnapshot,
} from '@/services/environment';
import { getProfile, toProfileLocation } from '@/services/profile';
import type { EnvironmentSnapshot } from '@/types/database';

export default function EnvironmentScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [entryId, setEntryId] = useState<string | null>(null);
  const [manualLocation, setManualLocation] = useState('');
  const [snapshot, setSnapshot] = useState<EnvironmentSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasProfileLocation, setHasProfileLocation] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadEnvironment() {
        if (!user) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setErrorMessage('');

        const activeDate = await getActiveEntryDate(user.id);
        const entry = await getOrCreateDailyEntry(user.id, activeDate);

        if (!isMounted) {
          return;
        }

        if (entry.error || !entry.data) {
          setErrorMessage(entry.error?.message ?? "Couldn't load today's entry.");
          setIsLoading(false);
          return;
        }

        setEntryId(entry.data.id);

        const existing = await getEnvironmentSnapshot(user.id, entry.data.id);

        if (!isMounted) {
          return;
        }

        if (existing.error) {
          setErrorMessage(existing.error.message);
          setIsLoading(false);
          return;
        }

        const loadedSnapshot = toEnvironmentSnapshot(existing.data);
        if (loadedSnapshot) {
          setSnapshot(loadedSnapshot);
          setStatusMessage('Loaded saved environment data for this test day.');
          setIsLoading(false);
          return;
        }

        const profile = await getProfile(user.id);

        if (!isMounted) {
          return;
        }

        if (profile.error) {
          setErrorMessage(profile.error.message);
          setIsLoading(false);
          return;
        }

        const profileLocation = toProfileLocation(profile.data);
        setHasProfileLocation(Boolean(profileLocation));

        if (profileLocation) {
          const saved = await captureEnvironmentSnapshot(user.id, entry.data.id, {
            latitude: profileLocation.latitude,
            longitude: profileLocation.longitude,
            label: profileLocation.label ?? profileLocation.query,
          });

          if (!isMounted) {
            return;
          }

          if (saved.error || !saved.data) {
            setErrorMessage(saved.error?.message ?? 'Environment lookup failed.');
            setIsLoading(false);
            return;
          }

          setSnapshot(toEnvironmentSnapshot(saved.data) ?? null);
          setStatusMessage('Used your profile location for today’s environment.');
          setIsLoading(false);
          return;
        }

        setSnapshot(null);
        setStatusMessage('');
        setIsLoading(false);
      }

      loadEnvironment();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  async function useCurrentLocation() {
    if (!user || !entryId) {
      setErrorMessage('Daily entry is not ready yet. Try again in a moment.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setStatusMessage('');

    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== Location.PermissionStatus.GRANTED) {
      setIsSaving(false);
      setErrorMessage('Location permission was not granted. Enter a city or ZIP code instead.');
      return;
    }

    let position: Location.LocationObject;

    try {
      position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    } catch {
      setIsSaving(false);
      setErrorMessage('Current location was unavailable. Enter a city or ZIP code instead.');
      return;
    }

    await saveSnapshot({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      label: 'Current location',
    });
  }

  async function useManualLocation() {
    if (!manualLocation.trim()) {
      setErrorMessage('Enter a city or ZIP code first.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setStatusMessage('');

    const geocoded = await geocodeLocation(manualLocation);

    if (geocoded.error || !geocoded.data) {
      setIsSaving(false);
      setErrorMessage(geocoded.error?.message ?? 'Location lookup failed.');
      return;
    }

    await saveSnapshot(geocoded.data);
  }

  async function saveSnapshot(coordinates: { latitude: number; longitude: number; label?: string }) {
    if (!user || !entryId) {
      setIsSaving(false);
      setErrorMessage('Daily entry is not ready yet. Try again in a moment.');
      return;
    }

    const saved = await captureEnvironmentSnapshot(user.id, entryId, coordinates);
    setIsSaving(false);

    if (saved.error || !saved.data) {
      setErrorMessage(saved.error?.message ?? 'Environment lookup failed.');
      return;
    }

    setSnapshot(toEnvironmentSnapshot(saved.data) ?? null);
    setStatusMessage('Environment data saved to this test day.');
  }

  function continueToStory() {
    router.push('/skin-story');
  }

  return (
    <AppShell>
      <BackLink href={'/check-in' as Href} />
      <ScreenHeader
        eyebrow="Step 3"
        title="Today’s environment"
        body={
          hasProfileLocation
            ? 'Local weather, UV, and air-quality context were added from your saved profile location.'
            : snapshot
              ? 'Local weather, UV, and air-quality context were added to this test day.'
            : 'Add local weather, UV, and air-quality context to make the analysis more specific.'
        }
      />

      {isLoading ? (
        <Card style={styles.card}>
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.light.accent} />
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Loading environment
            </SubstrateText>
          </View>
        </Card>
      ) : null}

      {!isLoading && !snapshot ? (
        <Card style={styles.card}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={useCurrentLocation}
            style={isSaving && styles.disabled}>
            <PrimaryButton label={isSaving ? 'Saving Environment' : 'Use Current Location'} />
          </Pressable>

          <View style={styles.manualBlock}>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Or enter a city or ZIP code
            </SubstrateText>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              inputMode="search"
              onChangeText={setManualLocation}
              placeholder="San Francisco or 94107"
              placeholderTextColor={Colors.light.textMuted}
              style={styles.input}
              value={manualLocation}
            />
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={useManualLocation}
              style={isSaving && styles.disabled}>
              <View style={styles.secondaryButton}>
                <SubstrateText variant="small" color={Colors.light.accentDeep}>
                  Save Manual Location
                </SubstrateText>
              </View>
            </Pressable>
          </View>
        </Card>
      ) : null}

      {snapshot ? (
        <Card style={styles.snapshotCard}>
          <View style={styles.snapshotHeader}>
            <SubstrateText variant="section">Saved environment</SubstrateText>
            {snapshot.locationLabel ? (
              <SubstrateText variant="tag">{snapshot.locationLabel}</SubstrateText>
            ) : null}
          </View>
          <View style={styles.list}>
            <SignalRow label="UV index" detail={formatValue(snapshot.uvIndex)} compact />
            <SignalRow label="Humidity" detail={formatPercent(snapshot.humidity)} compact />
            <SignalRow label="Air quality" detail={formatAqi(snapshot.usAqi)} compact />
            <SignalRow label="Temperature" detail={formatTemperature(snapshot.temperatureF)} compact />
          </View>
        </Card>
      ) : null}

      <View style={styles.summary}>
        {errorMessage ? (
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            {errorMessage}
          </SubstrateText>
        ) : (
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {statusMessage || 'You can skip this during testing, but scored analysis will be less complete.'}
          </SubstrateText>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={isSaving} onPress={continueToStory}>
          <PrimaryButton label={snapshot ? 'Continue to Skin Story' : 'Skip for Now'} />
        </Pressable>
      </View>
    </AppShell>
  );
}

function formatValue(value?: number) {
  return typeof value === 'number' ? value.toFixed(1) : 'Not available';
}

function formatPercent(value?: number) {
  return typeof value === 'number' ? `${Math.round(value)}%` : 'Not available';
}

function formatTemperature(value?: number) {
  return typeof value === 'number' ? `${Math.round(value)}°F` : 'Not available';
}

function formatAqi(value?: number) {
  if (typeof value !== 'number') {
    return 'Not available';
  }

  if (value <= 50) return `${Math.round(value)} · Good`;
  if (value <= 100) return `${Math.round(value)} · Moderate`;
  if (value <= 150) return `${Math.round(value)} · Sensitive`;
  return `${Math.round(value)} · Elevated`;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.three,
  },
  manualBlock: {
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
  secondaryButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundElement,
  },
  snapshotCard: {
    gap: Spacing.two,
  },
  snapshotHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.one,
  },
  summary: {
    paddingHorizontal: Spacing.one,
  },
  actions: {
    marginTop: 'auto',
    paddingTop: Spacing.two,
  },
  disabled: {
    opacity: 0.64,
  },
});
