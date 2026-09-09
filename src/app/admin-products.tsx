import { Link, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  AppShell,
  BackLink,
  Card,
  PrimaryButton,
  ScreenHeader,
  SubstrateText,
} from '@/components/substrate-ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { isCatalogAdmin } from '@/lib/admin';
import { useAuth } from '@/lib/auth-context';
import {
  archiveProduct,
  createBrand,
  createIngredient,
  listBrands,
  listCatalogProducts,
  listIngredients,
  productCategories,
  productStatuses,
  type CatalogBrand,
  type CatalogIngredient,
  type CatalogProduct,
  type ProductIngredientInput,
} from '@/services/catalog';
import { CatalogEvidenceEditor, CatalogHistory, CatalogReviewPanel } from '@/components/catalog-evidence-editor';
import { listCatalogRecords, listCatalogReviews, restoreProduct, saveCmsProduct, type CatalogRecord, type CatalogReview } from '@/services/catalog-cms';
import type { ProductCategory, ProductStatus } from '@/types/database';

type FormIngredient = {
  ingredientId: string;
  ingredientName: string;
  ingredientOrder: string;
  notes: string;
  concentration?: number | null;
  concentrationUnit?: string | null;
};

type ProductForm = {
  id?: string;
  brandId: string;
  newBrandName: string;
  name: string;
  category: ProductCategory;
  description: string;
  imageUrl: string;
  barcode: string;
  upc: string;
  aliasesText: string;
  status: ProductStatus;
  ingredients: FormIngredient[];
  catalogVisible: boolean;
  expectedUpdatedAt?: string;
  record?: CatalogRecord | null;
};

const emptyForm: ProductForm = {
  brandId: '',
  newBrandName: '',
  name: '',
  category: 'serum',
  description: '',
  imageUrl: '',
  barcode: '',
  upc: '',
  aliasesText: '',
  status: 'needs_review',
  ingredients: [],
  catalogVisible: false,
};

