import { useFocusEffect } from 'expo-router';
import type { ReactNode } from 'react';
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

type MultiSelectProfileKey =
  | 'skinGoals'
  | 'skinHistory'
  | 'medicalHistory'
  | 'reproductiveHormonalStatus'
  | 'typicalDiet'
  | 'supplements'
  | 'proceduresHistory';

type TextInputMode = 'decimal' | 'email' | 'numeric' | 'search' | 'tel' | 'text' | 'url';

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

  function toggleMultiValue(key: MultiSelectProfileKey, value: string) {
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
        title="One-time profile"
        body="Add the background details Substrate should consider when interpreting skin changes, recommendations, and daily plans."
      />

      <Card style={styles.card}>
        <SubstrateText variant="section">Account</SubstrateText>
        <SignalRow label="Email" detail={user?.email ?? 'Signed in'} />
      </Card>

      <ProfileSection title="Basic Information" loading={isLoadingProfile}>
        <ProfileInput
          label="Name"
          value={profileContext.displayName}
          placeholder="What should we call you?"
          onChangeText={(displayName) => updateProfileContext({ displayName })}
        />
        <View style={styles.twoColumn}>
          <View style={styles.columnField}>
            <ProfileInput
              label="Age"
              value={profileContext.age}
              placeholder="36"
              inputMode="numeric"
              onChangeText={(age) => updateProfileContext({ age })}
            />
          </View>
          <View style={styles.columnField}>
            <ProfileInput
              label="Height"
              value={profileContext.height}
              placeholder={'5\'6" or 168 cm'}
              onChangeText={(height) => updateProfileContext({ height })}
            />
          </View>
        </View>
        <ProfileInput
          label="Ethnicity / skin ancestry"
          value={profileContext.skinAncestry}
          placeholder="Add pigment or scarring context"
          onChangeText={(skinAncestry) => updateProfileContext({ skinAncestry })}
        />
        <OptionGroup
          label="Skin type"
          options={skinTypeOptions}
          selected={profileContext.skinType}
          onSelect={(skinType) => updateProfileContext({ skinType })}
        />
        <OptionGroup
          label="Skin sensitivity"
          options={sensitivityOptions}
          selected={profileContext.sensitivityLevel}
          onSelect={(sensitivityLevel) => updateProfileContext({ sensitivityLevel })}
        />
      </ProfileSection>

      <ProfileSection title="Skin Goals">
        <OptionGroup
          label="What do you want to improve?"
          multi
          options={skinGoalOptions}
          selectedValues={profileContext.skinGoals}
          onToggle={(value) => toggleMultiValue('skinGoals', value)}
        />
      </ProfileSection>

      <ProfileSection title="Skin History">
        <OptionGroup
          label="Skin history"
          multi
          options={skinHistoryOptions}
          selectedValues={profileContext.skinHistory}
          onToggle={(value) => toggleMultiValue('skinHistory', value)}
        />
      </ProfileSection>

      <ProfileSection title="Medical History">
        <OptionGroup
          label="Medical history"
          multi
          options={medicalHistoryOptions}
          selectedValues={profileContext.medicalHistory}
          onToggle={(value) => toggleMultiValue('medicalHistory', value)}
        />
      </ProfileSection>

      <ProfileSection title="Hormones">
        <OptionGroup
          label="Regular cycles?"
          options={regularCycleOptions}
          selected={profileContext.regularCycles}
          onSelect={(regularCycles) => updateProfileContext({ regularCycles })}
        />
        <View style={styles.twoColumn}>
          <View style={styles.columnField}>
            <ProfileInput
              label="Average cycle length"
              value={profileContext.averageCycleLength}
              placeholder="28 days"
              inputMode="numeric"
              onChangeText={(averageCycleLength) => updateProfileContext({ averageCycleLength })}
            />
          </View>
          <View style={styles.columnField}>
            <ProfileInput
              label="First day of last period"
              value={profileContext.lastPeriodStart}
              placeholder="YYYY-MM-DD"
              onChangeText={(lastPeriodStart) => updateProfileContext({ lastPeriodStart })}
            />
          </View>
        </View>
        <OptionGroup
          label="Perimenopause?"
          options={yesNoUnknownOptions}
          selected={profileContext.perimenopause}
          onSelect={(perimenopause) => updateProfileContext({ perimenopause })}
        />
        <OptionGroup
          label="Menopause?"
          options={yesNoUnknownOptions}
          selected={profileContext.menopause}
          onSelect={(menopause) => updateProfileContext({ menopause })}
        />
        <OptionGroup
          label="HRT?"
          options={yesNoUnknownOptions}
          selected={profileContext.hrt}
          onSelect={(hrt) => updateProfileContext({ hrt })}
        />
        <OptionGroup
          label="Birth control?"
          options={birthControlOptions}
          selected={profileContext.birthControl}
          onSelect={(birthControl) => updateProfileContext({ birthControl })}
        />
        <OptionGroup
          label="Testosterone?"
          options={yesNoUnknownOptions}
          selected={profileContext.testosterone}
          onSelect={(testosterone) => updateProfileContext({ testosterone })}
        />
        <OptionGroup
          label="GLP-1 medications?"
          options={yesNoUnknownOptions}
          selected={profileContext.glp1Medications}
          onSelect={(glp1Medications) => updateProfileContext({ glp1Medications })}
        />
        <OptionGroup
          label="Reproductive & hormonal status"
          multi
          options={reproductiveStatusOptions}
          selectedValues={profileContext.reproductiveHormonalStatus}
          onToggle={(value) => toggleMultiValue('reproductiveHormonalStatus', value)}
        />
      </ProfileSection>

      <ProfileSection title="Lifestyle">
        <OptionGroup
          label="Smoking"
          options={smokingOptions}
          selected={profileContext.smoking}
          onSelect={(smoking) => updateProfileContext({ smoking })}
        />
        <OptionGroup
          label="Alcohol"
          options={alcoholOptions}
          selected={profileContext.alcohol}
          onSelect={(alcohol) => updateProfileContext({ alcohol })}
        />
        <OptionGroup
          label="Exercise frequency"
          options={exerciseOptions}
          selected={profileContext.exerciseFrequency}
          onSelect={(exerciseFrequency) => updateProfileContext({ exerciseFrequency })}
        />
        <OptionGroup
          label="Sauna"
          options={frequencyOptions}
          selected={profileContext.sauna}
          onSelect={(sauna) => updateProfileContext({ sauna })}
        />
        <OptionGroup
          label="Swimming"
          options={frequencyOptions}
          selected={profileContext.swimming}
          onSelect={(swimming) => updateProfileContext({ swimming })}
        />
        <OptionGroup
          label="Sun exposure"
          options={exposureOptions}
          selected={profileContext.sunExposure}
          onSelect={(sunExposure) => updateProfileContext({ sunExposure })}
        />
        <OptionGroup
          label="SPF use"
          options={spfOptions}
          selected={profileContext.spfUse}
          onSelect={(spfUse) => updateProfileContext({ spfUse })}
        />
      </ProfileSection>

      <ProfileSection title="Nutrition">
        <OptionGroup
          label="Typical diet"
          multi
          options={dietOptions}
          selectedValues={profileContext.typicalDiet}
          onToggle={(value) => toggleMultiValue('typicalDiet', value)}
        />
        <View style={styles.twoColumn}>
          <View style={styles.columnField}>
            <ProfileInput
              label="Average daily protein"
              value={profileContext.dailyProtein}
              placeholder="80 g"
              onChangeText={(dailyProtein) => updateProfileContext({ dailyProtein })}
            />
          </View>
          <View style={styles.columnField}>
            <ProfileInput
              label="Average daily water"
              value={profileContext.dailyWater}
              placeholder="2 L"
              onChangeText={(dailyWater) => updateProfileContext({ dailyWater })}
            />
          </View>
        </View>
        <View style={styles.twoColumn}>
          <View style={styles.columnField}>
            <ProfileInput
              label="Average daily fruit"
              value={profileContext.dailyFruit}
              placeholder="2 servings"
              onChangeText={(dailyFruit) => updateProfileContext({ dailyFruit })}
            />
          </View>
          <View style={styles.columnField}>
            <ProfileInput
              label="Average daily vegetables"
              value={profileContext.dailyVegetables}
              placeholder="4 servings"
              onChangeText={(dailyVegetables) => updateProfileContext({ dailyVegetables })}
            />
          </View>
        </View>
      </ProfileSection>

      <ProfileSection title="Supplements">
        <OptionGroup
          label="Select from library"
          multi
          options={supplementOptions}
          selectedValues={profileContext.supplements}
          onToggle={(value) => toggleMultiValue('supplements', value)}
        />
        <ProfileInput
          label="Other supplements"
          value={profileContext.supplementNote}
          placeholder="Add dose, brand, or anything missing"
          multiline
          onChangeText={(supplementNote) => updateProfileContext({ supplementNote })}
        />
      </ProfileSection>

      <ProfileSection title="Procedures History">
        <OptionGroup
          label="Procedures"
          multi
          options={procedureOptions}
          selectedValues={profileContext.proceduresHistory}
          onToggle={(value) => toggleMultiValue('proceduresHistory', value)}
        />
      </ProfileSection>

      <ProfileSection title="Skincare">
        <ProfileInput
          label="Current products"
          value={profileContext.skincareProducts}
          placeholder="Paste or type product names"
          multiline
          onChangeText={(skincareProducts) => updateProfileContext({ skincareProducts })}
        />
        <ProfileInput
          label="Products to search"
          value={profileContext.skincareSearch}
          placeholder="Add products or search terms"
          multiline
          onChangeText={(skincareSearch) => updateProfileContext({ skincareSearch })}
        />
        <ProfileInput
          label="Anything else?"
          value={profileContext.skinContextNote}
          placeholder="Add anything you want Substrate to consider."
          multiline
          onChangeText={(skinContextNote) => updateProfileContext({ skinContextNote })}
        />
      </ProfileSection>

      <Pressable
        accessibilityRole="button"
        disabled={isLoadingProfile || isSavingContext}
        onPress={handleSaveProfileContext}
        style={(isLoadingProfile || isSavingContext) && styles.disabled}>
        <PrimaryButton label={isSavingContext ? 'Saving Profile' : 'Save Profile'} />
      </Pressable>

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

function ProfileSection({
  children,
  loading,
  title,
}: {
  children: ReactNode;
  loading?: boolean;
  title: string;
}) {
  return (
    <Card style={styles.card}>
      <SubstrateText variant="section">{title}</SubstrateText>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.light.accent} />
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Loading profile
          </SubstrateText>
        </View>
      ) : null}
      {children}
    </Card>
  );
}

