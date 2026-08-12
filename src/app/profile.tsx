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
import { getProfile, saveProfileContext, saveProfileLocation, toProfileContext, toProfileLocation } from '@/services/profile';
import type { ProfileContext, ProfileLocation } from '@/types/database';

export default function ProfileScreen() {
  const { signOut, user } = useAuth();
  const [profileContext, setProfileContext] = useState<ProfileContext>({});
  const [locationInput, setLocationInput] = useState('');
  const [location, setLocation] = useState<ProfileLocation | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingContext, setIsSavingContext] = useState(false);
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
        const loadedContext = toProfileContext(profile.data);
        setProfileContext(loadedContext);
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

  async function handleSaveProfileContext() {
    if (!user) {
      return;
    }

    setIsSavingContext(true);
    setErrorMessage('');
    setStatusMessage('');

    const saved = await saveProfileContext(user.id, profileContext);
    setIsSavingContext(false);

    if (saved.error || !saved.data) {
      setErrorMessage(saved.error?.message ?? 'Profile details could not be saved.');
      return;
    }

    setProfileContext(toProfileContext(saved.data));
    setStatusMessage('Profile details saved.');
  }

  function updateProfileContext(next: Partial<ProfileContext>) {
    setProfileContext((current) => ({ ...current, ...next }));
  }

  function toggleMultiValue(key: 'skinGoals' | 'knownTriggers', value: string) {
    setProfileContext((current) => {
      const existing = current[key] ?? [];
      const next = existing.includes(value) ? existing.filter((item) => item !== value) : [...existing, value];
      return { ...current, [key]: next };
    });
  }

  return (
    <AppShell>
      <ScreenHeader
        eyebrow="Profile"
        title="Your skin context"
        body="Add the background details Substrate should consider when interpreting your daily changes."
      />

      <Card style={styles.card}>
        <SubstrateText variant="section">Account</SubstrateText>
        <SignalRow label="Email" detail={user?.email ?? 'Signed in'} />
      </Card>

      <Card style={styles.card}>
        <SubstrateText variant="section">Personal details</SubstrateText>
        {isLoadingProfile ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.light.accent} />
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Loading profile
            </SubstrateText>
          </View>
        ) : null}
        <View style={styles.field}>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Name
          </SubstrateText>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={(displayName) => updateProfileContext({ displayName })}
            placeholder="What should we call you?"
            placeholderTextColor={Colors.light.textMuted}
            style={styles.input}
            value={profileContext.displayName ?? ''}
          />
        </View>
        <OptionGroup
          label="Age range"
          options={ageRangeOptions}
          selected={profileContext.ageRange}
          onSelect={(ageRange) => updateProfileContext({ ageRange })}
        />
      </Card>

      <Card style={styles.card}>
        <SubstrateText variant="section">Skin baseline</SubstrateText>
        <OptionGroup
          label="Skin type"
          options={skinTypeOptions}
          selected={profileContext.skinType}
          onSelect={(skinType) => updateProfileContext({ skinType })}
        />
        <OptionGroup
          label="Sensitivity"
          options={sensitivityOptions}
          selected={profileContext.sensitivityLevel}
          onSelect={(sensitivityLevel) => updateProfileContext({ sensitivityLevel })}
        />
        <OptionGroup
          label="Main goals"
          multi
          options={skinGoalOptions}
          selectedValues={profileContext.skinGoals}
          onToggle={(value) => toggleMultiValue('skinGoals', value)}
        />
        <OptionGroup
          label="Known triggers"
          multi
          options={knownTriggerOptions}
          selectedValues={profileContext.knownTriggers}
          onToggle={(value) => toggleMultiValue('knownTriggers', value)}
        />
        <View style={styles.field}>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Anything else?
          </SubstrateText>
          <TextInput
            autoCapitalize="sentences"
            autoCorrect
            multiline
            onChangeText={(skinContextNote) => updateProfileContext({ skinContextNote })}
            placeholder="Add anything you want Substrate to consider."
            placeholderTextColor={Colors.light.textMuted}
            style={[styles.input, styles.noteInput]}
            textAlignVertical="top"
            value={profileContext.skinContextNote ?? ''}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={isLoadingProfile || isSavingContext}
          onPress={handleSaveProfileContext}
          style={(isLoadingProfile || isSavingContext) && styles.disabled}>
          <PrimaryButton label={isSavingContext ? 'Saving Profile' : 'Save Profile'} />
        </Pressable>
      </Card>

      <Card style={styles.card}>
        <SubstrateText variant="section">Environment location</SubstrateText>
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
          style={[styles.secondaryButton, (isLoadingProfile || isSavingLocation) && styles.disabled]}>
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            {isSavingLocation ? 'Saving Location' : 'Save Location'}
          </SubstrateText>
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

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={signOut} style={styles.signOutLink}>
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            Sign Out
          </SubstrateText>
        </Pressable>
      </View>
    </AppShell>
  );
}

function OptionGroup({
  label,
  multi,
  onSelect,
  onToggle,
  options,
  selected,
  selectedValues,
}: {
  label: string;
  multi?: boolean;
  onSelect?: (value: string) => void;
  onToggle?: (value: string) => void;
  options: string[];
  selected?: string;
  selectedValues?: string[];
}) {
  return (
    <View style={styles.field}>
      <SubstrateText variant="small" color={Colors.light.textMuted}>
        {label}
      </SubstrateText>
      <View style={styles.pillGroup}>
        {options.map((option) => (
          <ProfileOption
            key={option}
            label={option}
            selected={multi ? selectedValues?.includes(option) : selected === option}
            onPress={() => {
              if (multi) {
                onToggle?.(option);
              } else {
                onSelect?.(option);
              }
            }}
          />
        ))}
      </View>
    </View>
  );
}

function ProfileOption({ label, onPress, selected }: { label: string; onPress: () => void; selected?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.profileOption, selected && styles.profileOptionSelected]}>
      <SubstrateText variant="small" color={selected ? Colors.light.accentDeep : Colors.light.textMuted}>
        {label}
      </SubstrateText>
    </Pressable>
  );
}

const ageRangeOptions = ['18-24', '25-34', '35-44', '45-54', '55+'];
const skinTypeOptions = ['Dry', 'Balanced', 'Oily', 'Combination', 'Not sure'];
const sensitivityOptions = ['Low', 'Moderate', 'High'];
const skinGoalOptions = ['Calm redness', 'Hydration', 'Even tone', 'Texture', 'Breakouts', 'Aging support'];
const knownTriggerOptions = ['Strong actives', 'Exfoliation', 'Sun / UV', 'Dry weather', 'Stress', 'Cycle shifts', 'Alcohol', 'New products'];

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  pillGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  profileOption: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FBF8F6',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  profileOptionSelected: {
    borderColor: Colors.light.accentSoft,
    backgroundColor: Colors.light.backgroundSelected,
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
  noteInput: {
    minHeight: 86,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundElement,
  },
  disabled: {
    opacity: 0.64,
  },
  actions: {
    alignItems: 'center',
    paddingTop: Spacing.one,
  },
  signOutLink: {
    minHeight: 36,
    justifyContent: 'center',
  },
});
