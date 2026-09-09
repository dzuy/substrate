import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowDown, ArrowUp, ArrowUpRight, Box, Check, ChevronLeft, ChevronRight, ClipboardList, Database, FileText, Layers, Plus, RefreshCw, Save, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { isCatalogAdmin } from '@/lib/admin';
import { useAuth } from '@/lib/auth-context';
import { archiveProduct, createBrand, createIngredient, listBrands, listCatalogProducts, listIngredients, productCategories, productStatuses, type CatalogBrand, type CatalogIngredient, type CatalogProduct, type ProductIngredientInput } from '@/services/catalog';
import { listCatalogHistory, listCatalogRecords, listCatalogReviews, restoreProduct, saveCatalogReview, saveCmsProduct, type CatalogRecord, type CatalogReview } from '@/services/catalog-cms';
import type { Database as DatabaseTypes, ProductCategory, ProductStatus } from '@/types/database';
import { evidenceSections, fieldLabel } from './catalog-fields';
import './catalog-workspace.css';

type Workspace = 'products' | 'reviews' | 'sources';
type EditorTab = 'overview' | keyof typeof evidenceSections | 'ingredients' | 'reviews' | 'history';
type Form = { id?: string; brandId: string; newBrandName: string; name: string; category: ProductCategory; description: string; imageUrl: string; barcode: string; upc: string; aliasesText: string; status: ProductStatus; catalogVisible: boolean; expectedUpdatedAt?: string; record: CatalogRecord | null; ingredients: ProductIngredientInput[] };
const emptyForm: Form = { brandId: '', newBrandName: '', name: '', category: 'other', description: '', imageUrl: '', barcode: '', upc: '', aliasesText: '', status: 'needs_review', catalogVisible: false, record: null, ingredients: [] };
const label = (value: string) => value === 'spf' ? 'SPF' : value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');
function toForm(product: CatalogProduct, record?: CatalogRecord): Form {
  return { id: product.id, brandId: product.brand_id, newBrandName: '', name: product.name, category: product.category, description: product.description ?? '', imageUrl: product.image_url ?? '', barcode: product.barcode ?? '', upc: product.upc ?? '', aliasesText: product.aliases.join(', '), status: product.status, catalogVisible: product.catalog_visible, expectedUpdatedAt: product.updated_at, record: record ?? null, ingredients: product.ingredients.map((i) => ({ ingredientId: i.ingredient_id, ingredientOrder: i.ingredient_order, concentration: i.concentration, concentrationUnit: i.concentration_unit, notes: i.notes })) };
}