function ProfileInput({
  inputMode,
  label,
  multiline,
  onChangeText,
  placeholder,
  value,
}: {
  inputMode?: TextInputMode;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  value?: string;
}) {
  return (
    <View style={styles.field}>
      <SubstrateText variant="small" color={Colors.light.textMuted}>
        {label}
      </SubstrateText>
      <TextInput
        autoCapitalize="sentences"
        autoCorrect
        inputMode={inputMode}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.light.textMuted}
        style={[styles.input, multiline && styles.noteInput]}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value ?? ''}
      />
    </View>
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

const skinTypeOptions = ['Combination', 'Oily', 'Sensitive', 'Dry'];
const sensitivityOptions = ['Low', 'Moderate', 'High', 'Very high'];
const skinGoalOptions = [
  'Wrinkles',
  'Fine lines',
  'Acne',
  'Acne scars',
  'Redness',
  'Rosacea',
  'Pigmentation',
  'Melasma',
  'Texture',
  'Dryness',
  'Oiliness',
  'Large pores',
  'Dark circles',
  'Eyelids',
  'Neck',
  'Firmness',
  'Jawline',
  'Glow',
  'Prevent aging',
];
const skinHistoryOptions = [
  'Acne',
  'Rosacea',
  'Melasma',
  'Eczema',
  'Psoriasis',
  'Seborrheic dermatitis',
  'Perioral dermatitis',
  'HSV (cold sores)',
  'Skin cancer',
  'Keloids',
  'Contact allergies',
];
const medicalHistoryOptions = [
  'Thyroid disease',
  'Diabetes',
  'PCOS',
  'Autoimmune disease',
  'Endometriosis',
  'Migraine',
  'Pregnancy',
  'Breastfeeding',
];
const yesNoUnknownOptions = ['No', 'Yes', 'Not sure'];
const regularCycleOptions = ['Yes', 'No', 'Not tracking'];
const birthControlOptions = ['No', 'Pill', 'IUD', 'Implant', 'Ring / Patch', 'Other'];
const reproductiveStatusOptions = [
  'Pregnant or trying to conceive',
  'Breastfeeding',
  'Perimenopause',
  'Menopause',
  'HRT',
  'Birth control',
  'Testosterone',
  'GLP-1 medications',
];
const smokingOptions = ['No', 'Sometimes', 'Daily'];
const alcoholOptions = ['None', 'Light', 'Moderate', 'High'];
const exerciseOptions = ['Rarely', '1-2x/week', '3-4x/week', '5+x/week'];
const frequencyOptions = ['No', 'Sometimes', 'Often'];
const exposureOptions = ['Low', 'Moderate', 'High'];
const spfOptions = ['Daily', 'Most days', 'Sometimes', 'Rarely'];
const dietOptions = ['Mediterranean', 'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'High protein', 'Gluten free', 'Dairy free'];
const supplementOptions = ['Vitamin D', 'Omega-3', 'Collagen', 'Zinc', 'Probiotic', 'Magnesium', 'Multivitamin', 'Biotin', 'Iron'];
const procedureOptions = ['Botox', 'Filler', 'Lasers', 'Peels', 'Microneedling', 'RF', 'Threads', 'Facelift', 'Blepharoplasty', 'Other'];

const styles = StyleSheet.create({
  card: {
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.one,
  },
  columnField: {
    flexBasis: 220,
    flexGrow: 1,
    flexShrink: 1,
  },
  twoColumn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
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
    flexShrink: 0,
    marginBottom: 2,
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
