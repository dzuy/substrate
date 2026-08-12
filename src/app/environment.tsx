import * as Location from 'expo-location';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { CloudSun, Droplets, Sun, Thermometer, Wind } from 'lucide-react-native';
import { type ComponentType, useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  AppShell,
  BackLink,
  Card,
  PrimaryButton,
  ScreenHeader,
  StepProgress,
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
import { getCachedProfileLocation, getProfile, saveResolvedProfileLocation, toProfileLocation } from '@/services/profile';
import type { EnvironmentSnapshot } from '@/types/database';

export default function EnvironmentScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [entryId, setEntryId] = useState<string | null>(null);
  const [manualLocation, setManualLocation] = useState('');
  const [snapshot, setSnapshot] = useState<EnvironmentSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
  const [hasProfileLocation, setHasProfileLocation] = useState(false);
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
        setSnapshot(null);

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

        const profile = await getProfile(user.id);

        if (!isMounted) {
          return;
        }

        const cachedLocation = await getCachedProfileLocation(user.id);

        if (!isMounted) {
          return;
        }

        if (profile.error && !cachedLocation) {
          setErrorMessage(profile.error.message);
          setIsLoading(false);
          return;
        }

        const profileLocation = toProfileLocation(profile.data) ?? cachedLocation;
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
          setIsLoading(false);
          return;
        }

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
          setIsLoading(false);
          return;
        }

        setSnapshot(null);
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

    const coordinates = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      label: 'Current location',
    };

    const didSaveSnapshot = await saveSnapshot(coordinates);

    if (!didSaveSnapshot) {
      return;
    }

    await saveResolvedProfileLocation(user.id, {
      query: 'Current location',
      ...coordinates,
    });

    setHasProfileLocation(true);
  }

  async function useManualLocation() {
    if (!manualLocation.trim()) {
      setErrorMessage('Enter a city or ZIP code first.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    const geocoded = await geocodeLocation(manualLocation);

    if (geocoded.error || !geocoded.data) {
      setIsSaving(false);
      setErrorMessage(geocoded.error?.message ?? 'Location lookup failed.');
      return;
    }

    const didSave = await saveSnapshot(geocoded.data);

    if (!didSave || !user) {
      return;
    }

    await saveResolvedProfileLocation(user.id, {
      query: manualLocation,
      label: geocoded.data.label,
      latitude: geocoded.data.latitude,
      longitude: geocoded.data.longitude,
    });

    setHasProfileLocation(true);
    setIsLocationModalVisible(false);
  }

  async function saveSnapshot(coordinates: { latitude: number; longitude: number; label?: string }) {
    if (!user || !entryId) {
      setIsSaving(false);
      setErrorMessage('Daily entry is not ready yet. Try again in a moment.');
      return false;
    }

    const saved = await captureEnvironmentSnapshot(user.id, entryId, coordinates);
    setIsSaving(false);

    if (saved.error || !saved.data) {
      setErrorMessage(saved.error?.message ?? 'Environment lookup failed.');
      return false;
    }

    setSnapshot(toEnvironmentSnapshot(saved.data) ?? null);
    return true;
  }

  function continueToStory() {
    router.push('/skin-story');
  }

  function openLocationModal() {
    setManualLocation(snapshot?.locationLabel ?? '');
    setErrorMessage('');
    setIsLocationModalVisible(true);
  }

  return (
    <AppShell>
      <BackLink href={'/check-in' as Href} />
      <StepProgress currentStep={3} totalSteps={5} currentLabel="Environment" nextLabel="Skin Story" />
      <ScreenHeader
        title="Today’s environment"
        body={
          hasProfileLocation
            ? 'UV, humidity, and air quality can affect irritation, dryness, and how your skin responds today.'
            : snapshot
              ? 'UV, humidity, and air quality can affect irritation, dryness, and how your skin responds today.'
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
            <View style={styles.locationRow}>
              <TextInput
                autoCapitalize="words"
                autoCorrect={false}
                inputMode="search"
                onChangeText={setManualLocation}
                placeholder="Enter city or ZIP"
                placeholderTextColor={Colors.light.textMuted}
                style={styles.input}
                value={manualLocation}
              />
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={useManualLocation}
                style={[styles.saveLocationButton, isSaving && styles.disabled]}>
                <SubstrateText variant="small" color="#FFFFFF">
                  Save Location
                </SubstrateText>
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" disabled={isSaving} onPress={continueToStory} style={styles.skipButton}>
              <SubstrateText variant="small" color={Colors.light.textMuted}>
                Skip for now
              </SubstrateText>
            </Pressable>
          </View>
        </Card>
      ) : null}

      {snapshot ? (
        <Card style={styles.snapshotCard}>
          <View style={styles.snapshotHeader}>
            <View style={styles.snapshotTitle}>
              <SubstrateText variant="section">Saved environment</SubstrateText>
              {snapshot.locationLabel ? (
                <SubstrateText variant="small" color={Colors.light.textMuted}>
                  {snapshot.locationLabel}
                </SubstrateText>
              ) : null}
            </View>
            <Pressable
              accessibilityLabel="Edit environment location"
              accessibilityRole="button"
              onPress={openLocationModal}
              style={styles.weatherBadge}>
              <CloudSun color={Colors.light.accent} size={22} strokeWidth={2.4} />
            </Pressable>
          </View>
          <View style={styles.metricGrid}>
            <EnvironmentMetric
              detail={describeUv(snapshot.uvIndex)}
              fill={normalize(snapshot.uvIndex, 11)}
              icon={Sun}
              label="UV index"
              tone={getUvTone(snapshot.uvIndex)}
              value={formatValue(snapshot.uvIndex)}
            />
            <EnvironmentMetric
              detail={describeHumidity(snapshot.humidity)}
              fill={normalize(snapshot.humidity, 100)}
              icon={Droplets}
              label="Humidity"
              tone={getHumidityTone(snapshot.humidity)}
              value={formatPercent(snapshot.humidity)}
            />
            <EnvironmentMetric
              detail={describeAqi(snapshot.usAqi)}
              fill={normalize(snapshot.usAqi, 160)}
              icon={Wind}
              label="Air quality"
              tone={getAqiTone(snapshot.usAqi)}
              value={formatAqiValue(snapshot.usAqi)}
            />
            <EnvironmentMetric
              detail={describeTemperature(snapshot.temperatureF)}
              fill={normalizeTemperature(snapshot.temperatureF)}
              icon={Thermometer}
              label="Temperature"
              tone={getTemperatureTone(snapshot.temperatureF)}
              value={formatTemperature(snapshot.temperatureF)}
            />
          </View>
        </Card>
      ) : null}

      {errorMessage ? (
        <View style={styles.summary}>
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            {errorMessage}
          </SubstrateText>
        </View>
      ) : null}

      {snapshot ? (
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={isSaving} onPress={continueToStory}>
            <PrimaryButton label="Continue to Skin Story" />
          </Pressable>
        </View>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setIsLocationModalVisible(false)}
        transparent
        visible={isLocationModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.locationModal}>
            <View style={styles.modalHeader}>
              <SubstrateText variant="section">Update location</SubstrateText>
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => setIsLocationModalVisible(false)}
                style={styles.modalClose}>
                <SubstrateText variant="small" color={Colors.light.textMuted}>
                  Cancel
                </SubstrateText>
              </Pressable>
            </View>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Enter a new city or ZIP code for this test day.
            </SubstrateText>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              inputMode="search"
              onChangeText={setManualLocation}
              placeholder="Enter city or ZIP"
              placeholderTextColor={Colors.light.textMuted}
              style={styles.input}
              value={manualLocation}
            />
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={useManualLocation}
              style={isSaving && styles.disabled}>
              <PrimaryButton label={isSaving ? 'Saving Location' : 'Save Location'} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </AppShell>
  );
}

