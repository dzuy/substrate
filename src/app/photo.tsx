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
  StepProgress,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { formatDisplayDate, getActiveEntryDate, getOrCreateDailyEntry } from '@/services/daily-entries';
import { analyzeDailyPhoto, getLatestDailyPhoto, toPhotoAnalysis, uploadDailyPhoto } from '@/services/photos';
import type { PhotoAnalysis } from '@/types/database';

const guidance = ['Face the camera directly.', 'Keep the angle consistent.', 'Avoid harsh shadows.'];

export default function PhotoScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [entryId, setEntryId] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [photoAnalysis, setPhotoAnalysis] = useState<PhotoAnalysis | null>(null);
  const [entryDate, setEntryDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

        const loadedAnalysis = toPhotoAnalysis(photo.data?.photo.quality_checks);
        setPhotoAnalysis(loadedAnalysis ?? null);
        setStatusMessage(photo.data ? 'Loaded this test day’s saved photo.' : '');
        setIsLoading(false);

        if (photo.data?.photo.id && !loadedAnalysis?.analyzedAt) {
          setIsAnalyzing(true);
          const analyzed = await analyzeDailyPhoto(photo.data.photo.id);

          if (!isMounted) {
            return;
          }

          setIsAnalyzing(false);

          if (analyzed.data) {
            setPhotoAnalysis(analyzed.data);
            setStatusMessage('Loaded and analyzed this test day’s saved photo.');
          }
        }
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
    setPhotoAnalysis(null);
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

    setStatusMessage('Photo saved. Running basic image analysis.');

    if (upload.data?.id) {
      setIsAnalyzing(true);
      const analyzed = await analyzeDailyPhoto(upload.data.id);
      setIsAnalyzing(false);

      if (analyzed.data) {
        setPhotoAnalysis(analyzed.data);
        setStatusMessage('Photo saved and analyzed.');
      } else {
        setStatusMessage('Photo saved. Analysis will run later if configured.');
      }
    } else {
      setStatusMessage('Photo saved to Supabase.');
    }
  }

  const hasPhoto = Boolean(photoUri);
  const isBusy = isLoading || isUploading || isAnalyzing;
  const title = hasPhoto ? 'Photo saved' : 'Take your photo';
  const body = entryDate ? formatDisplayDate(entryDate) : undefined;

  return (
    <AppShell>
      <BackLink href="/" />
      <StepProgress currentStep={1} totalSteps={5} currentLabel="Photo" nextLabel="Check-in" />
      <ScreenHeader
        title={hasPhoto ? title : "Take Today's Photo"}
        body={body}
      />

      <View style={[styles.photoFrame, hasPhoto && styles.photoFrameFilled]}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photoPreview} contentFit="cover" />
        ) : (
          <Image
            source={require('@/assets/images/photo-placeholder-woman.png')}
            style={styles.photoPlaceholder}
            contentFit="contain"
          />
        )}
        {isBusy ? (
          <View style={styles.photoOverlay}>
            <ActivityIndicator color={Colors.light.accent} />
          </View>
        ) : null}
      </View>

      {(errorMessage || statusMessage || isUploading || isAnalyzing || hasPhoto) ? (
        <View style={styles.summary}>
          {errorMessage ? (
            <SubstrateText variant="small" color={Colors.light.accentDeep}>
              {errorMessage}
            </SubstrateText>
          ) : (
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              {getStatusCopy(statusMessage, isUploading, isAnalyzing, hasPhoto)}
            </SubstrateText>
          )}
        </View>
      ) : null}

      {photoAnalysis ? (
        <Card style={styles.card}>
          <SubstrateText variant="section">Photo quality</SubstrateText>
          <View style={styles.qualityGrid}>
            <QualityMetric label="Face" value={photoAnalysis.faceDetected ? 'Detected' : 'Retake'} />
            <QualityMetric label="Light" value={formatScore(photoAnalysis.lighting)} />
            <QualityMetric label="Sharpness" value={formatScore(photoAnalysis.sharpness)} />
            <QualityMetric label="Framing" value={formatScore(photoAnalysis.framing)} />
          </View>
          {photoAnalysis.summary ? (
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              {photoAnalysis.summary}
            </SubstrateText>
          ) : null}
        </Card>
      ) : (
        <Card style={styles.card}>
          <SubstrateText variant="section">For best results</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Use soft, even lighting and keep your face centered.
          </SubstrateText>
          <View style={styles.guidanceList}>
            {guidance.map((item) => (
              <View key={item} style={styles.guidanceItem}>
                <View style={styles.dot} />
                <SubstrateText variant="small" color={Colors.light.textMuted}>
                  {item}
                </SubstrateText>
              </View>
            ))}
          </View>
        </Card>
      )}

      <View style={styles.actions}>
        {hasPhoto ? (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => router.push('/check-in' as Href)}
              style={[styles.fullWidth, isBusy && styles.disabled]}>
              <PrimaryButton label="Next" />
            </Pressable>
            <View style={styles.secondaryActions}>
              <Pressable accessibilityRole="button" disabled={isBusy} onPress={capturePhoto} style={styles.textAction}>
                <SubstrateText variant="small" color={Colors.light.accent}>
                  Retake
                </SubstrateText>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={isBusy} onPress={choosePhoto} style={styles.textAction}>
                <SubstrateText variant="small" color={Colors.light.accent}>
                  Choose Different
                </SubstrateText>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={capturePhoto}
              style={[styles.fullWidth, isBusy && styles.disabled]}>
              <PrimaryButton label={isUploading ? 'Uploading Photo' : 'Take Photo'} />
            </Pressable>
            <Pressable accessibilityRole="button" disabled={isBusy} onPress={choosePhoto} style={styles.secondaryButton}>
              <SubstrateText variant="small" color={Colors.light.accentDeep}>
                Choose from Library
              </SubstrateText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => router.push('/check-in' as Href)}
              style={styles.skipButton}>
              <SubstrateText variant="small" color={Colors.light.textMuted}>
                Skip for now
              </SubstrateText>
            </Pressable>
          </>
        )}
      </View>
    </AppShell>
  );
}

function QualityMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.qualityMetric}>
      <SubstrateText variant="small" color={Colors.light.textMuted}>
        {label}
      </SubstrateText>
      <SubstrateText variant="small">{value}</SubstrateText>
    </View>
  );
}

function formatScore(value?: number) {
  return typeof value === 'number' ? String(Math.round(value)) : '--';
}

function getStatusCopy(statusMessage: string, isUploading: boolean, isAnalyzing: boolean, hasPhoto: boolean) {
  if (isUploading) return 'Saving your image to this private test day.';
  if (isAnalyzing) return 'Checking lighting, framing, and visible skin signals.';
  if (statusMessage) return statusMessage;
  if (hasPhoto) return 'Review the photo quality, then continue when ready.';
  return '';
}

const styles = StyleSheet.create({
  photoFrame: {
    minHeight: 286,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  photoFrameFilled: {
    boxShadow: '0 16px 34px rgba(45, 23, 35, 0.08)',
  },
  photoPreview: {
    width: '100%',
    height: 318,
  },
  photoPlaceholder: {
    width: '100%',
    height: 286,
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
  guidanceList: {
    gap: Spacing.one,
  },
  guidanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.accent,
  },
  qualityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  qualityMetric: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#FBF8F6',
    borderWidth: 1,
    borderColor: Colors.light.border,
    justifyContent: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.three,
  },
  actions: {
    marginTop: 'auto',
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  fullWidth: {
    width: '100%',
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
  secondaryActions: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  textAction: {
    minHeight: 34,
    justifyContent: 'center',
  },
  skipButton: {
    minHeight: 34,
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
