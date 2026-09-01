import { supabase } from '@/lib/supabase';
import type { CatalogProduct } from '@/services/catalog';
import type { Database, Json, ProductDetectionStatus } from '@/types/database';

export type ProductDetectionCandidate = {
  id: string;
  sourceImageUri: string;
  detectedBrand?: string;
  detectedProductName?: string;
  matchedProductId?: string;
  confidence?: number;
  status: ProductDetectionStatus;
  rawResponse?: Json;
};

export type ProductRecognitionInput = {
  imageDataUrl?: string;
  sourceImageUri: string;
  catalogProducts: CatalogProduct[];
};

export interface ProductRecognitionService {
  analyzeImage(input: ProductRecognitionInput): Promise<ProductDetectionCandidate[]>;
}

type OpenAiProductDetectionResponse = {
  detections?: {
    detectedBrand?: string | null;
    detectedProductName?: string | null;
    matchedProductId?: string | null;
    confidence?: number | null;
    status?: ProductDetectionStatus;
    rawResponse?: Json;
  }[];
  provider?: string;
  model?: string;
  rawResponse?: Json;
};

type ProductDetectionRow = Database['public']['Tables']['product_detections']['Row'];

// Development implementation only. Replace this with OCR/vision analysis when the backend is ready.
export const mockProductRecognitionService: ProductRecognitionService = {
  async analyzeImage({ catalogProducts, sourceImageUri }) {
    const candidates = catalogProducts.slice(0, 3).map((product, index) => ({
      id: buildLocalDetectionId(index),
      sourceImageUri,
      detectedBrand: product.brand?.name,
      detectedProductName: product.name,
      matchedProductId: product.id,
      confidence: 0.82 - index * 0.08,
      status: 'needs_confirmation' as const,
      rawResponse: {
        provider: 'mock',
        note: 'Development placeholder. This is not real visual product recognition.',
      },
    }));

    if (candidates.length > 0) {
      return candidates;
    }

    return [
      {
        id: buildLocalDetectionId(0),
        sourceImageUri,
        detectedBrand: undefined,
        detectedProductName: undefined,
        confidence: 0.2,
        status: 'unknown',
        rawResponse: {
          provider: 'mock',
          note: 'No catalog products were available to suggest.',
        },
      },
    ];
  },
};

export const openAiProductRecognitionService: ProductRecognitionService = {
  async analyzeImage({ catalogProducts, imageDataUrl, sourceImageUri }) {
    if (!imageDataUrl) {
      throw new Error('Image data is required for OpenAI product recognition.');
    }

    const response = await supabase.functions.invoke<OpenAiProductDetectionResponse>('analyze-products', {
      body: {
        imageDataUrl,
        catalogProducts: catalogProducts.map((product) => ({
          id: product.id,
          brand: product.brand?.name,
          name: product.name,
          category: product.category,
          aliases: product.aliases,
        })),
      },
    });

    if (response.error) {
      throw response.error;
    }

    return (
      response.data?.detections?.map((detection, index) => ({
        id: buildLocalDetectionId(index),
        sourceImageUri,
        detectedBrand: detection.detectedBrand ?? undefined,
        detectedProductName: detection.detectedProductName ?? undefined,
        matchedProductId: detection.matchedProductId ?? undefined,
        confidence: detection.confidence ?? undefined,
        status: detection.status ?? (detection.matchedProductId ? 'needs_confirmation' : 'unknown'),
        rawResponse: {
          provider: response.data?.provider ?? 'openai',
          model: response.data?.model,
          detection: detection.rawResponse,
        },
      })) ?? []
    );
  },
};

export async function saveProductDetections(userId: string, detections: ProductDetectionCandidate[]) {
  const inserted = await supabase
    .from('product_detections')
    .insert(
      detections.map((detection) => ({
        user_id: userId,
        source_image_uri: detection.sourceImageUri,
        detected_brand: detection.detectedBrand ?? null,
        detected_product_name: detection.detectedProductName ?? null,
        matched_product_id: detection.matchedProductId ?? null,
        confidence: detection.confidence ?? null,
        status: detection.status,
        raw_response: detection.rawResponse ?? {},
      }))
    )
    .select('*');

  return {
    data: inserted.data?.map(toDetectionCandidate) ?? null,
    error: inserted.error,
  };
}

export async function updateProductDetectionStatus(
  detectionId: string,
  updates: {
    detectedBrand?: string;
    detectedProductName?: string;
    matchedProductId?: string | null;
    rawResponse?: Json;
    status: ProductDetectionStatus;
  }
) {
  const payload: Database['public']['Tables']['product_detections']['Update'] = {
    matched_product_id: updates.matchedProductId ?? null,
    status: updates.status,
  };

  if (updates.detectedBrand !== undefined) {
    payload.detected_brand = normalizeText(updates.detectedBrand);
  }
  if (updates.detectedProductName !== undefined) {
    payload.detected_product_name = normalizeText(updates.detectedProductName);
  }
  if (updates.rawResponse !== undefined) {
    payload.raw_response = updates.rawResponse;
  }

  return supabase
    .from('product_detections')
    .update(payload)
    .eq('id', detectionId)
    .select('*')
    .single();
}

export async function submitUnknownProduct({
  detectedBrand,
  detectedProductName,
  detectionId,
  sourceImageUri,
  userId,
}: {
  detectedBrand?: string;
  detectedProductName?: string;
  detectionId?: string;
  sourceImageUri: string;
  userId: string;
}) {
  return supabase
    .from('product_submissions')
    .insert({
      user_id: userId,
      detection_id: detectionId ?? null,
      detected_brand: normalizeText(detectedBrand),
      detected_product_name: normalizeText(detectedProductName),
      source_image_uri: sourceImageUri,
      status: 'pending',
    })
    .select('*')
    .single();
}

function toDetectionCandidate(row: ProductDetectionRow): ProductDetectionCandidate {
  return {
    id: row.id,
    sourceImageUri: row.source_image_uri,
    detectedBrand: row.detected_brand ?? undefined,
    detectedProductName: row.detected_product_name ?? undefined,
    matchedProductId: row.matched_product_id ?? undefined,
    confidence: row.confidence ?? undefined,
    status: row.status,
    rawResponse: row.raw_response,
  };
}

function buildLocalDetectionId(index: number) {
  return `local-detection-${Date.now()}-${index}`;
}

function normalizeText(value?: string) {
  const trimmed = value?.trim();
  return trimmed || null;
}