export default function CatalogWorkspace() {
  const { user } = useAuth();
  const canManage = isCatalogAdmin(user);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [ingredients, setIngredients] = useState<CatalogIngredient[]>([]);
  const [records, setRecords] = useState<CatalogRecord[]>([]);
  const [reviews, setReviews] = useState<CatalogReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [workspace, setWorkspace] = useState<Workspace>('products');
  const [query, setQuery] = useState('');
  const [availability, setAvailability] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [brandQuery, setBrandQuery] = useState('');
  const [sort, setSort] = useState<'name' | 'brand' | 'category' | 'status'>('name');
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState(false);
  const [tab, setTab] = useState<EditorTab>('overview');
  const [form, setForm] = useState<Form>(emptyForm);
  const [baseline, setBaseline] = useState(JSON.stringify(emptyForm));
  const [ingredientQuery, setIngredientQuery] = useState('');
  const [editingIngredient, setEditingIngredient] = useState<string | null>(null);
  const [reviewContext, setReviewContext] = useState<string | null>(null);
  const [source, setSource] = useState<CatalogRecord | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; detail: string; label: string; action: () => void } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const saveLock = useRef(false);
  const requestVersion = useRef(0);
  const dirty = JSON.stringify(form) !== baseline;
  const recordMap = useMemo(() => new Map(records.filter((r) => r.product_id).map((r) => [r.product_id, r])), [records]);
  const active = products.filter((p) => !p.archived_at);
  const openReviews = reviews.filter((r) => r.status !== 'RESOLVED').length;

  const load = useCallback(async () => {
    if (!canManage) { setLoading(false); return; }
    const version = ++requestVersion.current;
    setLoading(true); setError('');
    try {
      const [p, b, i, r, q] = await Promise.all([listCatalogProducts({ includeArchived: true, includeUnpublished: true }), listBrands(), listIngredients(), listCatalogRecords(), listCatalogReviews()]);
      if (version !== requestVersion.current) return;
      const failure = p.error || b.error || i.error || r.error || q.error;
      if (failure) throw new Error(failure.message);
      setProducts(p.data ?? []); setBrands(b.data ?? []); setIngredients(i.data ?? []); setRecords(r.data ?? []); setReviews(q.data ?? []);
    } catch (e) { if (version === requestVersion.current) setError(e instanceof Error ? e.message : 'Could not load the catalog. Try refreshing.'); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [canManage]);
  useEffect(() => { const requests = requestVersion; void load(); return () => { requests.current++; }; }, [load]);
  useEffect(() => { setPage(1); }, [query, availability, brandFilter, categoryFilter, statusFilter, sort, descending, workspace]);
  useEffect(() => {
    if (!dirty || !editor) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty, editor]);

  const filtered = useMemo(() => products.filter((p) => {
    const text = [p.name, p.brand?.name, ...p.aliases, recordMap.get(p.id)?.source_id].join(' ').toLowerCase();
    const matchesAvailability = availability === 'archived' ? !!p.archived_at : !p.archived_at && (availability === 'all' || (availability === 'published' ? p.catalog_visible : !p.catalog_visible));
    return matchesAvailability && (brandFilter === 'all' || p.brand_id === brandFilter) && (categoryFilter === 'all' || p.category === categoryFilter) && (statusFilter === 'all' || p.status === statusFilter) && text.includes(query.trim().toLowerCase());
  }).sort((a, b) => {
    const aValue = sort === 'brand' ? a.brand?.name ?? '' : a[sort];
    const bValue = sort === 'brand' ? b.brand?.name ?? '' : b[sort];
    return (aValue.localeCompare(bValue) || a.name.localeCompare(b.name)) * (descending ? -1 : 1);
  }), [products, recordMap, query, availability, brandFilter, categoryFilter, statusFilter, sort, descending]);
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pages);
  const pageProducts = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const selectedProduct = products.find((p) => p.id === form.id);
  const productReviews = reviews.filter((r) => form.record && [r.fields.product_id, ...(r.fields.affected_ids ?? '').split(/[,;]/)].map((id) => id.trim()).includes(form.record.source_id));
  const filteredSources = records.filter((r) => !r.product_id && [r.source_id, ...Object.values(r.fields)].join(' ').toLowerCase().includes(query.toLowerCase()));
  const filteredReviews = reviews.filter((r) => [r.id, ...Object.values(r.fields)].join(' ').toLowerCase().includes(query.toLowerCase()));

  function update(next: Partial<Form>) { setForm((current) => ({ ...current, ...next })); }
  function guard(action: () => void) {
    if (saving) return;
    if (editor && dirty) setConfirm({ title: 'Discard unsaved changes?', detail: 'Your edits have not been saved to the database.', label: 'Discard changes', action });
    else action();
  }
  function navigate(next: Workspace) { guard(() => { setWorkspace(next); setEditor(false); setSource(null); setQuery(''); setNotice(''); setError(''); }); }
  function openProduct(product?: CatalogProduct, reviewId?: string) {
    guard(() => { setReviewContext(reviewId ?? null); const next = product ? toForm(product, recordMap.get(product.id)) : { ...emptyForm }; setForm(next); setBaseline(JSON.stringify(next)); setEditor(true); setTab('overview'); setIngredientQuery(''); setError(''); setNotice(''); });
  }
  function changeSort(next: typeof sort) { if (next === sort) setDescending(!descending); else { setSort(next); setDescending(false); } }
  function clearFilters() { setAvailability('all'); setBrandFilter('all'); setCategoryFilter('all'); setStatusFilter('all'); setBrandQuery(''); setQuery(''); }

  const save = useCallback(async () => {
    if (saveLock.current || !dirty) return;
    if (!form.name.trim() || (!form.brandId && !form.newBrandName.trim())) { setError('A product name and brand are required.'); setTab('overview'); return; }
    if (form.imageUrl && !/^https?:\/\//i.test(form.imageUrl)) { setError('Enter a complete http or https image URL.'); setTab('overview'); return; }
    if (form.ingredients.some((i) => (i.ingredientOrder != null && (!Number.isInteger(i.ingredientOrder) || i.ingredientOrder < 1)) || (i.concentration != null && (!Number.isFinite(i.concentration) || i.concentration < 0)))) { setError('Ingredient order must be a positive whole number and concentration cannot be negative.'); setTab('ingredients'); return; }
    saveLock.current = true; setSaving(true); setError(''); setNotice('');
    try {
      let brandId = form.brandId;
      if (!brandId) { const result = await createBrand(form.newBrandName); if (result.error || !result.data) throw new Error(result.error?.message ?? 'Could not create brand.'); brandId = result.data.id; }
      const result = await saveCmsProduct({ ...form, brandId, aliases: form.aliasesText.split(',').map((a) => a.trim()).filter(Boolean) });
      if (result.error || !result.data) throw new Error(result.error?.message ?? 'The product could not be saved.');
      const evidence = await listCatalogRecords();
      if (evidence.error) { setBaseline(JSON.stringify(form)); setEditor(false); setNotice('Product saved. Refresh the catalog to load the latest evidence.'); await load(); return; }
      const next = toForm(result.data, evidence.data?.find((r) => r.product_id === result.data?.id));
      setProducts((current) => [...current.filter((p) => p.id !== result.data!.id), result.data!]);
      setRecords(evidence.data ?? []); setForm(next); setBaseline(JSON.stringify(next)); setNotice('All changes saved.');
      const nextBrands = await listBrands(); if (nextBrands.data) setBrands(nextBrands.data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Connection failed. Your edits are still here.'); }
    finally { saveLock.current = false; setSaving(false); }
  }, [dirty, form, load]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's' && editor) { event.preventDefault(); void save(); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !editor) { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
  }, [editor, save]);

  async function archiveOrRestore(product: CatalogProduct) {
    setSaving(true); setError('');
    try {
      const result = product.archived_at ? await restoreProduct(product.id) : await archiveProduct(product.id);
      if (result.error) throw new Error(result.error.message);
      setEditor(false); setNotice(product.name + (product.archived_at ? ' restored as unpublished.' : ' archived.')); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'The change could not be saved.'); }
    finally { setSaving(false); }
  }
  function requestArchive(product: CatalogProduct) {
    guard(() => setConfirm({ title: product.archived_at ? 'Restore this product?' : 'Archive this product?', detail: product.archived_at ? 'It will return to the catalog as unpublished and needing review.' : 'It will leave the active catalog. Existing wardrobe references will be preserved.', label: product.archived_at ? 'Restore product' : 'Archive product', action: () => { void archiveOrRestore(product); } }));
  }
  async function addIngredient() {
    if (!ingredientQuery.trim() || saving) return;
    setSaving(true); setError('');
    try { const result = await createIngredient(ingredientQuery); if (result.error || !result.data) throw new Error(result.error?.message ?? 'Could not create ingredient.'); setIngredients((current) => [...current.filter((i) => i.id !== result.data!.id), result.data!]); attachIngredient(result.data.id); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create ingredient.'); }
    finally { setSaving(false); }
  }
  function attachIngredient(id: string) { if (form.ingredients.some((i) => i.ingredientId === id)) return; update({ ingredients: [...form.ingredients, { ingredientId: id, ingredientOrder: form.ingredients.length + 1 }] }); setIngredientQuery(''); }
  function updateIngredient(index: number, next: Partial<ProductIngredientInput>) { update({ ingredients: form.ingredients.map((i, position) => position === index ? { ...i, ...next } : i) }); }

  if (!canManage) return <div className="cms cms-access"><Database size={30} color="#795365" /><h1>Catalog access required</h1><p>This workspace is available to catalog administrators.</p><a href="/profile">Return to your account</a></div>;
  const filteredBy = [availability !== 'all', brandFilter !== 'all', categoryFilter !== 'all', statusFilter !== 'all'].filter(Boolean).length;
  const title = workspace === 'products' ? 'Products' : workspace === 'reviews' ? 'Review queue' : 'Source library';
  const editorTabs: { id: EditorTab; name: string; disabled?: boolean }[] = [
    { id: 'overview', name: 'Overview' }, { id: 'ingredients', name: 'Ingredients' }, ...Object.entries(evidenceSections).filter(([id]) => id !== 'formula').map(([id, section]) => ({ id: id as EditorTab, name: section.label, disabled: !form.record })),
    { id: 'reviews', name: 'Reviews' + (productReviews.length ? ' (' + productReviews.length + ')' : ''), disabled: !form.record }, { id: 'history', name: 'History', disabled: !form.id },
    { id: 'formula', name: 'Original Source', disabled: !form.record },
  ];

  return <div className="cms">
    <header className="cms-topbar" inert={editor || !!confirm}><div className="cms-wordmark"><div className="cms-mark"><Layers size={19} color="#fff" /></div><strong>substrate<span>/</span></strong><span className="cms-admin-label">ADMIN</span></div><div className="cms-environment"><span className="cms-live-dot" />Live catalog<div className="cms-top-divider" /><span className="cms-avatar">{(user?.email?.[0] ?? 'A').toUpperCase()}</span><span>Catalog admin</span></div></header>
    <div className="cms-body" inert={editor || !!confirm}>
      <aside className="cms-sidebar" aria-label="Catalog navigation and filters">
        <div className="cms-rail-heading">WORKSPACE</div>
        <nav className="cms-nav" aria-label="Admin workspace">
          <button className={cx('cms-nav-item', workspace === 'products' && 'active')} onClick={() => navigate('products')}><Box size={17} /><span>Products</span><small>{active.length}</small></button>
          <button className={cx('cms-nav-item', workspace === 'reviews' && 'active')} onClick={() => navigate('reviews')}><ClipboardList size={17} /><span>Review queue</span><small>{openReviews}</small></button>
        </nav>
        <div className="cms-rail-rule" />
        {workspace === 'products' ? <div className={cx('cms-filter-scroll', editor && 'cms-filters-paused')}>
          <div className="cms-filter-heading"><span><SlidersHorizontal size={13} /> FILTERS</span><button className="cms-text-button" disabled={editor} onClick={clearFilters}>Reset{filteredBy ? ' (' + filteredBy + ')' : ''}</button></div>
          {editor ? <p className="cms-rail-hint">Filters are preserved while you edit.</p> : null}
          <FilterSection title="Availability">
            {[['all', 'All active', active.length], ['published', 'Published', active.filter((p) => p.catalog_visible).length], ['unpublished', 'Unpublished', active.filter((p) => !p.catalog_visible).length], ['archived', 'Archived', products.length - active.length]].map(([id, name, count]) => <FilterOption key={id} name={String(name)} count={Number(count)} selected={availability === id} disabled={editor} onClick={() => setAvailability(String(id))} />)}
          </FilterSection>
          <FilterSection title="Brand">
            <div className="cms-rail-search"><Search size={13} /><input aria-label="Filter brands" placeholder="Find a brand…" value={brandQuery} disabled={editor} onChange={(e) => setBrandQuery(e.target.value)} /></div>
            <div className="cms-brand-list"><FilterOption name="All brands" selected={brandFilter === 'all'} disabled={editor} onClick={() => setBrandFilter('all')} />
              {brands.filter((b) => b.name.toLowerCase().includes(brandQuery.toLowerCase())).map((b) => <FilterOption key={b.id} name={b.name} count={products.filter((p) => p.brand_id === b.id && (availability === 'archived' ? !!p.archived_at : !p.archived_at)).length} selected={brandFilter === b.id} disabled={editor} onClick={() => setBrandFilter(b.id)} />)}
              {!brands.some((b) => b.name.toLowerCase().includes(brandQuery.toLowerCase())) ? <p className="cms-rail-hint">No matching brands</p> : null}
            </div>
          </FilterSection>
          <FilterSection title="Category"><FilterOption name="All categories" selected={categoryFilter === 'all'} disabled={editor} onClick={() => setCategoryFilter('all')} />{productCategories.map((category) => <FilterOption key={category} name={label(category)} count={active.filter((p) => p.category === category).length} selected={categoryFilter === category} disabled={editor} onClick={() => setCategoryFilter(category)} />)}</FilterSection>
          <FilterSection title="Verification"><FilterOption name="All statuses" selected={statusFilter === 'all'} disabled={editor} onClick={() => setStatusFilter('all')} />{productStatuses.map((status) => <FilterOption key={status} name={label(status)} selected={statusFilter === status} disabled={editor} onClick={() => setStatusFilter(status)} />)}</FilterSection>
        </div> : <div className="cms-rail-context"><Database size={18} /><strong>{workspace === 'reviews' ? 'Keep the catalog reliable' : 'Preserve the evidence'}</strong><p>{workspace === 'reviews' ? 'Track decisions, document resolutions, and work through outstanding product questions.' : 'Generic families, treatments and procedures are retained separately from the product catalog.'}</p></div>}
        <div className="cms-rail-footer"><span className="cms-live-dot" /><span>{loading ? 'Connecting…' : !products.length && error ? 'Connection needs attention' : 'Connected to database'}</span></div>
      </aside>
      <main className="cms-main">
        <div className="cms-page-heading"><div><div className="cms-breadcrumb">Catalog management <ChevronRight size={12} />{title}</div><div className="cms-title-line"><h1>{title}</h1>{workspace === 'products' ? <span className="cms-count-badge">{active.length}</span> : null}</div><p>{workspace === 'products' ? 'Your product catalog, organized and ready to manage.' : workspace === 'reviews' ? 'Resolve outstanding questions with a clear record of every decision.' : 'Research entities preserved from the original product database.'}</p></div><div className="cms-heading-actions"><button className="cms-button" disabled={loading} onClick={() => void load()}><RefreshCw size={15} />Refresh</button>{workspace === 'products' ? <button className="cms-button primary" disabled={loading} onClick={() => openProduct()}><Plus size={16} />New product</button> : null}</div></div>
        {!editor && error ? <div className="cms-banner error" role="alert">{error}</div> : null}
        {!editor && notice ? <div className="cms-banner success" role="status">{notice}</div> : null}

          <div className="cms-toolbar"><div className="cms-search"><Search size={17} color="#7d7980" /><input ref={searchRef} aria-label={'Search ' + title.toLowerCase()} placeholder={workspace === 'products' ? 'Search products, brands, or source IDs…' : 'Search ' + title.toLowerCase() + '…'} value={query} onChange={(e) => setQuery(e.target.value)} />{query ? <button aria-label="Clear search" onClick={() => setQuery('')}><X size={15} /></button> : <kbd>⌘ K</kbd>}</div><span className="cms-result-count">{workspace === 'products' ? filtered.length : workspace === 'reviews' ? filteredReviews.length : filteredSources.length} results</span>{workspace === 'products' && filteredBy ? <button className="cms-text-button" onClick={clearFilters}>Clear filters</button> : null}</div>
          {workspace === 'products' ? <><div className="cms-table-viewport" aria-busy={loading}><table className="cms-table cms-product-table"><thead><tr>{[['name', 'Product'], ['brand', 'Brand'], ['category', 'Category'], ['status', 'Verification']].map(([id, name]) => <th key={id}><button onClick={() => changeSort(id as typeof sort)}>{name}{sort === id ? descending ? <ArrowDown size={12} /> : <ArrowUp size={12} /> : null}</button></th>)}<th>Availability</th><th><span className="cms-sr-only">Open product</span></th></tr></thead><tbody>{!loading && pageProducts.map((p) => <tr key={p.id} onClick={() => openProduct(p)}><td><button className="cms-product-name" onClick={(e) => { e.stopPropagation(); openProduct(p); }}><span className="cms-product-icon"><Box size={17} color="#887382" /></span><span>{p.name}</span></button></td><td className="cms-brand-cell">{p.brand?.name ?? '—'}</td><td><span className="cms-category">{label(p.category)}</span></td><td><Badge value={p.status} /></td><td><span className={cx('cms-availability', p.catalog_visible && !p.archived_at && 'published')}><i />{p.archived_at ? 'Archived' : p.catalog_visible ? 'Published' : 'Unpublished'}</span></td><td><ChevronRight size={15} color="#a19aa1" /></td></tr>)}</tbody></table>{loading ? <Empty title="Loading the catalog…" detail="Fetching the latest records from the database." /> : !filtered.length ? <Empty title="No products found" detail="Try a different search or reset the filters." action={<button className="cms-button" onClick={clearFilters}>Reset filters</button>} /> : null}</div><footer className="cms-table-footer"><span>{filtered.length ? (currentPage - 1) * 25 + 1 : 0}–{Math.min(currentPage * 25, filtered.length)} of {filtered.length} products<span className="cms-footer-divider">·</span>25 per page</span><div className="cms-pagination"><button aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={15} /></button><span>Page {currentPage} of {pages}</span><button aria-label="Next page" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={15} /></button></div></footer></> : null}
          {workspace === 'reviews' ? <div className="cms-secondary-scroll"><ReviewWorkspace products={products} records={records} onOpenProduct={openProduct} reviews={filteredReviews} onSaved={(r) => setReviews((current) => current.map((x) => x.id === r.id ? r : x))} /></div> : null}
          {workspace === 'sources' ? <div className="cms-secondary-scroll">{source ? <Section title={source.fields.product_name} description={source.source_id + ' · ' + source.entity_type}><button className="cms-button compact" onClick={() => setSource(null)}><ChevronLeft size={14} />Back to source records</button><dl className="cms-source-details">{Object.entries(source.fields).filter(([, value]) => value).map(([key, value]) => <div key={key}><dt>{fieldLabel(key)}</dt><dd>{value}</dd></div>)}</dl></Section> : <><div className="cms-inline-note"><FileText size={17} /><span>These entities are retained as research records. They are not published as products.</span></div><table className="cms-table"><thead><tr><th>Source ID</th><th>Entity</th><th>Type</th><th /></tr></thead><tbody>{filteredSources.map((r) => <tr key={r.source_id} onClick={() => setSource(r)}><td className="cms-mono">{r.source_id}</td><td><button className="cms-table-link" onClick={() => setSource(r)}>{r.fields.product_name}</button></td><td>{r.entity_type}</td><td><ArrowUpRight size={14} /></td></tr>)}</tbody></table>{!filteredSources.length ? <Empty title="No source records found" detail="Try another search term." /> : null}</>}</div> : null}

      </main>
    </div>
    {editor ? <ProductDrawer suspended={!!confirm} onClose={() => guard(() => setEditor(false))}>
        <div className="cms-page-heading">
          <div><div className="cms-breadcrumb">Catalog management <ChevronRight size={12} /> {editor ? <button onClick={() => guard(() => setEditor(false))}>Products</button> : title}{editor ? <><ChevronRight size={12} /><span>{form.id ? form.record?.source_id ?? 'Edit product' : 'New product'}</span></> : null}</div><div className="cms-title-line"><h1 id="cms-drawer-title">{editor ? form.name || 'New product' : title}</h1>{!editor && workspace === 'products' ? <span className="cms-count-badge">{active.length}</span> : null}</div><p>{editor ? (form.id ? 'Edit product details, supporting evidence, and catalog availability.' : 'Create a product in the shared catalog.') : workspace === 'products' ? 'Your product catalog, organized and ready to manage.' : workspace === 'reviews' ? 'Resolve outstanding questions with a clear record of every decision.' : 'Research entities preserved from the original product database.'}</p></div>
          <div className="cms-heading-actions">{editor ? <><span className={cx('cms-save-state', dirty && 'dirty')}>{saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved'}</span><button className="cms-button" disabled={saving} onClick={() => guard(() => setEditor(false))} aria-label="Close product drawer"><X size={17} /></button><button className="cms-button primary" disabled={saving || !dirty} onClick={() => void save()}><Save size={15} />{saving ? 'Saving…' : 'Save changes'}</button></> : <><button className="cms-button" disabled={loading} onClick={() => void load()}><RefreshCw size={15} />Refresh</button>{workspace === 'products' ? <button className="cms-button primary" disabled={loading} onClick={() => openProduct()}><Plus size={16} />New product</button> : null}</>}</div>
        </div>
        {error ? <div className="cms-banner error" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div> : null}
        {notice ? <div className="cms-banner success" role="status"><Check size={15} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={16} /></button></div> : null}

          {reviewContext && reviews.find((r) => r.id === reviewContext) ? <ReviewContext key={reviewContext} review={reviews.find((r) => r.id === reviewContext)!} blocked={saving || dirty} onSaved={(r) => setReviews((current) => current.map((x) => x.id === r.id ? r : x))} /> : null}
          <div className="cms-editor-tabs" role="tablist" aria-label="Product sections">{editorTabs.map((t) => <button role="tab" key={t.id} aria-selected={tab === t.id} disabled={t.disabled} onClick={() => setTab(t.id)} className={cx(tab === t.id && 'active')}>{t.name}</button>)}</div>
          <div className="cms-editor-scroll" role="tabpanel" aria-label={editorTabs.find((t) => t.id === tab)?.name}>
            <fieldset className="cms-editor-fieldset" disabled={saving}>
            {tab === 'overview' ? <div className="cms-editor-columns"><div className="cms-editor-primary">
              <Section title="Product information" description="Core details displayed in the app catalog.">
                <Field name="Product name" required><input value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="Enter product name" /></Field>
                <div className="cms-form-grid"><Field name="Brand" required><select value={form.brandId} onChange={(e) => update({ brandId: e.target.value, newBrandName: '' })}><option value="">Select a brand</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field><Field name="Category"><select value={form.category} onChange={(e) => update({ category: e.target.value as ProductCategory })}>{productCategories.map((c) => <option value={c} key={c}>{label(c)}</option>)}</select></Field></div>
                <details className="cms-add-brand"><summary>Add a new brand</summary><Field name="New brand name"><input value={form.newBrandName} onChange={(e) => update({ newBrandName: e.target.value, brandId: '' })} placeholder="Brand name" /></Field></details>
                <Field name="Description" hint="A concise description suitable for the app."><textarea rows={4} value={form.description} onChange={(e) => update({ description: e.target.value })} placeholder="Describe this product…" /></Field>
              </Section>
              <Section title="Identifiers & media" description="Help the team identify and match the right product."><Field name="Display image URL"><input type="url" placeholder="https://" value={form.imageUrl} onChange={(e) => update({ imageUrl: e.target.value })} /></Field><div className="cms-form-grid"><Field name="Barcode"><input value={form.barcode} onChange={(e) => update({ barcode: e.target.value })} /></Field><Field name="UPC"><input value={form.upc} onChange={(e) => update({ upc: e.target.value })} /></Field></div><Field name="Aliases" hint="Separate alternate names with commas."><input value={form.aliasesText} onChange={(e) => update({ aliasesText: e.target.value })} /></Field></Section>
            </div><div className="cms-editor-secondary"><Section title="Publishing"><Field name="Availability"><select value={form.catalogVisible ? 'published' : 'unpublished'} onChange={(e) => update({ catalogVisible: e.target.value === 'published' })}><option value="unpublished">Unpublished</option><option value="published">Published</option></select></Field><p className="cms-help">Published products can be selected in the app. Evidence and recommendation rules remain separate.</p><Field name="Verification status"><select value={form.status} onChange={(e) => update({ status: e.target.value as ProductStatus })}>{productStatuses.map((s) => <option value={s} key={s}>{label(s)}</option>)}</select></Field></Section>
              <Section title="Record details"><dl className="cms-record-details"><dt>Source ID</dt><dd>{form.record?.source_id ?? 'Not linked'}</dd><dt>Entity type</dt><dd>{form.record?.entity_type ?? 'Catalog product'}</dd><dt>Last updated</dt><dd>{form.expectedUpdatedAt ? new Date(form.expectedUpdatedAt).toLocaleString() : 'Not yet saved'}</dd></dl>{form.record ? <p className="cms-help">{form.record.fields.all_masters}</p> : null}</Section>
              {selectedProduct ? <button className="cms-button cms-archive-action" onClick={() => requestArchive(selectedProduct)}><Archive size={15} />{selectedProduct.archived_at ? 'Restore product' : 'Archive product'}</button> : null}
            </div></div> : null}
            {tab in evidenceSections && form.record ? <EvidenceFields section={tab as keyof typeof evidenceSections} record={form.record} onChange={(record) => update({ record })} /> : null}
            {tab === 'ingredients' ? <Section title="Ingredient library"><div className="cms-ingredient-search"><Field name="Find or create an ingredient"><input placeholder="Search the ingredient library…" value={ingredientQuery} onChange={(e) => setIngredientQuery(e.target.value)} /></Field>{ingredientQuery.trim() ? <><p className="cms-help">Search results — click to add</p><div className="cms-ingredient-options">{ingredients.filter((i) => !form.ingredients.some((f) => f.ingredientId === i.id) && i.name.toLowerCase().includes(ingredientQuery.trim().toLowerCase())).slice(0, 8).map((i) => <button key={i.id} className="cms-button compact" onClick={() => attachIngredient(i.id)}><Plus size={12} />{i.name}</button>)}{ingredientQuery.trim() ? <button className="cms-button compact" onClick={() => void addIngredient()}>Create “{ingredientQuery.trim()}”</button> : null}</div></> : null}</div>
              <p className="cms-help">{form.ingredients.length} linked ingredients · Click a chip to edit its order, concentration, or notes.</p>
              <div className="cms-ingredient-chips" role="list" aria-label="Linked ingredients">{form.ingredients.map((i, index) => {
                const name = ingredients.find((x) => x.id === i.ingredientId)?.name ?? 'Ingredient';
                return <div role="listitem" className={cx('cms-ingredient-chip', editingIngredient === i.ingredientId && 'selected')} key={i.ingredientId}>
                  <button className="cms-chip-label" aria-expanded={editingIngredient === i.ingredientId} onClick={() => setEditingIngredient(editingIngredient === i.ingredientId ? null : i.ingredientId)}><span className="cms-chip-order">{i.ingredientOrder ?? '–'}</span>{name}{i.concentration != null ? <span className="cms-chip-concentration">{i.concentration}{i.concentrationUnit ?? ''}</span> : null}</button>
                  <button className="cms-chip-remove" aria-label={'Remove ' + name} onClick={() => { update({ ingredients: form.ingredients.filter((_, position) => position !== index) }); if (editingIngredient === i.ingredientId) setEditingIngredient(null); }}><X size={12} /></button>
                </div>;
              })}</div>
              {form.ingredients.map((i, index) => editingIngredient === i.ingredientId ? <div className="cms-ingredient-detail" key={i.ingredientId}>
                <div className="cms-ingredient-detail-heading"><strong>{ingredients.find((x) => x.id === i.ingredientId)?.name ?? 'Ingredient'}</strong><button className="cms-icon-button" aria-label="Close ingredient details" onClick={() => setEditingIngredient(null)}><X size={15} /></button></div>
                <div className="cms-form-grid"><Field name="Source order"><input type="number" min="1" step="1" value={i.ingredientOrder ?? ''} onChange={(e) => updateIngredient(index, { ingredientOrder: e.target.value ? Number(e.target.value) : null })} /></Field><Field name="Concentration"><input type="number" min="0" step="any" value={i.concentration ?? ''} onChange={(e) => updateIngredient(index, { concentration: e.target.value ? Number(e.target.value) : null })} /></Field><Field name="Unit"><input value={i.concentrationUnit ?? ''} onChange={(e) => updateIngredient(index, { concentrationUnit: e.target.value })} /></Field></div>
                <Field name="Ingredient notes"><textarea rows={3} value={i.notes ?? ''} onChange={(e) => updateIngredient(index, { notes: e.target.value })} /></Field>
              </div> : null)}
              {!form.ingredients.length ? <Empty title="No ingredients linked yet" detail="Search the library above to attach the first ingredient." /> : null}</Section> : null}
            </fieldset>
            {tab === 'reviews' ? <ReviewWorkspace products={products} records={records} onOpenProduct={openProduct} reviews={productReviews} onSaved={(r) => setReviews((current) => current.map((x) => x.id === r.id ? r : x))} /> : null}
            {tab === 'history' && form.id ? <History key={form.expectedUpdatedAt} productId={form.id} sourceId={form.record?.source_id} /> : null}
          </div>
          <footer className="cms-editor-footer"><span>{form.record?.source_id ?? 'New catalog record'}<span className="cms-footer-divider">·</span>{dirty ? 'Changes are not saved yet' : 'Up to date'}<span className="cms-footer-divider">·</span><kbd>⌘ / Ctrl S</kbd> to save</span><button className="cms-text-button" disabled={!dirty || saving} onClick={() => setConfirm({ title: 'Discard unsaved changes?', detail: 'The last saved version will be restored in this editor.', label: 'Discard changes', action: () => setForm(JSON.parse(baseline)) })}>Discard changes</button></footer>
    </ProductDrawer> : null}
    {confirm ? <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} onConfirm={() => { const action = confirm.action; setConfirm(null); action(); }} /> : null}
  </div>;
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="cms-filter-section"><h3>{title}</h3>{children}</section>; }
function FilterOption({ name, count, selected, disabled, onClick }: { name: string; count?: number; selected: boolean; disabled?: boolean; onClick: () => void }) { return <button className={cx('cms-filter-option', selected && 'selected')} disabled={disabled} aria-pressed={selected} onClick={onClick}><span className="cms-radio-dot">{selected ? <span /> : null}</span><span className="cms-filter-name">{name}</span>{count !== undefined ? <small>{count}</small> : null}</button>; }
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) { return <section className="cms-section"><div className="cms-section-heading"><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>{children}</section>; }
function Field({ name, required, hint, children }: { name: string; required?: boolean; hint?: string; children: React.ReactNode }) { return <label className="cms-field"><span>{name}{required ? <em> *</em> : null}</span>{children}{hint ? <small>{hint}</small> : null}</label>; }
function Badge({ value }: { value: string }) { return <span className={cx('cms-badge', value === 'verified' || value === 'RESOLVED' ? 'green' : value === 'draft' ? 'neutral' : 'amber')}><i />{label(value)}</span>; }
function Empty({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) { return <div className="cms-empty"><Box size={28} color="#a397a1" /><h3>{title}</h3><p>{detail}</p>{action}</div>; }
function ConfirmDialog({ title, detail, label: actionLabel, onCancel, onConfirm }: { title: string; detail: string; label: string; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.querySelector<HTMLButtonElement>('button')?.focus(); return () => previous?.focus(); }, []);
  return <div className="cms-modal-backdrop"><div ref={ref} className="cms-modal" role="dialog" aria-modal="true" aria-labelledby="cms-confirm-title" onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); if (e.key === 'Tab') { const buttons = ref.current?.querySelectorAll('button'); if (buttons?.length) { if (e.shiftKey && document.activeElement === buttons[0]) { e.preventDefault(); buttons[buttons.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) { e.preventDefault(); buttons[0].focus(); } } } }}><h2 id="cms-confirm-title">{title}</h2><p>{detail}</p><div><button className="cms-button" onClick={onCancel}>Cancel</button><button className="cms-button primary" onClick={onConfirm}>{actionLabel}</button></div></div></div>;
}

