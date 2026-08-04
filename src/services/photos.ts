import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { PhotoAnalysis } from '@/types/database';

export const dailyPhotosBucket = 'daily-photos';

type UploadableImage = {
  uri: string;
  base64?: string | null;
  fileName?: string | null;
  fileSize?: number;
  mimeType?: string;
};

export function buildDailyPhotoPath(userId: string, entryId: string, fileName: string) {
  return `${userId}/${entryId}/${fileName}`;
}

export async function uploadDailyPhoto(params: {
  userId: string;
  dailyEntryId: string;
  image: UploadableImage;
}) {
  const contentType = params.image.mimeType ?? inferContentType(params.image.fileName, params.image.uri);
  const fileName = buildPhotoFileName(params.image.fileName, contentType);
  const storagePath = buildDailyPhotoPath(params.userId, params.dailyEntryId, fileName);
  const fileBody = await getUploadBody(params.image);

  const upload = await supabase.storage.from(dailyPhotosBucket).upload(storagePath, fileBody, {
    cacheControl: '3600',
    contentType,
    upsert: true,
  });

  if (upload.error) {
    return { data: null, error: upload.error };
  }

  const photo = await recordDailyPhoto({
    userId: params.userId,
    dailyEntryId: params.dailyEntryId,
    storagePath,
    contentType,
    sizeBytes: params.image.fileSize,
  });

  if (photo.error) {
    return { data: null, error: photo.error };
  }

  await supabase
    .from('daily_entries')
    .update({ status: 'photo_added' })
    .eq('id', params.dailyEntryId)
    .eq('status', 'draft');

  return { data: photo.data, error: null };
}

export async function createSignedPhotoUrl(path: string, expiresInSeconds = 60 * 10) {
  return supabase.storage.from(dailyPhotosBucket).createSignedUrl(path, expiresInSeconds);
}

export async function getLatestDailyPhoto(dailyEntryId: string) {
  const photo = await supabase
    .from('photos')
    .select('*')
    .eq('daily_entry_id', dailyEntryId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (photo.error || !photo.data) {
    return { data: null, error: photo.error };
  }

  const signedUrl = await createSignedPhotoUrl(photo.data.storage_path);

  if (signedUrl.error) {
    return { data: null, error: signedUrl.error };
  }

  return {
    data: {
      photo: photo.data,
      signedUrl: signedUrl.data.signedUrl,
    },
    error: null,
  };
}

export async function analyzeDailyPhoto(photoId: string) {
  try {
    const response = await supabase.functions.invoke('analyze-photo', {
      body: { photoId },
    });

    if (response.error) {
      return { data: null, error: response.error };
    }

    return { data: response.data?.qualityChecks as PhotoAnalysis | undefined, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('Photo analysis failed.') };
  }
}

export function toPhotoAnalysis(value: unknown): PhotoAnalysis | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const source = value as Record<string, unknown>;

  return {
    provider: toString(source.provider),
    model: toString(source.model),
    analyzedAt: toString(source.analyzedAt),
    faceDetected: typeof source.faceDetected === 'boolean' ? source.faceDetected : undefined,
    lighting: toNumber(source.lighting),
    sharpness: toNumber(source.sharpness),
    framing: toNumber(source.framing),
    redness: toNumber(source.redness),
    dryness: toNumber(source.dryness),
    congestion: toNumber(source.congestion),
    fatigue: toNumber(source.fatigue),
    toneUnevenness: toNumber(source.toneUnevenness),
    confidence: toNumber(source.confidence),
    summary: toString(source.summary),
    retakeReasons: Array.isArray(source.retakeReasons)
      ? source.retakeReasons.filter((item): item is string => typeof item === 'string')
      : undefined,
  };
}

export async function recordDailyPhoto(params: {
  userId: string;
  dailyEntryId: string;
  storagePath: string;
  contentType?: string;
  sizeBytes?: number;
}) {
  return supabase
    .from('photos')
    .insert({
      user_id: params.userId,
      daily_entry_id: params.dailyEntryId,
      storage_path: params.storagePath,
      content_type: params.contentType,
      size_bytes: params.sizeBytes,
    })
    .select('*')
    .single();
}

async function getUploadBody(image: UploadableImage) {
  if (Platform.OS === 'web') {
    const response = await fetch(image.uri);
    return response.blob();
  }

  const base64 =
    image.base64 ??
    (await FileSystem.readAsStringAsync(image.uri, {
      encoding: FileSystem.EncodingType.Base64,
    }));

  return decode(base64);
}

function buildPhotoFileName(originalName: string | null | undefined, contentType: string) {
  const extension = getFileExtension(originalName) ?? getExtensionForContentType(contentType);
  return `daily-photo-${Date.now()}.${extension}`;
}

function getFileExtension(fileName: string | null | undefined) {
  const match = fileName?.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1];
}

function getExtensionForContentType(contentType: string) {
  if (contentType.includes('png')) {
    return 'png';
  }
  if (contentType.includes('heic')) {
    return 'heic';
  }
  if (contentType.includes('heif')) {
    return 'heif';
  }
  if (contentType.includes('webp')) {
    return 'webp';
  }
  return 'jpg';
}

function inferContentType(fileName: string | null | undefined, uri: string) {
  const source = `${fileName ?? ''} ${uri}`.toLowerCase();

  if (source.includes('.png')) {
    return 'image/png';
  }
  if (source.includes('.heic')) {
    return 'image/heic';
  }
  if (source.includes('.heif')) {
    return 'image/heif';
  }
  if (source.includes('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

function toNumber(value: unknown) {
  return typeof value === 'number' ? value : undefined;
}

function toString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}