export default function AdminProductsScreen() {
  const { user } = useAuth();
  const canManageCatalog = isCatalogAdmin(user);
  const [records, setRecords] = useState<CatalogRecord[]>([]);
  const [reviews, setReviews] = useState<CatalogReview[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const [availability, setAvailability] = useState('all');
  const [pageSize, setPageSize] = useState(20);
  const [brandSearch, setBrandSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [ingredients, setIngredients] = useState<CatalogIngredient[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProductCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ProductStatus>('all');
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [productToArchive, setProductToArchive] = useState<CatalogProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadCatalog() {
        if (!canManageCatalog) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setErrorMessage('');

        const [brandResult, ingredientResult, productResult, recordResult, reviewResult] = await Promise.all([
          listBrands(),
          listIngredients(),
          listCatalogProducts({ includeArchived: true, includeUnpublished: true }),
          listCatalogRecords(),
          listCatalogReviews(),
        ]);

        if (!isMounted) {
          return;
        }

        if (brandResult.error || ingredientResult.error || productResult.error || recordResult.error || reviewResult.error) {
          setErrorMessage(
            brandResult.error?.message ??
              ingredientResult.error?.message ??
              productResult.error?.message ??
              recordResult.error?.message ??
              reviewResult.error?.message ??
              'Catalog could not be loaded.'
          );
        } else {
          setBrands(brandResult.data ?? []);
          setIngredients(ingredientResult.data ?? []);
          setProducts(productResult.data ?? []);
          setRecords(recordResult.data ?? []);
          setReviews(reviewResult.data ?? []);
        }

        setIsLoading(false);
      }

      loadCatalog().catch(() => {
        if (isMounted) { setErrorMessage('Could not connect to the catalog. Reload to try again.'); setIsLoading(false); }
      });

      return () => {
        isMounted = false;
      };
    // Explicit refreshes rerun the same focus load after database mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canManageCatalog, reloadKey])
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          product.name.toLowerCase().includes(query) ||
          product.brand?.name.toLowerCase().includes(query) ||
          records.find((r) => r.product_id === product.id)?.source_id.toLowerCase().includes(query) ||
          product.aliases.some((alias) => alias.toLowerCase().includes(query));
        const matchesBrand = brandFilter === 'all' || product.brand_id === brandFilter;
        const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
        const matchesStatus = statusFilter === 'all' || product.status === statusFilter;

        const matchesAvailability = availability === 'archived' ? !!product.archived_at : !product.archived_at && (availability === 'all' || (availability === 'published' ? product.catalog_visible : !product.catalog_visible));
        return matchesSearch && matchesBrand && matchesCategory && matchesStatus && matchesAvailability;
      }),
    [availability, brandFilter, categoryFilter, products, records, search, statusFilter]
  );

  const ingredientMatches = useMemo(() => {
    const query = ingredientSearch.trim().toLowerCase();
    const attachedIds = new Set(form.ingredients.map((ingredient) => ingredient.ingredientId));

    return ingredients
      .filter((ingredient) => !attachedIds.has(ingredient.id))
      .filter((ingredient) => !query || ingredient.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [form.ingredients, ingredientSearch, ingredients]);

  function updateForm(next: Partial<ProductForm>) {
    setForm((current) => ({ ...current, ...next }));
  }

  function editProduct(product: CatalogProduct) {
    if (isSaving) return;
    setShowEditor(true);
    setBrandSearch(product.brand?.name ?? '');
    setMessage('');
    setErrorMessage('');
    setProductToArchive(null);
    setForm({
      id: product.id,
      expectedUpdatedAt: product.updated_at,
      catalogVisible: product.catalog_visible,
      record: records.find((r) => r.product_id === product.id) ?? null,
      brandId: product.brand_id,
      newBrandName: '',
      name: product.name,
      category: product.category,
      description: product.description ?? '',
      imageUrl: product.image_url ?? '',
      barcode: product.barcode ?? '',
      upc: product.upc ?? '',
      aliasesText: product.aliases.join(', '),
      status: product.status,
      ingredients: product.ingredients.map((item) => ({
        ingredientId: item.ingredient_id,
        concentration: item.concentration,
        concentrationUnit: item.concentration_unit,
        ingredientName: item.ingredient?.name ?? 'Ingredient',
        ingredientOrder: item.ingredient_order?.toString() ?? '',
        notes: item.notes ?? '',
      })),
    });
  }

  function resetForm() {
    if (isSaving) return;
    setShowEditor(false);
    setBrandSearch('');
    setForm(emptyForm);
    setIngredientSearch('');
    setProductToArchive(null);
  }

  function addExistingIngredient(ingredient: CatalogIngredient) {
    setForm((current) => ({
      ...current,
      ingredients: [
        ...current.ingredients,
        {
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          ingredientOrder: String(current.ingredients.length + 1),
          notes: '',
        },
      ],
    }));
    setIngredientSearch('');
  }

  function removeIngredient(ingredientId: string) {
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients.filter((ingredient) => ingredient.ingredientId !== ingredientId),
    }));
  }

  function updateIngredientRow(ingredientId: string, next: Partial<FormIngredient>) {
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient) =>
        ingredient.ingredientId === ingredientId ? { ...ingredient, ...next } : ingredient
      ),
    }));
  }

  async function addNewIngredient() {
    const name = ingredientSearch.trim();

    if (!name) {
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    const created = await createIngredient(name);
    setIsSaving(false);
    const createdIngredient = created.data;

    if (created.error || !createdIngredient) {
      setErrorMessage(created.error?.message ?? 'Ingredient could not be added.');
      return;
    }

    setIngredients((current) => upsertById<CatalogIngredient>(current, createdIngredient));
    addExistingIngredient(createdIngredient);
  }

  async function handleSaveProduct() {
    if (isSaving) return;
    if (!form.name.trim()) {
      setErrorMessage('Add a product name.');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    let brandId = form.brandId;

    if (!brandId && form.newBrandName.trim()) {
      const brand = await createBrand(form.newBrandName);
      const createdBrand = brand.data;

      if (brand.error || !createdBrand) {
        setIsSaving(false);
        setErrorMessage(brand.error?.message ?? 'Brand could not be added.');
        return;
      }

      brandId = createdBrand.id;
      setBrands((current) => upsertById<CatalogBrand>(current, createdBrand));
    }

    if (!brandId) {
      setIsSaving(false);
      setErrorMessage('Select an existing brand or add a new one.');
      return;
    }

    try {
    const saved = await saveCmsProduct({
      id: form.id,
      catalogVisible: form.catalogVisible,
      expectedUpdatedAt: form.expectedUpdatedAt,
      record: form.record,
      brandId,
      name: form.name,
      category: form.category,
      description: form.description,
      imageUrl: form.imageUrl,
      barcode: form.barcode,
      upc: form.upc,
      aliases: splitAliases(form.aliasesText),
      status: form.status,
      ingredients: form.ingredients.map(toProductIngredientInput),
    });

    setIsSaving(false);
    const savedProduct = saved.data;

    if (saved.error || !savedProduct) {
      setErrorMessage(saved.error?.message ?? 'Product could not be saved.');
      return;
    }

    setProducts((current) => upsertById<CatalogProduct>(current, savedProduct));
    setMessage(`${savedProduct.name} saved.`);
    setShowEditor(false);
    setForm(emptyForm);
    setReloadKey((value) => value + 1);
    } catch {
      setErrorMessage('Connection failed. Your edits are still here. Reload before retrying if the save may have completed.');
    } finally { setIsSaving(false); }
  }

  async function confirmArchiveProduct() {
    if (!productToArchive) {
      return;
    }

    setIsSaving(true);
    setMessage('');
    setErrorMessage('');

    const archived = await archiveProduct(productToArchive.id);
    setIsSaving(false);

    if (archived.error) {
      setErrorMessage(archived.error.message);
      return;
    }

    setProducts((current) => current.map((product) => product.id === archived.data?.id ? { ...product, ...archived.data } : product));
    setMessage(`${productToArchive.name} archived.`);
    setProductToArchive(null);
    if (form.id === productToArchive.id) {
      resetForm();
    }
  }

  return (
    <AppShell>
      <BackLink href={'/profile' as Href} />
      <ScreenHeader
        eyebrow="Admin"
        title="Product CMS"
        body="Manage products in the app database, review source evidence, and choose what appears in the catalog."
      />

      {!canManageCatalog ? (
        <Card style={styles.errorCard}>
          <SubstrateText variant="section">Admin access required</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            The product catalog admin is only available to accounts with catalog admin access.
          </SubstrateText>
          <Link href={'/profile' as Href} asChild>
            <Pressable accessibilityRole="button" style={styles.secondaryButton}>
              <SubstrateText variant="small" color={Colors.light.accentDeep}>
                Back to Profile
              </SubstrateText>
            </Pressable>
          </Link>
        </Card>
      ) : null}

      {canManageCatalog && isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.light.accent} />
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            Loading catalog
          </SubstrateText>
        </View>
      ) : null}

      {canManageCatalog && message ? (
        <Card style={styles.noticeCard}>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {message}
          </SubstrateText>
        </Card>
      ) : null}

      {canManageCatalog && errorMessage ? (
        <Card style={styles.errorCard}>
          <SubstrateText variant="section">Catalog needs attention</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            {errorMessage}
          </SubstrateText>
        </Card>
      ) : null}

      {canManageCatalog && !showEditor ? (
      <Card style={styles.card}>
        <View style={styles.sectionHeader}>
          <View>
            <SubstrateText variant="section">Products</SubstrateText>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              {filteredProducts.length} products · {records.length} source records
            </SubstrateText>
          </View>
          <Pressable accessibilityRole="button" onPress={() => { resetForm(); setShowEditor(true); }} style={styles.smallButton}>
            <SubstrateText variant="small" color={Colors.light.accentDeep}>
              New
            </SubstrateText>
          </Pressable>
        </View>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setSearch}
          placeholder="Search product, brand, alias, or SKP ID"
          placeholderTextColor={Colors.light.textMuted}
          style={styles.input}
          value={search}
        />

        <FilterGroup label="Availability">
          {['all', 'published', 'unpublished', 'archived'].map((value) => <FilterPill key={value} label={value === 'all' ? 'All active' : formatCatalogLabel(value)} selected={availability === value} onPress={() => setAvailability(value)} />)}
        </FilterGroup>
        <TextInput accessibilityLabel="Find brand" placeholder="Find a brand" style={styles.input} value={brandSearch} onChangeText={setBrandSearch} />
        <FilterGroup label="Brand">
          <FilterPill label="All" selected={brandFilter === 'all'} onPress={() => setBrandFilter('all')} />
          {brands.filter((brand) => brand.id === form.brandId || brand.id === brandFilter || brand.name.toLowerCase().includes(brandSearch.toLowerCase())).slice(0, 12).map((brand) => (
            <FilterPill
              key={brand.id}
              label={brand.name}
              selected={brandFilter === brand.id}
              onPress={() => setBrandFilter(brand.id)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Category">
          <FilterPill label="All" selected={categoryFilter === 'all'} onPress={() => setCategoryFilter('all')} />
          {productCategories.map((category) => (
            <FilterPill
              key={category}
              label={formatCatalogLabel(category)}
              selected={categoryFilter === category}
              onPress={() => setCategoryFilter(category)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Status">
          <FilterPill label="All" selected={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
          {productStatuses.map((status) => (
            <FilterPill
              key={status}
              label={formatCatalogLabel(status)}
              selected={statusFilter === status}
              onPress={() => setStatusFilter(status)}
            />
          ))}
        </FilterGroup>

        <View style={styles.productList}>
          {filteredProducts.slice(0, pageSize).map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onArchive={async () => {
                if (!product.archived_at) { setProductToArchive(product); return; }
                const result = await restoreProduct(product.id);
                if (result.error) setErrorMessage(result.error.message);
                else { setMessage(`${product.name} restored as unpublished.`); setReloadKey((value) => value + 1); }
              }}
              onEdit={() => editProduct(product)}
            />
          ))}
        </View>
        {filteredProducts.length > pageSize ? <Pressable accessibilityRole="button" onPress={() => setPageSize(pageSize + 20)} style={styles.smallButton}><SubstrateText variant="small">Show 20 more</SubstrateText></Pressable> : null}
        <Pressable accessibilityRole="button" onPress={() => setShowReviews(!showReviews)} style={styles.smallButton}><SubstrateText variant="small">{showReviews ? 'Hide' : 'Open'} review queue</SubstrateText></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setShowResearch(!showResearch)} style={styles.smallButton}><SubstrateText variant="small">{showResearch ? 'Hide' : 'View'} non-product source records</SubstrateText></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setReloadKey((value) => value + 1)} style={styles.smallButton}><SubstrateText variant="small">Reload database</SubstrateText></Pressable>
      </Card>
      ) : null}

      {canManageCatalog && showEditor ? (
      <Card style={styles.card}>
        <View style={styles.sectionHeader}>
          <View>
            <SubstrateText variant="section">{form.id ? 'Edit product' : 'Create product'}</SubstrateText>
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Canonical product details are shared across users.
            </SubstrateText>
          </View>
          {showEditor ? (
            <Pressable accessibilityRole="button" onPress={resetForm} style={styles.smallButton}>
              <SubstrateText variant="small" color={Colors.light.accentDeep}>
                Cancel
              </SubstrateText>
            </Pressable>
          ) : null}
        </View>

        <Field label="Brand">
          <TextInput accessibilityLabel="Find product brand" placeholder="Find a brand" style={styles.input} value={brandSearch} onChangeText={setBrandSearch} />
          <View style={styles.pillGroup}>
            {brands.filter((brand) => brand.id === form.brandId || brand.id === brandFilter || brand.name.toLowerCase().includes(brandSearch.toLowerCase())).slice(0, 12).map((brand) => (
              <FilterPill
                key={brand.id}
                label={brand.name}
                selected={form.brandId === brand.id}
                onPress={() => updateForm({ brandId: brand.id, newBrandName: '' })}
              />
            ))}
          </View>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={(newBrandName) => updateForm({ newBrandName, brandId: '' })}
            placeholder="Or add a new brand"
            placeholderTextColor={Colors.light.textMuted}
            style={styles.input}
            value={form.newBrandName}
          />
        </Field>

        <View style={styles.twoColumn}>
          <View style={styles.columnField}>
            <Field label="Product name">
              <TextInput
                autoCapitalize="words"
                autoCorrect
                onChangeText={(name) => updateForm({ name })}
                placeholder="C E Ferulic"
                placeholderTextColor={Colors.light.textMuted}
                style={styles.input}
                value={form.name}
              />
            </Field>
          </View>
          <View style={styles.columnField}>
            <Field label="Category">
              <View style={styles.pillGroup}>
                {productCategories.map((category) => (
                  <FilterPill
                    key={category}
                    label={formatCatalogLabel(category)}
                    selected={form.category === category}
                    onPress={() => updateForm({ category })}
                  />
                ))}
              </View>
            </Field>
          </View>
        </View>

        <Field label="Description">
          <TextInput
            autoCapitalize="sentences"
            autoCorrect
            multiline
            onChangeText={(description) => updateForm({ description })}
            placeholder="Short admin-facing product description"
            placeholderTextColor={Colors.light.textMuted}
            style={[styles.input, styles.textArea]}
            textAlignVertical="top"
            value={form.description}
          />
        </Field>

        <View style={styles.twoColumn}>
          <View style={styles.columnField}>
            <Field label="Image URL">
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                inputMode="url"
                onChangeText={(imageUrl) => updateForm({ imageUrl })}
                placeholder="https://..."
                placeholderTextColor={Colors.light.textMuted}
                style={styles.input}
                value={form.imageUrl}
              />
            </Field>
          </View>
          <View style={styles.columnField}>
            <Field label="Verification status">
              <View style={styles.pillGroup}>
                {productStatuses.map((status) => (
                  <FilterPill
                    key={status}
                    label={formatCatalogLabel(status)}
                    selected={form.status === status}
                    onPress={() => updateForm({ status })}
                  />
                ))}
              </View>
            </Field>
          </View>
        </View>

        <View style={styles.twoColumn}>
          <View style={styles.columnField}>
            <Field label="Barcode">
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(barcode) => updateForm({ barcode })}
                placeholder="Optional barcode"
                placeholderTextColor={Colors.light.textMuted}
                style={styles.input}
                value={form.barcode}
              />
            </Field>
          </View>
          <View style={styles.columnField}>
            <Field label="UPC">
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(upc) => updateForm({ upc })}
                placeholder="Optional UPC"
                placeholderTextColor={Colors.light.textMuted}
                style={styles.input}
                value={form.upc}
              />
            </Field>
          </View>
        </View>

        <Field label="Aliases">
          <TextInput
            autoCapitalize="sentences"
            autoCorrect
            onChangeText={(aliasesText) => updateForm({ aliasesText })}
            placeholder="Comma-separated alternate names"
            placeholderTextColor={Colors.light.textMuted}
            style={styles.input}
            value={form.aliasesText}
          />
        </Field>

        <Field label="Catalog availability">
          <SubstrateText variant="small" color={Colors.light.textMuted}>Publishing makes this product selectable in the app. Verification status and private evidence remain separate.</SubstrateText>
          <View style={styles.pillGroup}>
            <FilterPill label="Unpublished" selected={!form.catalogVisible} onPress={() => updateForm({ catalogVisible: false })} />
            <FilterPill label="Published" selected={form.catalogVisible} onPress={() => updateForm({ catalogVisible: true })} />
          </View>
        </Field>
        {form.id ? <CatalogHistory key={form.id} productId={form.id} sourceId={form.record?.source_id} /> : null}
        {form.record ? <CatalogEvidenceEditor record={form.record} onChange={(record) => updateForm({ record })} /> : null}
        <Field label="Ingredients">
          {form.ingredients.length ? (
            <View style={styles.ingredientList}>
              {form.ingredients.map((ingredient) => (
                <View key={ingredient.ingredientId} style={styles.ingredientRow}>
                  <View style={styles.ingredientCopy}>
                    <SubstrateText variant="small">{ingredient.ingredientName}</SubstrateText>
                    <View style={styles.ingredientMeta}>
                      <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        inputMode="numeric"
                        onChangeText={(ingredientOrder) =>
                          updateIngredientRow(ingredient.ingredientId, { ingredientOrder })
                        }
                        placeholder="Order"
                        placeholderTextColor={Colors.light.textMuted}
                        style={[styles.input, styles.orderInput]}
                        value={ingredient.ingredientOrder}
                      />
                      <TextInput
                        autoCapitalize="sentences"
                        autoCorrect
                        onChangeText={(notes) => updateIngredientRow(ingredient.ingredientId, { notes })}
                        placeholder="Notes"
                        placeholderTextColor={Colors.light.textMuted}
                        style={[styles.input, styles.notesInput]}
                        value={ingredient.notes}
                      />
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => removeIngredient(ingredient.ingredientId)}
                    style={styles.textButton}>
                    <SubstrateText variant="small" color={Colors.light.accentDeep}>
                      Remove
                    </SubstrateText>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <SubstrateText variant="small" color={Colors.light.textMuted}>
              Attach ingredients from the shared ingredient library.
            </SubstrateText>
          )}

          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={setIngredientSearch}
            placeholder="Search or add ingredient"
            placeholderTextColor={Colors.light.textMuted}
            style={styles.input}
            value={ingredientSearch}
          />
          <View style={styles.pillGroup}>
            {ingredientMatches.map((ingredient) => (
              <FilterPill
                key={ingredient.id}
                label={ingredient.name}
                selected={false}
                onPress={() => addExistingIngredient(ingredient)}
              />
            ))}
            {ingredientSearch.trim() ? (
              <FilterPill label={`Add "${ingredientSearch.trim()}"`} selected={false} onPress={addNewIngredient} />
            ) : null}
          </View>
        </Field>

        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={handleSaveProduct}
          style={isSaving && styles.disabled}>
          <PrimaryButton label={isSaving ? 'Saving Product' : form.id ? 'Save Product' : 'Create Product'} />
        </Pressable>
      </Card>
      ) : null}

      {canManageCatalog && !showEditor && showResearch ? <Card style={styles.card}>
        <SubstrateText variant="section">Non-product source records</SubstrateText>
        <SubstrateText variant="small" color={Colors.light.textMuted}>These records are retained for research and resolution to specific products. They are not shopping items.</SubstrateText>
        {records.filter((r) => !r.product_id && `${r.source_id} ${r.fields.product_name}`.toLowerCase().includes(search.toLowerCase())).slice(0, pageSize).map((r) => <View key={r.source_id} style={styles.productCard}>
          <SubstrateText variant="small">{r.source_id} · {r.fields.product_name}</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.textMuted}>{r.entity_type} · {r.fields.review_status}</SubstrateText>
        </View>)}
        <Pressable accessibilityRole="button" onPress={() => setPageSize(pageSize + 20)} style={styles.smallButton}><SubstrateText variant="small">Show more source records</SubstrateText></Pressable>
      </Card> : null}
      {canManageCatalog && (showReviews || !!form.record) ? <CatalogReviewPanel
        key={form.record?.source_id ?? search}
        reviews={reviews.filter((r) => form.record ? `${r.fields.affected_ids}, ${r.fields.product_id}`.split(/[,;]\s*/).includes(form.record.source_id) : JSON.stringify(r.fields).toLowerCase().includes(search.toLowerCase()))}
        onSaved={(review) => setReviews((current) => current.map((r) => r.id === review.id ? review : r))} /> : null}

      {canManageCatalog && productToArchive ? (
        <Card style={styles.confirmCard}>
          <SubstrateText variant="section">Archive {productToArchive.name}?</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            This removes it from active catalog management without breaking future wardrobe references.
          </SubstrateText>
          <View style={styles.confirmActions}>
            <Pressable accessibilityRole="button" onPress={() => setProductToArchive(null)} style={styles.secondaryButton}>
              <SubstrateText variant="small" color={Colors.light.accentDeep}>
                Keep
              </SubstrateText>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={isSaving} onPress={confirmArchiveProduct} style={styles.archiveButton}>
              <SubstrateText variant="small" color="#FFFFFF">
                Archive
              </SubstrateText>
            </Pressable>
          </View>
        </Card>
      ) : null}

      <Link href={'/profile' as Href} asChild>
        <Pressable accessibilityRole="button" style={styles.footerLink}>
          <SubstrateText variant="small" color={Colors.light.accentDeep}>
            Back to Profile
          </SubstrateText>
        </Pressable>
      </Link>
    </AppShell>
  );
}

function ProductCard({
  onArchive,
  onEdit,
  product,
}: {
  onArchive: () => void;
  onEdit: () => void;
  product: CatalogProduct;
}) {
  return (
    <View style={styles.productCard}>
      <View style={styles.productHeader}>
        <View style={styles.productTitle}>
          <SubstrateText variant="section">{product.name}</SubstrateText>
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            {[product.brand?.name, formatCatalogLabel(product.category), formatCatalogLabel(product.status), product.archived_at ? 'Archived' : product.catalog_visible ? 'Published' : 'Unpublished']
              .filter(Boolean)
              .join(' · ')}
          </SubstrateText>
        </View>
        <View style={styles.productActions}>
          <Pressable accessibilityRole="button" onPress={onEdit} style={styles.smallButton}>
            <SubstrateText variant="small" color={Colors.light.accentDeep}>
              Edit
            </SubstrateText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onArchive} style={styles.smallButton}>
            <SubstrateText variant="small" color={Colors.light.accentDeep}>
              {product.archived_at ? 'Restore' : 'Archive'}
            </SubstrateText>
          </Pressable>
        </View>
      </View>
      {product.description ? (
        <SubstrateText variant="small" color={Colors.light.textMuted}>
          {product.description}
        </SubstrateText>
      ) : null}
      <View style={styles.pillGroup}>
        {product.ingredients.length ? (
          product.ingredients.map((item) => (
            <View key={item.id} style={styles.readOnlyPill}>
              <SubstrateText variant="small" color={Colors.light.textMuted}>
                {item.ingredient_order ? `${item.ingredient_order}. ` : ''}
                {item.ingredient?.name ?? 'Ingredient'}
              </SubstrateText>
            </View>
          ))
        ) : (
          <SubstrateText variant="small" color={Colors.light.textMuted}>
            No ingredients attached yet
          </SubstrateText>
        )}
      </View>
    </View>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View style={styles.field}>
      <SubstrateText variant="small" color={Colors.light.textMuted}>
        {label}
      </SubstrateText>
      {children}
    </View>
  );
}

function FilterGroup({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View style={styles.field}>
      <SubstrateText variant="small" color={Colors.light.textMuted}>
        {label}
      </SubstrateText>
      <View style={styles.pillGroup}>{children}</View>
    </View>
  );
}

function FilterPill({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.filterPill, selected && styles.filterPillSelected]}>
      <SubstrateText variant="small" color={selected ? Colors.light.accentDeep : Colors.light.textMuted}>
        {label}
      </SubstrateText>
    </Pressable>
  );
}