function EvidenceFields({ section, record, onChange }: { section: keyof typeof evidenceSections; record: CatalogRecord; onChange: (record: CatalogRecord) => void }) {
  const group = evidenceSections[section];
  const short = new Set(['primary_market', 'time_of_day', 'frequency', 'post_open_shelf_life', 'water_resistance', 'application_format', 'tier', 'ladder_id', 'layering_position', 'ramp_required', 'mechanism_subtype', 'acid_form', 'formulation_pH', 'anhydrous', 'activation_required', 'photosensitivity_tail_days']);
  return <Section title={group.label} description={'Private source evidence · ' + record.source_id}><div className="cms-inline-note"><FileText size={17} /><span>Original evidence is preserved. Editing these fields does not activate recommendation rules.</span></div><div className="cms-evidence-grid">{group.fields.map((key) => <div key={key} className={short.has(key) ? '' : 'wide'}><Field name={fieldLabel(key)}>{short.has(key) ? <input value={record.fields[key] ?? ''} onChange={(e) => onChange({ ...record, fields: { ...record.fields, [key]: e.target.value } })} /> : <textarea rows={key === 'ingredient_list' ? 7 : 3} value={record.fields[key] ?? ''} onChange={(e) => onChange({ ...record, fields: { ...record.fields, [key]: e.target.value } })} />}</Field></div>)}</div></Section>;
}

