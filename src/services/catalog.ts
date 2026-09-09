import { supabase } from '@/lib/supabase';
import type {
  Database,
  ProductCategory,
  ProductStatus,
  WardrobeFrequency,
  WardrobeItemStatus,
  WardrobeRoutineRole,
  WardrobeRoutineTiming,
} from '@/types/database';

export const productCategories: ProductCategory[] = [
  'cleanser',
  'toner',
  'essence',
  'serum',
  'moisturizer',
  'oil',
  'mask',
  'spf',
  'exfoliant',
  'retinoid',
  'treatment',
  'device',
  'other',
];

export const productStatuses: ProductStatus[] = ['needs_review', 'verified', 'draft'];
export const wardrobeRoutineTimings: WardrobeRoutineTiming[] = ['am', 'pm', 'either'];
export const wardrobeFrequencies: WardrobeFrequency[] = ['daily', 'weekly', 'as_needed'];
export const wardrobeRoutineRoles: WardrobeRoutineRole[] = [
  'cleanser',
  'serum',
  'moisturizer',
  'spf',
  'treatment',
  'device',
  'other',
];

type BrandRow = Database['public']['Tables']['brands']['Row'];
type IngredientRow = Database['public']['Tables']['ingredients']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row'];
type ProductIngredientRow = Database['public']['Tables']['product_ingredients']['Row'];
type WardrobeItemRow = Database['public']['Tables']['user_wardrobe_items']['Row'];
type CatalogError = { message: string } | null;
type CatalogResult<T> = { data: T | null; error: CatalogError };

export type CatalogBrand = BrandRow;
export type CatalogIngredient = IngredientRow;
export type CatalogProductIngredient = ProductIngredientRow & {
  ingredient: CatalogIngredient | null;
};
export type CatalogProduct = ProductRow & {
  brand: CatalogBrand | null;
  ingredients: CatalogProductIngredient[];
};
export type UserWardrobeItem = WardrobeItemRow & {
  product: CatalogProduct | null;
};

export type WardrobeMetadataInput = {
  status?: WardrobeItemStatus;
  notes?: string | null;
  routineTiming?: WardrobeRoutineTiming;
  frequency?: WardrobeFrequency;
  routineRole?: WardrobeRoutineRole;
  avoidWhenIrritated?: boolean;
};

export type ProductIngredientInput = {
  ingredientId: string;
  ingredientOrder?: number | null;
  concentration?: number | null;
  concentrationUnit?: string | null;
  notes?: string | null;
};

export type ProductInput = {
  id?: string;
  brandId: string;
  name: string;
  category: ProductCategory;
  description?: string | null;
  imageUrl?: string | null;
  barcode?: string | null;
  upc?: string | null;
  aliases?: string[];
  status: ProductStatus;
  ingredients: ProductIngredientInput[];
};

type ProductQueryRow = ProductRow & {
  brand: BrandRow | null;
  product_ingredients: (ProductIngredientRow & { ingredient: IngredientRow | null })[] | null;
};
type WardrobeQueryRow = WardrobeItemRow & {
  product:
    | (ProductRow & {
        brand: BrandRow | null;
        product_ingredients: (ProductIngredientRow & { ingredient: IngredientRow | null })[] | null;
      })
    | null;
};

export async function listBrands() {
  return supabase.from('brands').select('*').order('name', { ascending: true });
}

export async function listIngredients() {
  return supabase.from('ingredients').select('*').order('name', { ascending: true });
}

export async function listCatalogProducts({ includeArchived = false, includeUnpublished = false } = {}) {
  let query = supabase
    .from('products')
    .select(
      `
      *,
      brand:brands(*),
      product_ingredients(
        *,
        ingredient:ingredients(*)
      )
    `
    )
    .order('name', { ascending: true });

  if (!includeArchived) {
    query = query.is('archived_at', null);
  }

  if (!includeUnpublished) query = query.eq('catalog_visible', true);

  const response = await query;

  return {
    data: response.data?.map(normalizeCatalogProduct) ?? null,
    error: response.error,
  };
}

export async function createBrand(name: string, websiteUrl?: string | null): Promise<CatalogResult<CatalogBrand>> {
  const brandName = name.trim();
  const slug = slugify(brandName);
  const existing = await supabase.from('brands').select('*').eq('slug', slug).maybeSingle();

  if (existing.data || existing.error) {
    return { data: existing.data, error: existing.error };
  }

  const created = await supabase
    .from('brands')
    .insert({ name: brandName, slug, website_url: normalizeText(websiteUrl) })
    .select('*')
    .single();

  return { data: created.data, error: created.error };
}

export async function createIngredient(name: string): Promise<CatalogResult<CatalogIngredient>> {
  const ingredientName = name.trim();
  const existing = await supabase.from('ingredients').select('*').ilike('name', ingredientName).maybeSingle();

  if (existing.data || existing.error) {
    return { data: existing.data, error: existing.error };
  }

  const created = await supabase.from('ingredients').insert({ name: ingredientName }).select('*').single();

  return { data: created.data, error: created.error };
}

