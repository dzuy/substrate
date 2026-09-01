import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import {
  AppShell,
  Card,
  PrimaryButton,
  ScreenHeader,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import {
  addProductToWardrobe,
  createBrand,
  createIngredient,
  listCatalogProducts,
  listUserWardrobe,
  removeWardrobeItem,
  saveProductWithIngredients,
  updateWardrobeItem,
  wardrobeFrequencies,
  type CatalogProduct,
  type UserWardrobeItem,
  type WardrobeMetadataInput,
  wardrobeRoutineRoles,
  wardrobeRoutineTimings,
} from '@/services/catalog';
import {
  openAiProductRecognitionService,
  saveProductDetections,
  updateProductDetectionStatus,
  type ProductDetectionCandidate,
} from '@/services/product-recognition';
import type {
  WardrobeFrequency,
  WardrobeItemStatus,
  WardrobeRoutineRole,
  WardrobeRoutineTiming,
} from '@/types/database';

const wardrobeStatuses: WardrobeItemStatus[] = ['active', 'paused', 'finished'];
const ingredientChipPalette = [
  { backgroundColor: '#F8E7EC', borderColor: '#EDC7D4', color: '#682246' },
  { backgroundColor: '#EAF3EA', borderColor: '#C9E2CB', color: '#315C36' },
  { backgroundColor: '#FFF3E7', borderColor: '#F1D2AF', color: '#7A4B18' },
  { backgroundColor: '#E8EEF8', borderColor: '#C8D6EA', color: '#294B73' },
  { backgroundColor: '#EFE4EF', borderColor: '#DAC5DE', color: '#57365C' },
  { backgroundColor: '#F3EDE4', borderColor: '#DDD0C0', color: '#60482F' },
];

type SelectedProductImage = {
  uri: string;
  dataUrl: string;
};

type ProductReviewDraft = {
  brand: string;
  description: string;
  ingredients: string[];
  productName: string;
  metadata: Required<Pick<WardrobeMetadataInput, 'avoidWhenIrritated' | 'frequency' | 'routineRole' | 'routineTiming'>>;
};

export default function SkinWardrobeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [wardrobeItems, setWardrobeItems] = useState<UserWardrobeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedWardrobeItemId, setSelectedWardrobeItemId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadWardrobe() {
        if (!user) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setErrorMessage('');

        const wardrobeResult = await listUserWardrobe(user.id);

        if (!isMounted) {
          return;
        }

        if (wardrobeResult.error) {
          setErrorMessage(wardrobeResult.error.message ?? 'Skin Wardrobe could not be loaded.');
        } else {
          setWardrobeItems(wardrobeResult.data ?? []);
        }

        setIsLoading(false);
      }

      loadWardrobe();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  async function saveWardrobeItem(item: UserWardrobeItem, updates: WardrobeMetadataInput) {
    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const saved = await updateWardrobeItem(item.id, updates);
    setIsSaving(false);

    if (saved.error) {
      setErrorMessage(saved.error.message);
      return;
    }

    setWardrobeItems((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id
          ? {
              ...currentItem,
              status: updates.status ?? currentItem.status,
              notes: updates.notes ?? currentItem.notes,
              routine_timing: updates.routineTiming ?? currentItem.routine_timing,
              frequency: updates.frequency ?? currentItem.frequency,
              routine_role: updates.routineRole ?? currentItem.routine_role,
              avoid_when_irritated: updates.avoidWhenIrritated ?? currentItem.avoid_when_irritated,
            }
          : currentItem
      )
    );
  }

  async function addIngredientToProduct(item: UserWardrobeItem, ingredientName: string) {
    const product = item.product;
    const normalizedIngredient = ingredientName.trim();

    if (!product || !normalizedIngredient) {
      return false;
    }

    const existingIngredients = product.ingredients ?? [];
    const alreadyAdded = existingIngredients.some(
      (productIngredient) => productIngredient.ingredient?.name.toLowerCase() === normalizedIngredient.toLowerCase()
    );

    if (alreadyAdded) {
      setMessage(`${normalizedIngredient} is already listed for this product.`);
      return true;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const ingredient = await createIngredient(normalizedIngredient);

    if (ingredient.error || !ingredient.data) {
      setIsSaving(false);
      setErrorMessage(ingredient.error?.message ?? 'Ingredient could not be saved.');
      return false;
    }

    const savedProduct = await saveProductWithIngredients({
      id: product.id,
      brandId: product.brand_id,
      name: product.name,
      category: product.category,
      description: product.description,
      imageUrl: product.image_url,
      barcode: product.barcode,
      upc: product.upc,
      aliases: product.aliases ?? [],
      status: product.status,
      ingredients: [
        ...existingIngredients.map((productIngredient, index) => ({
          ingredientId: productIngredient.ingredient_id,
          ingredientOrder: productIngredient.ingredient_order ?? index + 1,
          concentration: productIngredient.concentration,
          concentrationUnit: productIngredient.concentration_unit,
          notes: productIngredient.notes,
        })),
        {
          ingredientId: ingredient.data.id,
          ingredientOrder: existingIngredients.length + 1,
        },
      ],
    });
    setIsSaving(false);

    if (savedProduct.error || !savedProduct.data) {
      setErrorMessage(savedProduct.error?.message ?? 'Product ingredients could not be saved.');
      return false;
    }

    setWardrobeItems((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id
          ? {
              ...currentItem,
              product: savedProduct.data,
            }
          : currentItem
      )
    );
    setMessage(`${normalizedIngredient} added to ${product.name}.`);
    return true;
  }

  async function removeItem(item: UserWardrobeItem) {
    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const removed = await removeWardrobeItem(item.id);
    setIsSaving(false);

    if (removed.error) {
      setErrorMessage(removed.error.message);
      return;
    }

    setWardrobeItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    setSelectedWardrobeItemId(null);
    setMessage(`${item.product?.name ?? 'Product'} removed.`);
  }

  const selectedWardrobeItem =
    wardrobeItems.find((item) => item.id === selectedWardrobeItemId) ?? null;

  return (
    <AppShell>
      <ScreenHeader eyebrow="Skin Wardrobe" title="My products" />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.light.accent} />
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Loading wardrobe
          </SubstrateText>
        </View>
      ) : null}

      {message ? (
        <Card style={styles.noticeCard}>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {message}
          </SubstrateText>
        </Card>
      ) : null}

      {errorMessage ? (
        <Card style={styles.errorCard}>
          <SubstrateText variant="section">Wardrobe needs attention</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            {errorMessage}
          </SubstrateText>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <View style={styles.sectionHeader}>
          <View>
            <SubstrateText variant="section">All products</SubstrateText>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              {wardrobeItems.length} saved product{wardrobeItems.length === 1 ? '' : 's'}
            </SubstrateText>
          </View>
        </View>

        {wardrobeItems.length ? (
          <View style={styles.productList}>
            {wardrobeItems.map((item) => (
              <WardrobeCard
                key={item.id}
                item={item}
                onPress={() => setSelectedWardrobeItemId(item.id)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <SubstrateText variant="section">No products yet</SubstrateText>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Add your first product to start building your Skin Wardrobe.
            </SubstrateText>
          </View>
        )}
      </Card>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/skin-wardrobe/add-products')}
        style={styles.footerButton}>
        <PrimaryButton label="Add Products" />
      </Pressable>

      <WardrobeDetailsDrawer
        disabled={isSaving}
        item={selectedWardrobeItem}
        onClose={() => setSelectedWardrobeItemId(null)}
        onAddIngredient={(ingredientName) => {
          if (!selectedWardrobeItem) {
            return Promise.resolve(false);
          }

          return addIngredientToProduct(selectedWardrobeItem, ingredientName);
        }}
        onRemove={() => {
          if (selectedWardrobeItem) {
            removeItem(selectedWardrobeItem);
          }
        }}
        onSave={(updates) => {
          if (selectedWardrobeItem) {
            saveWardrobeItem(selectedWardrobeItem, updates);
          }
        }}
      />
    </AppShell>
  );
}

export function AddProductsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [selectedImage, setSelectedImage] = useState<SelectedProductImage | null>(null);
  const [detections, setDetections] = useState<ProductDetectionCandidate[]>([]);
  const [manualBrand, setManualBrand] = useState('');
  const [manualProductName, setManualProductName] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualIngredients, setManualIngredients] = useState<string[]>([]);
  const [manualIngredientDraft, setManualIngredientDraft] = useState('');
  const [manualRoutineTiming, setManualRoutineTiming] = useState<WardrobeRoutineTiming>('either');
  const [manualFrequency, setManualFrequency] = useState<WardrobeFrequency>('daily');
  const [manualRoutineRole, setManualRoutineRole] = useState<WardrobeRoutineRole>('other');
  const [manualAvoidWhenIrritated, setManualAvoidWhenIrritated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadCatalog() {
        if (!user) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setErrorMessage('');

        const catalogResult = await listCatalogProducts();

        if (!isMounted) {
          return;
        }

        if (catalogResult.error) {
          setErrorMessage(catalogResult.error.message ?? 'Product catalog could not be loaded.');
        } else {
          setCatalogProducts(catalogResult.data ?? []);
        }

        setIsLoading(false);
      }

      loadCatalog();

      return () => {
        isMounted = false;
      };
    }, [user])
  );

  async function chooseImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setErrorMessage('Photo library permission is needed to choose a product image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      base64: true,
      mediaTypes: ['images'],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const selected = toSelectedProductImage(result.assets[0]);

      if (!selected) {
        setErrorMessage('This image could not be prepared for analysis.');
        return;
      }

      setSelectedImage(selected);
      setDetections([]);
      setMessage('');
      setErrorMessage('');
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      setErrorMessage('Camera permission is needed to take a product photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      base64: true,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const selected = toSelectedProductImage(result.assets[0]);

      if (!selected) {
        setErrorMessage('This image could not be prepared for analysis.');
        return;
      }

      setSelectedImage(selected);
      setDetections([]);
      setMessage('');
      setErrorMessage('');
    }
  }

  async function analyzeSelectedImage() {
    if (!user || !selectedImage) {
      return;
    }

    setIsAnalyzing(true);
    setMessage('');
    setErrorMessage('');

    try {
      const candidates = await openAiProductRecognitionService.analyzeImage({
        sourceImageUri: selectedImage.uri,
        imageDataUrl: selectedImage.dataUrl,
        catalogProducts,
      });
      const saved = await saveProductDetections(user.id, candidates);
      setIsAnalyzing(false);

      if (saved.error || !saved.data) {
        setErrorMessage(saved.error?.message ?? 'Product candidates could not be saved.');
        return;
      }

      setDetections(saved.data);
      setMessage('OpenAI returned product candidates for confirmation.');
    } catch (error) {
      setIsAnalyzing(false);
      setErrorMessage(error instanceof Error ? error.message : 'OpenAI product analysis failed.');
      return;
    }
  }

  async function confirmDetection(
    detection: ProductDetectionCandidate,
    reviewDraft: ProductReviewDraft
  ) {
    let matchedProductId = detection.matchedProductId;
    let product = catalogProducts.find((catalogProduct) => catalogProduct.id === matchedProductId);

    if (!user) {
      return;
    }

    if (!reviewDraft.brand.trim() || !reviewDraft.productName.trim()) {
      setErrorMessage('Brand and product are required before accepting.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    if (!product) {
      const createdProduct = await createCatalogProductFromReview(reviewDraft);

      if (createdProduct.error || !createdProduct.data) {
        setIsSaving(false);
        setErrorMessage(createdProduct.error?.message ?? 'Product could not be created.');
        return;
      }

      const savedProduct = createdProduct.data;
      product = savedProduct;
      matchedProductId = savedProduct.id;
      setCatalogProducts((current) => upsertCatalogProduct(current, savedProduct));
    }

    if (!matchedProductId) {
      setIsSaving(false);
      setErrorMessage('Product could not be accepted.');
      return;
    }

    const [updatedDetection, added] = await Promise.all([
      updateProductDetectionStatus(detection.id, {
        detectedBrand: reviewDraft.brand,
        detectedProductName: reviewDraft.productName,
        matchedProductId,
        rawResponse: {
          ...(isRecord(detection.rawResponse) ? detection.rawResponse : {}),
          reviewedDescription: reviewDraft.description,
          reviewedIngredients: reviewDraft.ingredients,
        },
        status: 'confirmed',
      }),
      addProductToWardrobe(user.id, matchedProductId, reviewDraft.metadata),
    ]);

    if (updatedDetection.error || added.error) {
      setIsSaving(false);
      setErrorMessage(updatedDetection.error?.message ?? added.error?.message ?? 'Product could not be confirmed.');
      return;
    }

    setIsSaving(false);

    setDetections((current) =>
      current.map((currentDetection) =>
        currentDetection.id === detection.id
          ? {
              ...currentDetection,
              detectedBrand: reviewDraft.brand || currentDetection.detectedBrand,
              detectedProductName: reviewDraft.productName || currentDetection.detectedProductName,
              matchedProductId,
              status: 'confirmed',
            }
          : currentDetection
      )
    );
    setMessage(`${product.brand?.name ? `${product.brand.name} ` : ''}${product.name} confirmed and added.`);
  }

  async function createCatalogProductFromReview(reviewDraft: {
    brand: string;
    description: string;
    ingredients: string[];
    metadata?: ProductReviewDraft['metadata'];
    productName: string;
  }) {
    const brand = await createBrand(reviewDraft.brand);

    if (brand.error || !brand.data) {
      return { data: null, error: brand.error ?? { message: 'Brand could not be created.' } };
    }

    const ingredientResults = await Promise.all(
      reviewDraft.ingredients
        .map((ingredient) => ingredient.trim())
        .filter(Boolean)
        .map((ingredient) => createIngredient(ingredient))
    );
    const ingredientError = ingredientResults.find((result) => result.error)?.error;

    if (ingredientError) {
      return { data: null, error: ingredientError };
    }

    return saveProductWithIngredients({
      brandId: brand.data.id,
      name: reviewDraft.productName,
      category: toProductCategory(reviewDraft.metadata),
      description: reviewDraft.description,
      aliases: [],
      status: 'verified',
      ingredients: ingredientResults
        .map((result, index) =>
          result.data
            ? {
                ingredientId: result.data.id,
                ingredientOrder: index + 1,
              }
            : null
        )
        .filter((ingredient): ingredient is { ingredientId: string; ingredientOrder: number } => Boolean(ingredient)),
    });
  }

  async function rejectDetection(detection: ProductDetectionCandidate) {
    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const updated = await updateProductDetectionStatus(detection.id, {
      matchedProductId: detection.matchedProductId ?? null,
      status: 'rejected',
    });
    setIsSaving(false);

    if (updated.error) {
      setErrorMessage(updated.error.message);
      return;
    }

    setDetections((current) =>
      current.map((currentDetection) =>
        currentDetection.id === detection.id ? { ...currentDetection, status: 'rejected' } : currentDetection
      )
    );
  }

  function addManualIngredient() {
    const normalizedIngredient = manualIngredientDraft.trim();

    if (!normalizedIngredient) {
      return;
    }

    setManualIngredients((current) =>
      current.some((ingredient) => ingredient.toLowerCase() === normalizedIngredient.toLowerCase())
        ? current
        : [...current, normalizedIngredient]
    );
    setManualIngredientDraft('');
  }

  async function saveManualProduct() {
    if (!user) {
      return;
    }

    const pendingIngredients = manualIngredientDraft.trim()
      ? [...manualIngredients, manualIngredientDraft.trim()]
      : manualIngredients;
    const reviewDraft = {
      brand: manualBrand,
      productName: manualProductName,
      description: manualDescription,
      ingredients: pendingIngredients,
      metadata: {
        routineTiming: manualRoutineTiming,
        frequency: manualFrequency,
        routineRole: manualRoutineRole,
        avoidWhenIrritated: manualAvoidWhenIrritated,
      },
    };

    if (!reviewDraft.brand.trim() || !reviewDraft.productName.trim() || !reviewDraft.description.trim()) {
      setErrorMessage('Brand, product, and description are required before adding.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const createdProduct = await createCatalogProductFromReview(reviewDraft);

    if (createdProduct.error || !createdProduct.data) {
      setIsSaving(false);
      setErrorMessage(createdProduct.error?.message ?? 'Product could not be created.');
      return;
    }

    const savedProduct = createdProduct.data;
    const added = await addProductToWardrobe(user.id, savedProduct.id, reviewDraft.metadata);
    setIsSaving(false);

    if (added.error) {
      setErrorMessage(added.error.message);
      return;
    }

    setCatalogProducts((current) => upsertCatalogProduct(current, savedProduct));
    setManualBrand('');
    setManualProductName('');
    setManualDescription('');
    setManualIngredients([]);
    setManualIngredientDraft('');
    setManualRoutineTiming('either');
    setManualFrequency('daily');
    setManualRoutineRole('other');
    setManualAvoidWhenIrritated(false);
    setMessage(`${savedProduct.brand?.name ? `${savedProduct.brand.name} ` : ''}${savedProduct.name} added.`);
  }

  const canSaveManualProduct =
    Boolean(manualBrand.trim()) &&
    Boolean(manualProductName.trim()) &&
    Boolean(manualDescription.trim()) &&
    !isSaving;

  return (
    <AppShell>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <SubstrateText variant="small" color={Colors.light.accentDeep}>
          Back to Wardrobe
        </SubstrateText>
      </Pressable>
      <ScreenHeader
        eyebrow="Skin Wardrobe"
        title="Add products"
        body="Add one product at a time, either by filling in the product details or by scanning a product photo."
      />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.light.accent} />
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Loading product tools
          </SubstrateText>
        </View>
      ) : null}

      {message ? (
        <Card style={styles.noticeCard}>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {message}
          </SubstrateText>
        </Card>
      ) : null}

      {errorMessage ? (
        <Card style={styles.errorCard}>
          <SubstrateText variant="section">Wardrobe needs attention</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            {errorMessage}
          </SubstrateText>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <View>
          <SubstrateText variant="section">Add one product</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Fill in the basics, then add it directly to your Skin Wardrobe.
          </SubstrateText>
        </View>

        <View style={styles.candidateFields}>
          <View style={[styles.fieldGroup, styles.editableFieldGroup]}>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Brand
            </SubstrateText>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              editable={!isSaving}
              onChangeText={setManualBrand}
              placeholder="Brand"
              placeholderTextColor={Colors.light.textMuted}
              style={[styles.input, styles.candidateInput]}
              value={manualBrand}
            />
          </View>

          <View style={[styles.fieldGroup, styles.editableFieldGroup]}>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Product
            </SubstrateText>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              editable={!isSaving}
              onChangeText={setManualProductName}
              placeholder="Product name"
              placeholderTextColor={Colors.light.textMuted}
              style={[styles.input, styles.candidateInput]}
              value={manualProductName}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Description
          </SubstrateText>
          <TextInput
            autoCapitalize="sentences"
            autoCorrect
            editable={!isSaving}
            multiline
            onChangeText={setManualDescription}
            placeholder="What is it?"
            placeholderTextColor={Colors.light.textMuted}
            style={[styles.input, styles.noteInput, styles.candidateInput]}
            textAlignVertical="top"
            value={manualDescription}
          />
        </View>

        <View style={styles.fieldGroup}>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Ingredients
          </SubstrateText>
          {manualIngredients.length ? (
            <View style={styles.ingredientChipGroup}>
              {manualIngredients.map((ingredient, index) => {
                const chipStyle = getIngredientChipStyle(ingredient, index);

                return (
                  <Pressable
                    key={`${ingredient}-${index}`}
                    accessibilityRole="button"
                    disabled={isSaving}
                    onPress={() =>
                      setManualIngredients((current) =>
                        current.filter((_, currentIndex) => currentIndex !== index)
                      )
                    }
                    style={[
                      styles.editableIngredientChip,
                      { backgroundColor: chipStyle.backgroundColor, borderColor: chipStyle.borderColor },
                      isSaving && styles.disabled,
                    ]}>
                    <SubstrateText variant="small" color={chipStyle.color}>
                      {ingredient} x
                    </SubstrateText>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              No ingredients yet.
            </SubstrateText>
          )}
          <View style={styles.addIngredientRow}>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              editable={!isSaving}
              onChangeText={setManualIngredientDraft}
              onSubmitEditing={addManualIngredient}
              placeholder="Add ingredient"
              placeholderTextColor={Colors.light.textMuted}
              returnKeyType="done"
              style={[styles.input, styles.addIngredientInput]}
              value={manualIngredientDraft}
            />
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={addManualIngredient}
              style={[styles.smallButton, isSaving && styles.disabled]}>
              <SubstrateText variant="small" color={Colors.light.accentDeep}>
                Add
              </SubstrateText>
            </Pressable>
          </View>
        </View>

        <WardrobeMetadataControls
          avoidWhenIrritated={manualAvoidWhenIrritated}
          disabled={isSaving}
          frequency={manualFrequency}
          routineRole={manualRoutineRole}
          routineTiming={manualRoutineTiming}
          onChange={(updates) => {
            if (updates.routineTiming !== undefined) {
              setManualRoutineTiming(updates.routineTiming);
            }
            if (updates.frequency !== undefined) {
              setManualFrequency(updates.frequency);
            }
            if (updates.routineRole !== undefined) {
              setManualRoutineRole(updates.routineRole);
            }
            if (updates.avoidWhenIrritated !== undefined) {
              setManualAvoidWhenIrritated(updates.avoidWhenIrritated);
            }
          }}
        />

        <Pressable
          accessibilityRole="button"
          disabled={!canSaveManualProduct}
          onPress={saveManualProduct}
          style={[styles.acceptButton, !canSaveManualProduct && styles.disabled]}>
          <SubstrateText variant="small" color="#FFFFFF">
            Add to Wardrobe
          </SubstrateText>
        </Pressable>
      </Card>

      <Card style={styles.card}>
        <View>
          <SubstrateText variant="section">Identify products from photo</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Upload or take a product photo, review possible matches, then confirm before anything is added.
          </SubstrateText>
        </View>

        <View style={styles.photoActions}>
          <Pressable accessibilityRole="button" disabled={isSaving || isAnalyzing} onPress={chooseImage} style={styles.secondaryButton}>
            <SubstrateText variant="small" color={Colors.light.accentDeep}>
              Choose Image
            </SubstrateText>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={isSaving || isAnalyzing} onPress={takePhoto} style={styles.secondaryButton}>
            <SubstrateText variant="small" color={Colors.light.accentDeep}>
              Take Photo
            </SubstrateText>
          </Pressable>
        </View>

        {selectedImage ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} contentFit="cover" />
            <Pressable
              accessibilityRole="button"
              disabled={isAnalyzing || isSaving}
              onPress={analyzeSelectedImage}
              style={[styles.analyzeButton, (isAnalyzing || isSaving) && styles.disabled]}>
              {isAnalyzing ? <LoadingPrimaryButton label="Finding Products" /> : <PrimaryButton label="Find Products" />}
            </Pressable>
          </View>
        ) : null}

        {detections.length ? (
          <View style={styles.productList}>
            <SubstrateText variant="section">Review candidates</SubstrateText>
            {detections.map((detection) => (
              <DetectionCard
                key={detection.id}
                catalogProducts={catalogProducts}
                detection={detection}
                disabled={isSaving}
                onConfirm={(reviewDraft) => confirmDetection(detection, reviewDraft)}
                onReject={() => rejectDetection(detection)}
              />
            ))}
          </View>
        ) : null}
      </Card>
    </AppShell>
  );
}

function DetectionCard({
  catalogProducts,
  detection,
  disabled,
  onConfirm,
  onReject,
}: {
  catalogProducts: CatalogProduct[];
  detection: ProductDetectionCandidate;
  disabled: boolean;
  onConfirm: (reviewDraft: ProductReviewDraft) => void;
  onReject: () => void;
}) {
  const matchedProduct = catalogProducts.find((product) => product.id === detection.matchedProductId);
  const isResolved = detection.status === 'confirmed' || detection.status === 'rejected';
  const initialBrand = matchedProduct?.brand?.name ?? detection.detectedBrand ?? '';
  const initialProductName = matchedProduct?.name ?? detection.detectedProductName ?? '';
  const initialDescription = matchedProduct?.description ?? '';
  const initialIngredients = useMemo(
    () =>
      matchedProduct?.ingredients
        .map((ingredient) => ingredient.ingredient?.name)
        .filter((ingredient): ingredient is string => Boolean(ingredient)) ?? [],
    [matchedProduct?.ingredients]
  );
  const [brandDraft, setBrandDraft] = useState(initialBrand);
  const [productNameDraft, setProductNameDraft] = useState(initialProductName);
  const [descriptionDraft, setDescriptionDraft] = useState(initialDescription);
  const [ingredientDrafts, setIngredientDrafts] = useState(initialIngredients);
  const [newIngredientDraft, setNewIngredientDraft] = useState('');
  const [routineTiming, setRoutineTiming] = useState<WardrobeRoutineTiming>('either');
  const [frequency, setFrequency] = useState<WardrobeFrequency>('daily');
  const [routineRole, setRoutineRole] = useState<WardrobeRoutineRole>(
    toWardrobeRoutineRole(matchedProduct?.category)
  );
  const [avoidWhenIrritated, setAvoidWhenIrritated] = useState(false);

  useEffect(() => {
    setBrandDraft(initialBrand);
    setProductNameDraft(initialProductName);
    setDescriptionDraft(initialDescription);
    setIngredientDrafts(initialIngredients);
    setRoutineRole(toWardrobeRoutineRole(matchedProduct?.category));
  }, [initialBrand, initialDescription, initialIngredients, initialProductName, matchedProduct?.category]);

  function addIngredientDraft() {
    const normalizedIngredient = newIngredientDraft.trim();

    if (!normalizedIngredient) {
      return;
    }

    setIngredientDrafts((current) =>
      current.some((ingredient) => ingredient.toLowerCase() === normalizedIngredient.toLowerCase())
        ? current
        : [...current, normalizedIngredient]
    );
    setNewIngredientDraft('');
  }

  const reviewIngredients = newIngredientDraft.trim()
    ? [...ingredientDrafts, newIngredientDraft.trim()]
    : ingredientDrafts;
  const canAccept =
    Boolean(brandDraft.trim()) &&
    Boolean(productNameDraft.trim()) &&
    !disabled &&
    !isResolved;

  return (
    <View style={[styles.detectionCard, isResolved && styles.resolvedDetectionCard]}>
      <View style={styles.candidateHeader}>
        <View style={styles.candidateHeading}>
          <SubstrateText variant="title">{brandDraft || 'Unknown brand'}</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {productNameDraft || 'Unknown product'}
          </SubstrateText>
        </View>
        <View style={styles.confidenceChip}>
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            Confidence {formatConfidence(detection.confidence) ?? 'N/A'}
          </SubstrateText>
        </View>
      </View>

      <View style={styles.candidateFields}>
        <View style={[styles.fieldGroup, styles.editableFieldGroup]}>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Brand
          </SubstrateText>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            editable={!disabled && !isResolved}
            onChangeText={setBrandDraft}
            placeholder="Brand"
            placeholderTextColor={Colors.light.textMuted}
            style={[styles.input, styles.candidateInput]}
            value={brandDraft}
          />
        </View>

        <View style={[styles.fieldGroup, styles.editableFieldGroup]}>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Product
          </SubstrateText>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            editable={!disabled && !isResolved}
            onChangeText={setProductNameDraft}
            placeholder="Product"
            placeholderTextColor={Colors.light.textMuted}
            style={[styles.input, styles.candidateInput]}
            value={productNameDraft}
          />
        </View>
      </View>

      <View style={styles.candidateDetails}>
        <View style={styles.fieldGroup}>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Description
          </SubstrateText>
          <TextInput
            autoCapitalize="sentences"
            autoCorrect
            editable={!disabled && !isResolved}
            multiline
            onChangeText={setDescriptionDraft}
            placeholder="Add a short product description"
            placeholderTextColor={Colors.light.textMuted}
            style={[styles.input, styles.noteInput, styles.candidateInput]}
            textAlignVertical="top"
            value={descriptionDraft}
          />
        </View>

        <View style={styles.fieldGroup}>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Ingredients
          </SubstrateText>
          {ingredientDrafts.length ? (
            <View style={styles.ingredientChipGroup}>
              {ingredientDrafts.map((ingredient, index) => {
                const chipStyle = getIngredientChipStyle(ingredient, index);

                return (
                  <Pressable
                    key={`${ingredient}-${index}`}
                    accessibilityRole="button"
                    disabled={disabled || isResolved}
                    onPress={() =>
                      setIngredientDrafts((current) =>
                        current.filter((_, currentIndex) => currentIndex !== index)
                      )
                    }
                    style={[
                      styles.editableIngredientChip,
                      { backgroundColor: chipStyle.backgroundColor, borderColor: chipStyle.borderColor },
                      (disabled || isResolved) && styles.disabled,
                    ]}>
                    <SubstrateText variant="small" color={chipStyle.color}>
                      {ingredient} x
                    </SubstrateText>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              No ingredients yet.
            </SubstrateText>
          )}
          <View style={styles.addIngredientRow}>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              editable={!disabled && !isResolved}
              onChangeText={setNewIngredientDraft}
              onSubmitEditing={addIngredientDraft}
              placeholder="Add ingredient"
              placeholderTextColor={Colors.light.textMuted}
              returnKeyType="done"
              style={[styles.input, styles.addIngredientInput]}
              value={newIngredientDraft}
            />
            <Pressable
              accessibilityRole="button"
              disabled={disabled || isResolved}
              onPress={addIngredientDraft}
              style={[styles.smallButton, (disabled || isResolved) && styles.disabled]}>
              <SubstrateText variant="small" color={Colors.light.accentDeep}>
                Add
              </SubstrateText>
            </Pressable>
          </View>
        </View>
      </View>

      <WardrobeMetadataControls
        avoidWhenIrritated={avoidWhenIrritated}
        disabled={disabled || isResolved}
        frequency={frequency}
        routineRole={routineRole}
        routineTiming={routineTiming}
        onChange={(updates) => {
          if (updates.routineTiming !== undefined) {
            setRoutineTiming(updates.routineTiming);
          }
          if (updates.frequency !== undefined) {
            setFrequency(updates.frequency);
          }
          if (updates.routineRole !== undefined) {
            setRoutineRole(updates.routineRole);
          }
          if (updates.avoidWhenIrritated !== undefined) {
            setAvoidWhenIrritated(updates.avoidWhenIrritated);
          }
        }}
      />

      <View style={styles.candidateActions}>
        <Pressable accessibilityRole="button" disabled={disabled || isResolved} onPress={onReject} style={styles.secondaryButton}>
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            Reject
          </SubstrateText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!canAccept}
          onPress={() =>
            onConfirm({
              brand: brandDraft,
              description: descriptionDraft,
              ingredients: reviewIngredients,
              metadata: {
                routineTiming,
                frequency,
                routineRole,
                avoidWhenIrritated,
              },
              productName: productNameDraft,
            })
          }
          style={[styles.acceptButton, !canAccept && styles.disabled]}>
          <SubstrateText variant="small" color="#FFFFFF">
            Accept
          </SubstrateText>
        </Pressable>
      </View>
    </View>
  );
}

function LoadingPrimaryButton({ label }: { label: string }) {
  return (
    <View style={styles.loadingPrimaryButton}>
      <ActivityIndicator color="#FFFFFF" size="small" />
      <SubstrateText variant="small" color="#FFFFFF">
        {label}
      </SubstrateText>
    </View>
  );
}

function WardrobeMetadataControls({
  avoidWhenIrritated,
  compact,
  disabled,
  frequency,
  onChange,
  routineRole,
  routineTiming,
}: {
  avoidWhenIrritated: boolean;
  compact?: boolean;
  disabled: boolean;
  frequency: WardrobeFrequency;
  onChange: (updates: WardrobeMetadataInput) => void;
  routineRole: WardrobeRoutineRole;
  routineTiming: WardrobeRoutineTiming;
}) {
  return (
    <View style={[styles.metadataControls, compact && styles.metadataControlsCompact]}>
      <MetadataPillGroup
        disabled={disabled}
        label="Timing"
        options={wardrobeRoutineTimings}
        selected={routineTiming}
        onSelect={(nextTiming) => onChange({ routineTiming: nextTiming })}
      />
      <MetadataPillGroup
        disabled={disabled}
        label="Frequency"
        options={wardrobeFrequencies}
        selected={frequency}
        onSelect={(nextFrequency) => onChange({ frequency: nextFrequency })}
      />
      <MetadataPillGroup
        disabled={disabled}
        label="Role"
        options={wardrobeRoutineRoles}
        selected={routineRole}
        onSelect={(nextRole) => onChange({ routineRole: nextRole })}
      />
      <View style={styles.metadataGroup}>
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          Caution
        </SubstrateText>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: avoidWhenIrritated }}
          disabled={disabled}
          onPress={() => onChange({ avoidWhenIrritated: !avoidWhenIrritated })}
          style={[
            styles.metadataPill,
            avoidWhenIrritated && styles.metadataPillSelected,
            disabled && styles.disabled,
          ]}>
          <SubstrateText
            variant="small"
            color={avoidWhenIrritated ? Colors.light.accentDeep : Colors.light.textMuted}>
            Avoid when irritated
          </SubstrateText>
        </Pressable>
      </View>
    </View>
  );
}

function MetadataPillGroup<T extends string>({
  disabled,
  label,
  onSelect,
  options,
  selected,
}: {
  disabled: boolean;
  label: string;
  onSelect: (value: T) => void;
  options: T[];
  selected: T;
}) {
  return (
    <View style={styles.metadataGroup}>
      <SubstrateText variant="small" color={Colors.light.textMuted}>
        {label}
      </SubstrateText>
      <View style={styles.metadataPillRow}>
        {options.map((option) => {
          const isSelected = selected === option;

          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              disabled={disabled}
              onPress={() => onSelect(option)}
              style={[styles.metadataPill, isSelected && styles.metadataPillSelected, disabled && styles.disabled]}>
              <SubstrateText variant="small" color={isSelected ? Colors.light.accentDeep : Colors.light.textMuted}>
                {formatCatalogLabel(option)}
              </SubstrateText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function WardrobeCard({
  item,
  onPress,
}: {
  item: UserWardrobeItem;
  onPress: () => void;
}) {
  const product = item.product;

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.productCard}>
      <View style={styles.productHeader}>
        <View style={styles.productTitle}>
          <SubstrateText variant="title">{product?.brand?.name ?? 'Catalog brand'}</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {product?.name ?? 'Catalog product'}
          </SubstrateText>
        </View>
        <View style={styles.statusSummaryPill}>
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            {formatCatalogLabel(item.status)}
          </SubstrateText>
        </View>
      </View>
    </Pressable>
  );
}

function WardrobeDetailsDrawer({
  disabled,
  item,
  onClose,
  onAddIngredient,
  onRemove,
  onSave,
}: {
  disabled: boolean;
  item: UserWardrobeItem | null;
  onClose: () => void;
  onAddIngredient: (ingredientName: string) => Promise<boolean>;
  onRemove: () => void;
  onSave: (updates: WardrobeMetadataInput) => void;
}) {
  const product = item?.product;
  const [ingredientDraft, setIngredientDraft] = useState('');

  useEffect(() => {
    setIngredientDraft('');
  }, [item?.id]);

  if (!item) {
    return null;
  }

  async function addIngredient() {
    const saved = await onAddIngredient(ingredientDraft);

    if (saved) {
      setIngredientDraft('');
    }
  }

  return (
    <Modal animationType="slide" transparent visible={Boolean(item)} onRequestClose={onClose}>
      <View style={styles.drawerOverlay}>
        <Pressable accessibilityLabel="Close product details" style={styles.drawerBackdrop} onPress={onClose} />
        <ScrollView
          style={styles.drawerSheet}
          contentContainerStyle={styles.drawerPanel}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.drawerHandle} />
          <View style={styles.productHeader}>
            <View style={styles.productTitle}>
              <SubstrateText variant="title">{product?.brand?.name ?? 'Catalog brand'}</SubstrateText>
              <SubstrateText variant="small" color={Colors.light.textMuted}>
                {product?.name ?? 'Catalog product'}
              </SubstrateText>
            </View>
            <Pressable
              accessibilityLabel="Remove product"
              accessibilityRole="button"
              disabled={disabled}
              onPress={onRemove}
              style={[styles.iconButton, disabled && styles.disabled]}>
              <Trash2 color={Colors.light.textMuted} size={14} strokeWidth={2} />
            </Pressable>
          </View>

          <View style={styles.drawerSection}>
            <SubstrateText variant="section">Ingredients</SubstrateText>
            {product?.ingredients.length ? (
              <View style={styles.ingredientChipGroup}>
                {product.ingredients.map((productIngredient, index) => {
                  const ingredientName = productIngredient.ingredient?.name;

                  if (!ingredientName) {
                    return null;
                  }

                  const chipStyle = getIngredientChipStyle(ingredientName, index);

                  return (
                    <View
                      key={`${productIngredient.ingredient_id}-${index}`}
                      style={[
                        styles.editableIngredientChip,
                        { backgroundColor: chipStyle.backgroundColor, borderColor: chipStyle.borderColor },
                      ]}>
                      <SubstrateText variant="tag" color={chipStyle.color}>
                        {ingredientName}
                      </SubstrateText>
                    </View>
                  );
                })}
              </View>
            ) : (
              <SubstrateText variant="small" color={Colors.light.textMuted}>
                No ingredients yet.
              </SubstrateText>
            )}

            <View style={styles.addIngredientRow}>
              <TextInput
                editable={!disabled}
                onChangeText={setIngredientDraft}
                onSubmitEditing={addIngredient}
                placeholder="Add ingredient"
                placeholderTextColor={Colors.light.textMuted}
                returnKeyType="done"
                style={[styles.input, styles.addIngredientInput]}
                value={ingredientDraft}
              />
              <Pressable
                accessibilityRole="button"
                disabled={disabled || !ingredientDraft.trim()}
                onPress={addIngredient}
                style={[styles.smallButton, styles.addButton, (disabled || !ingredientDraft.trim()) && styles.disabled]}>
                <SubstrateText variant="small" color={Colors.light.accentDeep}>
                  Add
                </SubstrateText>
              </Pressable>
            </View>
          </View>

          <View style={styles.drawerSection}>
            <SubstrateText variant="section">Status</SubstrateText>
            <View style={styles.pillGroup}>
              {wardrobeStatuses.map((status) => (
                <Pressable
                  key={status}
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.status === status }}
                  disabled={disabled}
                  onPress={() => onSave({ status })}
                  style={[styles.statusPill, item.status === status && styles.statusPillSelected]}>
                  <SubstrateText
                    variant="small"
                    color={item.status === status ? Colors.light.accentDeep : Colors.light.textMuted}>
                    {formatCatalogLabel(status)}
                  </SubstrateText>
                </Pressable>
              ))}
            </View>
          </View>

          <WardrobeMetadataControls
            avoidWhenIrritated={item.avoid_when_irritated}
            disabled={disabled}
            frequency={item.frequency}
            routineRole={item.routine_role}
            routineTiming={item.routine_timing}
            compact
            onChange={onSave}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

function formatCatalogLabel(value: string) {
  if (value === 'am') {
    return 'AM';
  }
  if (value === 'pm') {
    return 'PM';
  }
  if (value === 'spf') {
    return 'SPF';
  }

  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatConfidence(confidence?: number) {
  return typeof confidence === 'number' ? `${Math.round(confidence * 100)}%` : undefined;
}

function toProductCategory(metadata?: ProductReviewDraft['metadata']): CatalogProduct['category'] {
  return metadata?.routineRole ?? 'other';
}

function toWardrobeRoutineRole(category?: CatalogProduct['category']): WardrobeRoutineRole {
  if (
    category === 'cleanser' ||
    category === 'serum' ||
    category === 'moisturizer' ||
    category === 'spf' ||
    category === 'treatment' ||
    category === 'device'
  ) {
    return category;
  }

  return 'other';
}

function getIngredientChipStyle(ingredient: string, index: number) {
  const paletteIndex =
    Array.from(ingredient).reduce((total, character) => total + character.charCodeAt(0), index) %
    ingredientChipPalette.length;

  return ingredientChipPalette[paletteIndex];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function upsertCatalogProduct(products: CatalogProduct[], nextProduct: CatalogProduct) {
  const existingIndex = products.findIndex((product) => product.id === nextProduct.id);

  if (existingIndex === -1) {
    return [...products, nextProduct].sort((a, b) => a.name.localeCompare(b.name));
  }

  return products.map((product) => (product.id === nextProduct.id ? nextProduct : product));
}

function toSelectedProductImage(asset: ImagePicker.ImagePickerAsset): SelectedProductImage | null {
  if (!asset.base64) {
    return null;
  }

  const mimeType = asset.mimeType ?? inferImageMimeType(asset.fileName, asset.uri);

  return {
    uri: asset.uri,
    dataUrl: `data:${mimeType};base64,${asset.base64}`,
  };
}

function inferImageMimeType(fileName: string | null | undefined, uri: string) {
  const source = `${fileName ?? ''} ${uri}`.toLowerCase();

  if (source.includes('.png')) {
    return 'image/png';
  }
  if (source.includes('.webp')) {
    return 'image/webp';
  }
  if (source.includes('.heic')) {
    return 'image/heic';
  }
  if (source.includes('.heif')) {
    return 'image/heif';
  }

  return 'image/jpeg';
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  card: {
    gap: Spacing.three,
  },
  footerButton: {
    alignSelf: 'stretch',
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.border,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.two,
  },
  noticeCard: {
    backgroundColor: Colors.light.successSoft,
  },
  errorCard: {
    gap: Spacing.one,
    backgroundColor: Colors.light.blush,
  },
  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.two,
  },
  previewWrap: {
    gap: Spacing.two,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundSelected,
    overflow: 'hidden',
  },
  analyzeButton: {
    alignSelf: 'stretch',
  },
  loadingPrimaryButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  detectionCard: {
    gap: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.accentSoft,
    backgroundColor: '#FFFDFB',
    padding: Spacing.three,
  },
  resolvedDetectionCard: {
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundSelected,
  },
  candidateHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  candidateHeading: {
    flex: 1,
    gap: Spacing.half,
  },
  confidenceChip: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundSelected,
    paddingHorizontal: Spacing.two,
    flexShrink: 0,
  },
  candidateFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  fieldGroup: {
    gap: Spacing.one,
  },
  editableFieldGroup: {
    flexBasis: 240,
    flexGrow: 1,
  },
  candidateInput: {
    minHeight: 48,
    backgroundColor: '#FFFFFF',
  },
  candidateDetails: {
    gap: Spacing.three,
    borderRadius: 12,
    backgroundColor: '#FBF8F6',
    padding: Spacing.three,
  },
  ingredientChipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  editableIngredientChip: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  addIngredientRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  addIngredientInput: {
    flex: 1,
    minHeight: 42,
    backgroundColor: '#FFFFFF',
  },
  candidateActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metadataControls: {
    gap: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FFFDFB',
    padding: Spacing.three,
  },
  metadataControlsCompact: {
    gap: Spacing.two,
    backgroundColor: '#FBF8F6',
    padding: Spacing.two,
  },
  metadataGroup: {
    gap: Spacing.one,
  },
  metadataPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  metadataPill: {
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.border,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.two,
  },
  metadataPillSelected: {
    borderColor: Colors.light.accentSoft,
    backgroundColor: Colors.light.backgroundSelected,
  },
  acceptButton: {
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    backgroundColor: Colors.light.accentDeep,
    paddingHorizontal: Spacing.two,
  },
  sectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FBF8F6',
    color: Colors.light.text,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '400',
    paddingHorizontal: Spacing.three,
  },
  noteInput: {
    minHeight: 80,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  emptyState: {
    gap: Spacing.one,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FFFDFB',
    padding: Spacing.three,
  },
  productList: {
    gap: Spacing.two,
  },
  productCard: {
    gap: Spacing.two,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FFFDFB',
    padding: Spacing.three,
  },
  productHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  productTitle: {
    flex: 1,
    gap: Spacing.half,
  },
  pillGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  readOnlyPill: {
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.border,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.two,
  },
  statusSummaryPill: {
    minHeight: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.accentSoft,
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundSelected,
    paddingHorizontal: Spacing.two,
  },
  drawerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(38, 24, 32, 0.22)',
  },
  drawerSheet: {
    width: '100%',
    maxHeight: '72%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: Colors.light.background,
  },
  drawerPanel: {
    gap: Spacing.three,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
  },
  drawerHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.light.border,
  },
  drawerSection: {
    gap: Spacing.two,
  },
  statusPill: {
    minHeight: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FBF8F6',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  statusPillSelected: {
    borderColor: Colors.light.accentSoft,
    backgroundColor: Colors.light.backgroundSelected,
  },
  smallButton: {
    minHeight: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.two,
  },
  iconButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    minWidth: 88,
  },
  disabled: {
    opacity: 0.64,
  },
});