function ReviewWorkspace({ reviews, products, records, onOpenProduct, onSaved }: { reviews: CatalogReview[]; products: CatalogProduct[]; records: CatalogRecord[]; onOpenProduct: (product: CatalogProduct, reviewId: string) => void; onSaved: (review: CatalogReview) => void }) {
  const [selectedSnapshot, setSelected] = useState<CatalogReview | null>(null);
  const selected = reviews.find((r) => r.id === selectedSnapshot?.id) ?? selectedSnapshot;
  const [status, setStatus] = useState('unresolved');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const visible = reviews.filter((r) => status === 'all' || (status === 'unresolved' ? r.status !== 'RESOLVED' : r.status === status));
  const lastPage = Math.max(1, Math.ceil(visible.length / 25));
  const currentPage = Math.min(page, lastPage);
  async function save(nextStatus: CatalogReview['status']) {
    if (!selected || saving) return;
    setSaving(true); setMessage('');
    try { const result = await saveCatalogReview(selected, nextStatus, note); if (result.error || !result.data) throw new Error(result.error?.message ?? 'Could not save review.'); onSaved(result.data); setSelected(result.data); setNote(result.data.resolution_note); setMessage('Review saved.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save review.'); }
    finally { setSaving(false); }
  }
  return <div className="cms-review-workspace"><div className="cms-review-toolbar"><div className="cms-segmented">{[['unresolved', 'Unresolved'], ['RESOLVED', 'Resolved'], ['all', 'All reviews']].map(([id, name]) => <button key={id} className={cx(status === id && 'active')} onClick={() => { setStatus(id); setPage(1); }}>{name}</button>)}</div><span>{visible.length} items</span></div>
    {selected ? <Section title={selected.fields.product_name || selected.fields.issue_type} description={selected.fields.review_id + ' · Source row ' + selected.source_row}><div className="cms-review-detail-heading"><Badge value={selected.status} /><button className="cms-button compact" disabled={saving} onClick={() => { if (note !== selected.resolution_note && !window.confirm('Discard the unsaved resolution note?')) return; setSelected(null); setMessage(''); }}><ChevronLeft size={13} />Back to queue</button></div><div className="cms-review-detail-grid"><div><h3>Issue</h3><p>{selected.fields.issue}</p><h3>Recommended action</h3><p>{selected.fields.recommended_action}</p></div><dl className="cms-record-details"><dt>Issue type</dt><dd>{label(selected.fields.issue_type)}</dd><dt>Affected products</dt><dd>{selected.fields.affected_ids || selected.fields.product_id || '—'}</dd><dt>Blocks app use</dt><dd>{selected.fields.blocking_for_app || 'Not specified'}</dd></dl></div>{selected ? <div className="cms-review-products"><h3>Edit affected products</h3>{products.filter((p) => records.some((r) => r.product_id === p.id && ((selected.fields.affected_ids || '') + ' ' + (selected.fields.product_id || '')).match(/SKP-\d+/g)?.includes(r.source_id))).map((p) => <button key={p.id} className="cms-button" disabled={saving} onClick={() => onOpenProduct(p, selected.id)}>{p.brand?.name} · {p.name}<ChevronRight size={14} /></button>)}<p className="cms-help">Open a linked product to edit its details and resolve this review in the same drawer. Reviews about research records may have no editable product.</p></div> : null}<Field name="Resolution note" hint="Optional — add context if helpful."><textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} disabled={saving} placeholder="Document your decision…" /></Field>{message ? <p role="status" className="cms-help">{message}</p> : null}<div className="cms-review-actions"><button className="cms-button" disabled={saving} onClick={() => void save('OPEN')}>Save as open</button><button className="cms-button" disabled={saving} onClick={() => void save('PARTIALLY RESOLVED')}>Partially resolve</button><button className="cms-button primary" disabled={saving} onClick={() => void save('RESOLVED')}><Check size={14} />Resolve review</button></div></Section> : <><table className="cms-table cms-review-table"><thead><tr><th>Review / product</th><th>Issue type</th><th>Status</th><th>Blocking</th><th /></tr></thead><tbody>{visible.slice((currentPage - 1) * 25, currentPage * 25).map((r) => <tr key={r.id} onClick={() => { setSelected(r); setNote(r.resolution_note); }}><td><button className="cms-table-link" onClick={() => { setSelected(r); setNote(r.resolution_note); }}>{r.fields.product_name || r.fields.issue_type}</button><small>{r.fields.review_id} · Row {r.source_row}</small></td><td>{label(r.fields.issue_type)}</td><td><Badge value={r.status} /></td><td>{r.fields.blocking_for_app === 'YES' ? <span className="cms-blocking">Yes</span> : 'No'}</td><td><ChevronRight size={14} /></td></tr>)}</tbody></table>{!visible.length ? <Empty title="No reviews in this view" detail="Choose another status or search term." /> : null}<div className="cms-table-footer"><span>{visible.length} review items</span><div className="cms-pagination"><button aria-label="Previous review page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={14} /></button><span>{currentPage} / {lastPage}</span><button aria-label="Next review page" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}><ChevronRight size={14} /></button></div></div></>}
  </div>;
}