export async function saveProductWithIngredients(input: ProductInput) {
  const productPayload = {
    brand_id: input.brandId,
    name: input.name.trim(),
    slug: slugify(input.name),
    category: input.category,
    description: normalizeText(input.description),
    image_url: normalizeText(input.imageUrl),
    barcode: normalizeText(input.barcode),
    upc: normalizeText(input.upc),
    aliases: input.aliases ?? [],
    status: input.status,
    archived_at: null,
  };

  const productResponse = input.id
    ? await supabase.from('products').update(productPayload).eq('id', input.id).select('*').single()
    : await supabase.from('products').insert(productPayload).select('*').single();

  if (productResponse.error || !productResponse.data) {
    return { data: null, error: productResponse.error ?? new Error('Product could not be saved.') };
  }

  const productId = productResponse.data.id;
  const deleteResponse = await supabase.from('product_ingredients').delete().eq('product_id', productId);

  if (deleteResponse.error) {
    return { data: null, error: deleteResponse.error };
  }

  const uniqueIngredients = dedupeIngredientInputs(input.ingredients);

  if (uniqueIngredients.length > 0) {
    const ingredientResponse = await supabase.from('product_ingredients').insert(
      uniqueIngredients.map((ingredient) => ({
        product_id: productId,
        ingredient_id: ingredient.ingredientId,
        ingredient_order: ingredient.ingredientOrder ?? null,
        concentration: ingredient.concentration ?? null,
        concentration_unit: normalizeText(ingredient.concentrationUnit),
        notes: normalizeText(ingredient.notes),
      }))
    );

    if (ingredientResponse.error) {
      return { data: null, error: ingredientResponse.error };
    }
  }

  const savedProduct = await getCatalogProduct(productId);
  return { data: savedProduct.data, error: savedProduct.error };
}

export async function archiveProduct(productId: string) {
  return supabase
    .from('products')
    .update({ archived_at: new Date().toISOString(), status: 'draft' })
    .eq('id', productId)
    .select('*')
    .single();
}

export async function listUserWardrobe(userId: string): Promise<CatalogResult<UserWardrobeItem[]>> {
  const response = (await supabase
    .from('user_wardrobe_items')
    .select(
      `
      *,
      product:products(
        *,
        brand:brands(*),
        product_ingredients(
          *,
          ingredient:ingredients(*)
        )
      )
    `
    )
    .eq('user_id', userId)
    .order('added_at', { ascending: false })) as CatalogResult<WardrobeQueryRow[]>;

  return {
    data: response.data?.map(normalizeWardrobeItem) ?? null,
    error: response.error,
  };
}

export async function addProductToWardrobe(
  userId: string,
  productId: string,
  metadata: WardrobeMetadataInput = {}
) {
  return supabase
    .from('user_wardrobe_items')
    .upsert(
      {
        user_id: userId,
        product_id: productId,
        status: metadata.status ?? 'active',
        notes: normalizeText(metadata.notes),
        routine_timing: metadata.routineTiming ?? 'either',
        frequency: metadata.frequency ?? 'daily',
        routine_role: metadata.routineRole ?? 'other',
        avoid_when_irritated: metadata.avoidWhenIrritated ?? false,
      },
      { onConflict: 'user_id,product_id' }
    )
    .select('*')
    .single();
}

export async function updateWardrobeItem(
  itemId: string,
  updates: WardrobeMetadataInput
) {
  const payload: Database['public']['Tables']['user_wardrobe_items']['Update'] = {};

  if (updates.status !== undefined) {
    payload.status = updates.status;
  }
  if (updates.notes !== undefined) {
    payload.notes = normalizeText(updates.notes);
  }
  if (updates.routineTiming !== undefined) {
    payload.routine_timing = updates.routineTiming;
  }
  if (updates.frequency !== undefined) {
    payload.frequency = updates.frequency;
  }
  if (updates.routineRole !== undefined) {
    payload.routine_role = updates.routineRole;
  }
  if (updates.avoidWhenIrritated !== undefined) {
    payload.avoid_when_irritated = updates.avoidWhenIrritated;
  }

  return supabase
    .from('user_wardrobe_items')
    .update(payload)
    .eq('id', itemId)
    .select('*')
    .single();
}

export async function removeWardrobeItem(itemId: string) {
  return supabase.from('user_wardrobe_items').delete().eq('id', itemId);
}

async function getCatalogProduct(productId: string) {
  const response = (await supabase
    .from('products')
    .select(
      `
      *,
      brand:brands(*),
      product_ingredients(
        *,
        ingredient:ingredients(*)
      )
    `
    )
    .eq('id', productId)
    .single()) as CatalogResult<ProductQueryRow>;

  return {
    data: response.data ? normalizeCatalogProduct(response.data) : null,
    error: response.error,
  };
}

function normalizeCatalogProduct(row: ProductQueryRow): CatalogProduct {
  return {
    ...row,
    brand: row.brand,
    ingredients: (row.product_ingredients ?? [])
      .map((ingredient) => ({
        ...ingredient,
        ingredient: ingredient.ingredient,
      }))
      .sort((a, b) => (a.ingredient_order ?? 999) - (b.ingredient_order ?? 999)),
  };
}

function normalizeWardrobeItem(row: WardrobeQueryRow): UserWardrobeItem {
  return {
    ...row,
    product: row.product ? normalizeCatalogProduct(row.product) : null,
  };
}

function dedupeIngredientInputs(ingredients: ProductIngredientInput[]) {
  const seen = new Set<string>();

  return ingredients.filter((ingredient) => {
    if (seen.has(ingredient.ingredientId)) {
      return false;
    }

    seen.add(ingredient.ingredientId);
    return true;
  });
}

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