type EnvironmentIcon = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
type MetricTone = { color: string; soft: string };

function EnvironmentMetric({
  detail,
  fill,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  fill: number;
  icon: EnvironmentIcon;
  label: string;
  tone: MetricTone;
  value: string;
}) {
  return (
    <View style={[styles.metricCard, { backgroundColor: tone.soft }]}>
      <View style={styles.metricTopRow}>
        <View style={[styles.metricIcon, { backgroundColor: '#FFFFFF' }]}>
          <Icon color={tone.color} size={17} strokeWidth={2.4} />
        </View>
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          {label}
        </SubstrateText>
      </View>
      <SubstrateText variant="section" color={Colors.light.text}>
        {value}
      </SubstrateText>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { backgroundColor: tone.color, width: `${fill}%` }]} />
      </View>
      <SubstrateText variant="small" color={Colors.light.textMuted}>
        {detail}
      </SubstrateText>
    </View>
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

function formatAqiValue(value?: number) {
  return typeof value === 'number' ? `${Math.round(value)}` : 'Not available';
}

function describeUv(value?: number) {
  if (typeof value !== 'number') return 'Waiting for UV data';
  if (value < 3) return 'Low exposure';
  if (value < 6) return 'Moderate exposure';
  if (value < 8) return 'High exposure';
  return 'Very high exposure';
}