function History({ productId, sourceId }: { productId: string; sourceId?: string }) {
  const [items, setItems] = useState<DatabaseTypes['public']['Tables']['catalog_changes']['Row'][]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { let mounted = true; listCatalogHistory(productId, sourceId).then((r) => { if (mounted) { if (r.error) setError(r.error.message); else setItems(r.data ?? []); setLoading(false); } }).catch(() => { if (mounted) { setError('Could not load change history.'); setLoading(false); } }); return () => { mounted = false; }; }, [productId, sourceId]);
  return <Section title="Change history" description="The 20 most recent changes to this product and its source evidence.">{error ? <p role="alert">{error}</p> : loading ? <p>Loading history…</p> : items.length ? <div className="cms-history">{items.map((item) => <div key={item.id}><span className="cms-history-dot" /><div><strong>{!item.before_value ? 'Record created' : !item.after_value ? 'Record removed' : 'Record updated'}</strong><p>{label(item.table_name)} · {item.actor_id ? 'Admin edit' : 'Import / system'}</p><time>{new Date(item.created_at).toLocaleString()}</time><details><summary>View saved values</summary><pre>{JSON.stringify({ before: item.before_value, after: item.after_value }, null, 2)}</pre></details></div></div>)}</div> : <p>No recorded changes yet.</p>}</Section>;
}

