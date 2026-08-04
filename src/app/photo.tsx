import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import {
  AppShell,
  BackLink,
  Card,
  PrimaryButton,
  ScreenHeader,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { formatDisplayDate, getActiveEntryDate, getOrCreateDailyEntry } from '@/services/daily-entries';
import { getLatestDailyPhoto, uploadDailyPhoto } from '@/services/photos';

const checklist = [
  'Face the camera directly',
  'Use soft, even lighting',
  'Remove glasses where appropriate',
  'Keep your face centered',
];

export default function PhotoScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [entryId, setEntryId] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [entryDate, setEntryDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadPhotoState() {
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
        setEntryDate(activeDate);

        const photo = await getLatestDailyPhoto(entry.data.id);

        if (!isMounted) {
          return;
        }

        if (photo.error) {
          setErrorMessage(photo.error.message);
          setIsLoading(false);
          return;
        }

        setPhotoUri(photo.data?.signedUrl ?? null);
        setStatusMessage(photo.data ? 'Loaded this test day’s saved photo.' : '');
        setIsLoading(false);
      }

      loadPhotoState();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  async function capturePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      setErrorMessage('Camera permission is required to take your daily photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
      base64: true,
    });

    await handlePickerResult(result);
  }

  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
      base64: true,
    });

    await handlePickerResult(result);
  }

  async function handlePickerResult(result: ImagePicker.ImagePickerResult) {
    if (result.canceled) {
      return;
    }

    if (!entryId || !user) {
      setErrorMessage('Daily entry is not ready yet. Try again in a moment.');
      return;
    }

    const image = result.assets[0];
    setPhotoUri(image.uri);
    setIsUploading(true);
    setErrorMessage('');
    setStatusMessage('Uploading photo to your private entry.');

    const upload = await uploadDailyPhoto({
      userId: user.id,
      dailyEntryId: entryId,
      image,
    });

    setIsUploading(false);

    if (upload.error) {
      setErrorMessage(upload.error.message);
      setStatusMessage('');
      return;
    }

    const savedPhoto = await getLatestDailyPhoto(entryId);

    if (savedPhoto.data?.signedUrl) {
      setPhotoUri(savedPhoto.data.signedUrl);
    }

    setStatusMessage('Photo saved to Supabase.');
  }

  return (
    <AppShell>
      <BackLink href="/" />
      <ScreenHeader
        eyebrow="Step 1"
        title="Take your photo"
        body={`Test day ${entryDate ? formatDisplayDate(entryDate) : ''}. Keep the image consistent with your recent baseline.`}
      />

      <View style={styles.photoFrame}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photoPreview} contentFit="cover" />
        ) : (
          <Image
            source={require('@/assets/images/photo-placeholder-woman.png')}
            style={styles.photoPlaceholder}
            contentFit="contain"
          />
        )}
        {isLoading || isUploading ? (
          <View style={styles.photoOverlay}>
            <ActivityIndicator color={Colors.light.accent} />
          </View>
        ) : null}
      </View>

      <Card style={styles.card}>
        <SubstrateText variant="section">For best results</SubstrateText>
        <View style={styles.list}>
          {checklist.map((item) => (
            <View key={item} style={styles.row}>
              <View style={styles.dot} />
              <SubstrateText variant="small">{item}</SubstrateText>
            </View>
          ))}
        </View>
      </Card>

      <View style={styles.summary}>
        {errorMessage ? (
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            {errorMessage}
          </SubstrateText>
        ) : (
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {statusMessage || 'Capture or choose a clear image to save with this test day’s entry.'}
          </SubstrateText>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={isLoading || isUploading}
          onPress={capturePhoto}
          style={[styles.captureRing, (isLoading || isUploading) && styles.disabled]}>
          <View style={styles.captureButton} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isLoading || isUploading}
          onPress={choosePhoto}
          style={styles.libraryButton}>
          <SubstrateText variant="small" color={Colors.light.accent}>
            Choose from Library
          </SubstrateText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isLoading || isUploading}
          onPress={() => router.push('/check-in' as Href)}
          style={(isLoading || isUploading) && styles.disabled}>
          <PrimaryButton label={photoUri ? 'Continue to Check-In' : 'Skip Photo for Now'} />
        </Pressable>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  photoFrame: {
    minHeight: 206,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  photoPreview: {
    width: '100%',
    height: 230,
  },
  photoPlaceholder: {
    width: '100%',
    height: 224,
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 253, 252, 0.64)',
  },
  card: {
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.accent,
  },
  actions: {
    marginTop: 'auto',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  captureRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: Colors.light.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.light.accent,
  },
  libraryButton: {
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    paddingHorizontal: Spacing.one,
  },
  disabled: {
    opacity: 0.65,
  },
});