function describeHumidity(value?: number) {
  if (typeof value !== 'number') return 'Waiting for humidity';
  if (value < 35) return 'Dry air';
  if (value <= 60) return 'Balanced air';
  return 'Humid air';
}

function describeAqi(value?: number) {
  if (typeof value !== 'number') {
    return 'Waiting for air data';
  }

  if (value <= 50) return 'Good air';
  if (value <= 100) return 'Moderate air';
  if (value <= 150) return 'Sensitive range';
  return 'Elevated particles';
}

function describeTemperature(value?: number) {
  if (typeof value !== 'number') return 'Waiting for temperature';
  if (value < 55) return 'Cool conditions';
  if (value <= 78) return 'Comfortable';
  if (value <= 88) return 'Warm conditions';
  return 'Hot conditions';
}

function getUvTone(value?: number): MetricTone {
  if (typeof value !== 'number') return tones.neutral;
  if (value < 3) return tones.green;
  if (value < 6) return tones.gold;
  return tones.berry;
}

function getHumidityTone(value?: number): MetricTone {
  if (typeof value !== 'number') return tones.neutral;
  if (value < 35) return tones.blue;
  if (value <= 60) return tones.green;
  return tones.plum;
}

function getAqiTone(value?: number): MetricTone {
  if (typeof value !== 'number') return tones.neutral;
  if (value <= 50) return tones.green;
  if (value <= 100) return tones.gold;
  return tones.berry;
}

function getTemperatureTone(value?: number): MetricTone {
  if (typeof value !== 'number') return tones.neutral;
  if (value < 55) return tones.blue;
  if (value <= 78) return tones.green;
  if (value <= 88) return tones.gold;
  return tones.berry;
}

function normalize(value: number | undefined, max: number) {
  if (typeof value !== 'number') return 12;
  return Math.max(8, Math.min(100, (value / max) * 100));
}

function normalizeTemperature(value?: number) {
  if (typeof value !== 'number') return 12;
  return Math.max(8, Math.min(100, ((value - 35) / 70) * 100));
}

const tones = {
  berry: { color: Colors.light.accent, soft: '#F7E6EF' },
  blue: { color: '#3E789B', soft: '#EAF2F6' },
  gold: { color: '#B98222', soft: '#FFF2D8' },
  green: { color: '#3D7D55', soft: Colors.light.successSoft },
  neutral: { color: Colors.light.textMuted, soft: '#F4ECEC' },
  plum: { color: Colors.light.accentDeep, soft: Colors.light.plumSoft },
} satisfies Record<string, MetricTone>;

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
    gap: Spacing.one,
  },
  locationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FBF8F6',
    color: Colors.light.text,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '500',
    paddingHorizontal: Spacing.two,
  },
  saveLocationButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.accent,
    paddingHorizontal: Spacing.three,
  },
  skipButton: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snapshotCard: {
    gap: Spacing.three,
  },
  snapshotHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  snapshotTitle: {
    flex: 1,
    gap: Spacing.half,
  },
  weatherBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.light.backgroundSelected,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 140,
    borderRadius: 16,
    gap: Spacing.two,
    padding: Spacing.two,
  },
  metricTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
  metricIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  meterTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.74)',
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 999,
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
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(38, 24, 32, 0.34)',
    padding: Spacing.three,
  },
  locationModal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundElement,
    gap: Spacing.three,
    padding: Spacing.three,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  modalClose: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
});