function ProductDrawer({ children, onClose, suspended }: { children: React.ReactNode; onClose: () => void; suspended: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="cms-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !suspended) onClose(); }}>
    <div ref={panel} className="cms-drawer" role="dialog" aria-modal="true" aria-labelledby="cms-drawer-title" tabIndex={-1} inert={suspended} onKeyDown={(event) => {
      if (suspended) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]') ?? []).filter((element) => element.getClientRects().length > 0);
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
      }
    }}>{children}</div>
  </div>;
}

function ReviewContext({ review, blocked, onSaved }: { review: CatalogReview; blocked: boolean; onSaved: (review: CatalogReview) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function resolve() {
    if (blocked || saving) return;
    setSaving(true); setError('');
    try { const result = await saveCatalogReview(review, 'RESOLVED', review.resolution_note); if (result.error || !result.data) throw new Error(result.error?.message ?? 'Could not resolve review'); onSaved(result.data); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not resolve review'); }
    finally { setSaving(false); }
  }
  return <section className="cms-review-context"><div><strong>Review: {review.fields.issue_type}</strong><Badge value={review.status} /></div><p>{review.fields.issue}</p><details><summary>Recommended action</summary><p>{review.fields.recommended_action}</p></details>{error ? <p role="alert">{error}</p> : null}<div><small>{blocked ? 'Save product changes before resolving this review.' : 'Edit the product below, then mark this review resolved. No note required.'}</small><button className="cms-button primary" disabled={blocked || saving || review.status === 'RESOLVED'} onClick={() => void resolve()}>{review.status === 'RESOLVED' ? 'Resolved' : saving ? 'Resolving…' : 'Resolve review'}</button></div></section>;
}