function toProductIngredientInput(ingredient: FormIngredient): ProductIngredientInput {
  const parsedOrder = Number.parseInt(ingredient.ingredientOrder, 10);

  return {
    ingredientId: ingredient.ingredientId,
    ingredientOrder: Number.isFinite(parsedOrder) ? parsedOrder : null,
    notes: ingredient.notes,
    concentration: ingredient.concentration,
    concentrationUnit: ingredient.concentrationUnit,
  };
}

function splitAliases(value: string) {
  return value
    .split(',')
    .map((alias) => alias.trim())
    .filter(Boolean);
}

function upsertById<T extends { id: string; name: string }>(items: T[], nextItem: T): T[] {
  const existing = items.some((item) => item.id === nextItem.id);
  const nextItems = existing ? items.map((item) => (item.id === nextItem.id ? nextItem : item)) : [...items, nextItem];

  return nextItems.sort((a, b) => a.name.localeCompare(b.name));
}

function formatCatalogLabel(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
  noticeCard: {
    backgroundColor: Colors.light.successSoft,
  },
  errorCard: {
    gap: Spacing.one,
    backgroundColor: Colors.light.blush,
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
  textArea: {
    minHeight: 84,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  twoColumn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  columnField: {
    flexBasis: 240,
    flexGrow: 1,
    flexShrink: 1,
  },
  pillGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  filterPill: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FBF8F6',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  filterPillSelected: {
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
  productList: {
    gap: Spacing.two,
  },
  productCard: {
    gap: Spacing.two,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FFFDFB',
    padding: Spacing.two,
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
  productActions: {
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
  ingredientList: {
    gap: Spacing.two,
  },
  ingredientRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundSelected,
    padding: Spacing.two,
  },
  ingredientCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  ingredientMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  orderInput: {
    width: 88,
  },
  notesInput: {
    flexBasis: 220,
    flexGrow: 1,
  },
  textButton: {
    minHeight: 32,
    justifyContent: 'center',
  },
  confirmCard: {
    gap: Spacing.two,
    backgroundColor: Colors.light.warningSoft,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  archiveButton: {
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    backgroundColor: Colors.light.accent,
  },
  disabled: {
    opacity: 0.64,
  },
  footerLink: {
    alignItems: 'center',
    minHeight: 36,
    justifyContent: 'center',
  },
});
