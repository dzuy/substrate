import { useCallback, useId, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { ClipPath, Defs, Image as SvgImage, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ArrowLeft, Camera, Check, ChevronRight, CircleUserRound, Droplets, Heart, Leaf, LogOut, ShieldCheck, Sparkles, Sun, Watch } from 'lucide-react-native';
import { Copy, Notice, ReportButton } from '@/report/ui';
import { AuthModal } from '@/components/auth-modal';
import { ProfileContent } from '@/components/profile-content';
import { useAuth } from '@/lib/auth-context';
import { loadJourney, saveJourney, resolveJourney, type Journey, type JourneyConflict } from '@/services/journey';
import { getProfile, saveProfileContext, toProfileContext } from '@/services/profile';
import { listUserWardrobe } from '@/services/catalog';
import { pickReportPhoto } from '@/report/service';
import { stageProductPhoto } from '@/services/product-photo-draft';
import { downloadBaselineView, uploadBaselineView } from '@/services/photos';
import type { ProfileContext } from '@/types/database';

const navy = '#031927';
const paper = '#FBF6EE';
const flow = ['welcome', 'profile', 'photos', 'wardrobe', 'subscription', 'summary'];
const categories = [
  { title: 'Skin goals & concerns', subtitle: 'Your goals, skin type and history', icon: Sparkles, sections: ['Basic Information', 'Skin Goals', 'Skin History'] },
  { title: 'Lifestyle & environment', subtitle: 'Daily habits, nutrition and surroundings', icon: Leaf, sections: ['Lifestyle', 'Nutrition', 'Supplements'] },
  { title: 'Health context', subtitle: 'Medical history, allergies and procedures', icon: Heart, sections: ['Medical History', 'Allergies', 'Procedures History'] },
  { title: 'Cycle & hormones', subtitle: 'Menstrual cycle, menopause and more', icon: Droplets, sections: ['Hormones'] },
];
type PhotoView = 'front' | 'left' | 'right';
function PhotoExample({ view }: { view: PhotoView }) {
  const clipId = useId().replace(/:/g, '');
  const index = ['front', 'right', 'left'].indexOf(view);
  return <Svg width="100%" height="100%" viewBox={`${index * 512} 0 512 1024`} preserveAspectRatio="xMidYMid meet" accessibilityLabel={`${view} photo example`}>
    <Defs><ClipPath id={clipId}><Rect x={index * 512} y={0} width={512} height={1024} /></ClipPath></Defs>
    <SvgImage clipPath={`url(#${clipId})`} href={require('@/assets/images/baseline-photo-examples-v1.png')} x={0} y={0} width={1536} height={1024} />
  </Svg>;
}
function ProductPlaceholder({ name }: { name: string }) {
  const clipId = useId().replace(/:/g, '');
  const tile = /spf|sunscreen/i.test(name) ? 2 : /treatment|tiox/i.test(name) ? 1 : /hydro|lipid serum/i.test(name) ? 3 : 0;
  const x = (tile % 2) * 512;
  const y = Math.floor(tile / 2) * 512;
  return <Svg width={48} height={60} viewBox={`${x} ${y} 512 512`} preserveAspectRatio="xMidYMid meet" accessibilityLabel="Illustrative product placeholder">
    <Defs><ClipPath id={clipId}><Rect x={x} y={y} width={512} height={512} /></ClipPath></Defs>
    <SvgImage clipPath={`url(#${clipId})`} href={require('@/assets/images/product-placeholders-v1.png')} width={1024} height={1024} />
  </Svg>;
}
export default function Onboarding() {

  const { user } = useAuth();
  return <OnboardingFlow key={user?.id || 'guest'} userId={user?.id || ''} email={user?.email || ''} />;
}
function OnboardingFlow({ userId, email }: { userId: string; email: string }) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const shortScreen = height < 740;

  const router = useRouter();
  const { signOut } = useAuth();
  const { authNext } = useLocalSearchParams<{ authNext?: string }>();
  const [authOpen, setAuthOpen] = useState(!userId && authNext === 'profile');
  const scroll = useRef<ScrollView>(null);
  const lock = useRef(false);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [profile, setProfile] = useState<ProfileContext>({});
  const [profileVersion, setProfileVersion] = useState<string>();
  const [profileDirty, setProfileDirty] = useState(false);
  const [category, setCategory] = useState<number | null>(null);
  const [photoView, setPhotoView] = useState<PhotoView>('front');
  const [products, setProducts] = useState<{ id: string; name: string; brand: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [localOnly, setLocalOnly] = useState(false);
  const [conflict, setConflict] = useState<JourneyConflict | null>(null);
  useFocusEffect(useCallback(() => {
    let alive = true;
    if (!userId) {
      setJourney({ version: 1, stage: 'welcome', revision: 0, updatedAt: new Date().toISOString() });
      return;
    }
    void Promise.all([loadJourney(userId), getProfile(userId), listUserWardrobe(userId)]).then(async ([loaded, p, w]) => {
      if (!alive) return;
      const saved = authNext === 'profile' && !loaded.conflict
        ? await saveJourney(userId, { ...loaded.state, acknowledged: true, stage: 'profile' })
        : loaded;
      if (!alive) return;
      setJourney(saved.state); setConflict(saved.conflict); setLocalOnly(!saved.cloud && saved.state.revision > 0);
      setProfile(saved.state.profileDraft || toProfileContext(p.data)); setProfileVersion(p.data?.updated_at); setProfileDirty(!!saved.state.profileDraft && JSON.stringify(saved.state.profileDraft) !== JSON.stringify(toProfileContext(p.data)));
      setProducts((w.data || []).filter(item => item.status === 'active').map(item => ({ id: item.id, name: item.product?.name || 'Saved product', brand: item.product?.brand?.name || '' })));
      if (authNext === 'profile') router.setParams({ authNext: undefined });
      setError('');
    }).catch(e => alive && setError(e.message));
    return () => { alive = false; };
  }, [userId, authNext, router]));
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function persist(next: Journey) {
    const result = await saveJourney(userId, next);
    setJourney(result.state); setConflict(result.conflict); setLocalOnly(!result.cloud);
    return result.state;
  }
  async function go(stage: string) {
    if (!journey) return;
    await persist({ ...journey, stage }); setCategory(null); scroll.current?.scrollTo({ y: 0, animated: false });
  }
  async function saveBasics() {
    if (!journey) return;
    const draft = await persist({ ...journey, profileDraft: profile });
    if (profileDirty) {
      const result = await saveProfileContext(userId, profile, profileVersion);
      if (result.error) throw Error('Your profile draft is saved on this device. Please retry saving your profile.');
      setProfileVersion(result.data?.updated_at); setProfileDirty(false);
    }
    return draft;
  }
  async function pick(camera: boolean) {
    if (!journey) return;
    const photo = await pickReportPhoto(camera); if (!photo) return;
    const draft = await persist({ ...journey, photos: { ...journey.photos, [photoView]: photo }, baselineRefs: { ...journey.baselineRefs, [photoView]: undefined } });
    const path = await uploadBaselineView(userId, photoView, photo);
    await persist({ ...draft, baselineRefs: { ...draft.baselineRefs, [photoView]: path } });
  }
  const stage = journey && ['wellness', 'complete'].includes(journey.stage) ? 'summary' : journey?.stage || 'welcome';
  const step = flow.indexOf(stage);
  const isWelcome = stage === 'welcome';
  const finish = () => void run(async () => { if (!journey) return; await persist({ ...journey, stage: 'complete', completedAt: new Date().toISOString() }); router.replace('/your-day' as Href); });
  const button = (label: string, action: () => Promise<void>, gold = false) => <ReportButton label={label} copper={gold} busy={busy} onPress={() => void run(action)} />;
  const field = (label: string, key: 'displayName' | 'dateOfBirth', placeholder: string) => <View style={styles.field}><Copy kind="small" style={styles.label}>{label}</Copy><TextInput accessibilityLabel={label} value={key === 'dateOfBirth' ? (profile[key] || '').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$2 / $3 / $1') : profile[key] || ''} placeholder={placeholder} placeholderTextColor="#718094" style={styles.input} onChangeText={value => { setProfile({ ...profile, [key]: value }); setProfileDirty(true); }} /></View>;
  return <SafeAreaView style={styles.root}><StatusBar style="light" /><ScrollView ref={scroll} keyboardShouldPersistTaps="handled" alwaysBounceVertical={false} automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag" contentContainerStyle={styles.scroll}>
    <View style={[styles.shell, isWelcome && {paddingBottom:0}]}>
      <View style={styles.header}>{step > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={category !== null ? 'Back to profile' : 'Previous step'} disabled={busy} onPress={() => category !== null ? setCategory(null) : void run(() => go(flow[step - 1]))} style={styles.back}><ArrowLeft size={20} color={paper} /></Pressable> : null}<Copy kind="eyebrow" style={{ color: paper, letterSpacing: 4 }}>SUBSTRATE</Copy>{userId ? <Pressable accessibilityRole="button" accessibilityLabel="Sign out" accessibilityHint="Sign out and return to the welcome screen" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void run(signOut)} style={({ pressed }) => [styles.signOut, { opacity: busy || pressed ? 0.5 : 0.8 }]}><LogOut size={18} strokeWidth={1.5} color={paper} /></Pressable> : null}</View>
      {!isWelcome && stage !== 'summary' ? <View style={styles.progress}>{flow.slice(1, 5).map((name, i) => <View key={name} style={[styles.segment, { backgroundColor: i < step ? '#EFC18E' : '#365061' }]} />)}</View> : null}
      {error ? <Notice>{error}</Notice> : null}
      {conflict && journey ? <View style={[styles.card, width < 360 && {padding:16}]}><Copy kind="heading">Choose your saved progress</Copy><Copy>Your account has newer progress. Both versions will be backed up before you choose.</Copy>{(['device', 'account'] as const).map(choice => <ReportButton key={choice} label={`Use ${choice} progress`} busy={busy} onPress={() => void run(async () => { const r = await resolveJourney(userId, journey, choice, conflict.revision); setJourney(r.state); setProfile(r.state.profileDraft || profile); setConflict(r.conflict); setLocalOnly(!r.cloud); })} />)}</View> : null}
      {!journey ? <View style={[styles.card, width < 360 && {padding:16}]}><Copy>Loading your welcome…</Copy></View> : isWelcome ? <ImageBackground resizeMode="stretch" source={require('@/assets/images/onboarding-nautilus-v1.png')} style={[styles.hero, { minHeight: Math.max(500, height - insets.top - insets.bottom - 62), padding: shortScreen ? 18 : 24 }]} imageStyle={{ opacity: 0.95 }}>
        <View style={[styles.heroSpace, {minHeight: shortScreen ? 55 : Math.min(245, height * 0.2)}]} />
        <View style={styles.heroContent}>
          <View pointerEvents="none" accessible={false} style={styles.heroScrim}>
            <Svg width="100%" height="100%" aria-hidden>
              <Defs><LinearGradient id="welcomeScrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={navy} stopOpacity={0} />
                <Stop offset="0.22" stopColor={navy} stopOpacity={0.42} />
                <Stop offset="0.65" stopColor={navy} stopOpacity={0.58} />
                <Stop offset="0.88" stopColor={navy} stopOpacity={0.45} />
                <Stop offset="1" stopColor={navy} stopOpacity={0} />
              </LinearGradient></Defs>
              <Rect width="100%" height="100%" fill="url(#welcomeScrim)" />
            </Svg>
          </View>
        <View style={styles.heroCopy}><Copy kind="title" style={{...styles.heroTitle, fontSize: width < 360 || shortScreen ? 36 : 44, lineHeight: width < 360 || shortScreen ? 39 : 46}}>Beauty{ '\n' }starts within.</Copy><Copy style={{ color: paper, fontSize: 17 }}>Personalized skincare.{ '\n' }Powered by your biology.{ '\n' }Guided by AI.</Copy></View>
        <View style={[styles.benefits, shortScreen && {marginVertical:16}]}>{[{ Icon: Watch, text: 'Smarter\nroutines' }, { Icon: Sun, text: 'Healthier\nskin' }, { Icon: ShieldCheck, text: 'Inside-out\ninsights' }].map(({ Icon, text }) => <View key={text} style={styles.benefit}><Icon size={27} strokeWidth={1.2} color="#EDB779" /><Copy kind="small" style={{ color: paper, textAlign: 'center' }}>{text}</Copy></View>)}</View>
        </View>
        <View style={styles.priceCard}><Copy style={{ textAlign: 'center', fontSize: 25 }}>$19.99<Copy kind="small"> / month</Copy></Copy><Copy kind="small" style={{ textAlign: 'center', color: '#536478' }}>Cancel anytime.</Copy>{button('Continue', async () => { if (!userId) { router.setParams({ authNext: 'profile' }); setAuthOpen(true); return; } await persist({ ...journey, acknowledged: true, stage: 'profile' }); scroll.current?.scrollTo({ y: 0 }); }, true)}</View>
      </ImageBackground> : <View style={[styles.card, width < 360 && {padding:16}]}>
        {stage === 'profile' ? <>
          <Copy kind="title">{category === null ? 'Tell us about you.' : categories[category].title}</Copy><Copy style={styles.subtitle}>A few details help us personalize your experience.</Copy>
          {category !== null ? <ProfileContent key={category} sections={categories[category].sections} onNavigate={() => {}} onSaved={p => void run(async () => { const saved = await getProfile(userId); setProfileVersion(saved.data?.updated_at); setProfile(p); await persist({ ...journey, profileDraft: p }); setCategory(null); scroll.current?.scrollTo({ y: 0 }); })} /> : <>
            {field('Your name', 'displayName', 'What should we call you?')}
            <View style={styles.field}><Copy kind="small" style={styles.label}>Email address</Copy><Copy kind="small" style={{ color: '#536478' }}>{email}</Copy></View>
            {field('Date of birth', 'dateOfBirth', 'MM / DD / YYYY')}
            <View style={styles.field}><Copy kind="small" style={styles.label}>Sex assigned at birth</Copy><View style={styles.row}>{['Female', 'Male', 'Prefer not to say'].map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: profile.sexAssignedAtBirth === value }} onPress={() => { setProfile({ ...profile, sexAssignedAtBirth: profile.sexAssignedAtBirth === value ? undefined : value }); setProfileDirty(true); }} style={[styles.chip, profile.sexAssignedAtBirth === value && { backgroundColor: '#EED6B9' }]}><Copy kind="small">{value}</Copy></Pressable>)}</View></View>
            <View style={{ gap: 10, marginTop: 8 }}>{categories.map(({ title, subtitle, icon: Icon }, index) => <Pressable key={title} accessibilityRole="button" disabled={busy} onPress={() => void run(async () => { await saveBasics(); setCategory(index); scroll.current?.scrollTo({ y: 0 }); })} style={styles.category}><View style={styles.icon}><Icon size={22} strokeWidth={1.4} color="#168CD0" /></View><View style={{ flex: 1 }}><Copy kind="small" style={styles.label}>{title}</Copy><Copy kind="small" style={{ color: '#64758A', fontSize: 11 }}>{subtitle}</Copy></View><ChevronRight size={17} color="#64758A" /></Pressable>)}</View>
            <View style={styles.spacer} />{button('Continue', async () => { const draft = await saveBasics(); if (draft) await persist({ ...draft, stage: 'photos' }); scroll.current?.scrollTo({ y: 0 }); })}
          </>}
        </> : null}
        {stage === 'photos' ? <>
          <Copy kind="title">Take your skin photos.</Copy><Copy style={styles.subtitle}>We&apos;ll use these to personalize your routine and track progress</Copy>
          <View style={styles.photo}>{journey.photos?.[photoView] ? <Image source={{ uri: journey.photos[photoView] }} accessibilityLabel={`${photoView} baseline`} style={styles.fillImage} /> : <><PhotoExample view={photoView} /><View style={styles.exampleBadge}><Copy kind="small" style={{ fontSize: 11 }}>Example · {photoView} view</Copy></View></>}<View pointerEvents="none" style={styles.photoGuide} /></View>
          <View style={styles.row}>{(['front', 'left', 'right'] as const).map(view => <Pressable accessibilityRole="tab" accessibilityState={{ selected: photoView === view }} key={view} onPress={() => setPhotoView(view)} style={[styles.thumbnail, photoView === view && { borderColor: '#C39460', backgroundColor: '#F3E6D6' }]}>{journey.photos?.[view] ? <Image source={{ uri: journey.photos[view] }} style={{ height: 64, width: '100%', borderRadius: 8 }} /> : <View style={styles.exampleThumbnail}><PhotoExample view={view} /></View>}<Copy kind="small" style={{ textTransform: 'capitalize' }}>{view}{journey.baselineRefs?.[view] ? ' ✓' : ''}</Copy></Pressable>)}</View>
          <View style={styles.tip}><Sun size={20} color="#60758A" /><Copy kind="small" style={{ flex: 1, color: '#536478' }}>Natural light works best. Remove makeup if possible, and keep your face in the frame.</Copy></View>
          <View style={styles.row}><View style={{ flex: 1 }}>{button('Take photo', () => pick(true))}</View><View style={{ flex: 1 }}><ReportButton secondary busy={busy} label="Upload photo" onPress={() => void run(() => pick(false))} /></View></View>
          {journey.baselineRefs?.[photoView] && !journey.photos?.[photoView] ? button('View saved photo', async () => { const uri = await downloadBaselineView(userId, journey.baselineRefs![photoView]!); await persist({ ...journey, photos: { ...journey.photos, [photoView]: uri } }); }) : null}
          {journey.photos?.[photoView] && !journey.baselineRefs?.[photoView] ? button('Retry saving photo to account', async () => { const path = await uploadBaselineView(userId, photoView, journey.photos![photoView]!); await persist({ ...journey, baselineRefs: { ...journey.baselineRefs, [photoView]: path } }); }) : null}
          <View style={styles.spacer} />{button('Continue', () => go('wardrobe'))}<Pressable accessibilityRole="link" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void run(() => go('wardrobe'))} style={({ pressed }) => ({ minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: busy || pressed ? 0.5 : 1 })}><Copy kind="small" style={{ color: '#536478', textDecorationLine: 'underline' }}>Skip for now</Copy></Pressable>
        </> : null}
        {stage === 'wardrobe' ? <>
          <Copy kind="title">Add your products.</Copy><Copy style={styles.subtitle}>Build your Skin Wardrobe. Add photos or enter your products manually to keep your routine in one place.</Copy>
          <Image source={require('@/assets/images/skincare-still-life-v1.png')} style={styles.productHero} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>{button('Take Photo', async () => {
              const photo = await pickReportPhoto(true);
              if (!photo) return;
              await persist(journey);
              stageProductPhoto(userId, photo);
              router.push('/skin-wardrobe/add-products?onboarding=1&mode=photo' as Href);
            })}</View>
            <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => void run(async () => { await persist(journey); router.push('/skin-wardrobe/add-products?onboarding=1&mode=manual' as Href); })} style={({ pressed }) => [styles.manualButton, { opacity: busy || pressed ? 0.6 : 1 }]}><Copy kind="small" style={{ fontWeight: '600' }}>Add Manually</Copy></Pressable>
          </View>
          <Copy kind="small" style={styles.label}>Your products ({products.length})</Copy>{products.length ? products.map(product => <View style={styles.productRow} key={product.id}><View style={styles.productThumbnail}><ProductPlaceholder name={product.name} /></View><View style={{ flex: 1 }}><Copy kind="small">{product.name}</Copy><Copy kind="small" style={styles.subtitle}>{product.brand}</Copy></View><Check size={18} color="#4D9A65" /></View>) : <Copy kind="small" style={styles.subtitle}>No products added yet. You can always add them later.</Copy>}
          <View style={styles.spacer} />{button('Continue', () => go('subscription'))}<Pressable accessibilityRole="link" disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => void run(() => go('subscription'))} style={({ pressed }) => ({ minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: busy || pressed ? 0.5 : 1 })}><Copy kind="small" style={{ color: '#536478', textDecorationLine: 'underline' }}>Skip for now</Copy></Pressable>
        </> : null}
        {stage === 'subscription' ? <>
          <Copy kind="eyebrow" style={{ color: '#967247' }}>YOUR NEXT CHAPTER</Copy><Copy kind="title">Complete your{ '\n' }membership.</Copy><Copy style={styles.subtitle}>A more personal approach to your skin, every day.</Copy>
          <View style={styles.membershipPrice}><Copy style={{ fontSize: 38 }}>$19.99<Copy kind="small"> / month</Copy></Copy><Copy kind="small" style={styles.subtitle}>Cancel anytime.</Copy></View>
          {['Full access to all features', 'Personalized routines', 'Inside-out insights', 'Procedure planning', 'Emerging science & product trials', 'Shopping from trusted partners'].map(item => <View style={styles.feature} key={item}><Check size={20} color="#C78A4B" /><Copy style={{ fontSize: 14, color: '#536478' }}>{item}</Copy></View>)}
          <View style={styles.spacer} />{button('Start My Membership', async () => { await persist({ ...journey, simulation: { price: 19.99, currency: 'USD', cadence: 'month', mode: 'simulation', confirmedAt: new Date().toISOString() }, stage: 'summary' }); scroll.current?.scrollTo({ y: 0 }); }, true)}<Copy kind="small" style={{ textAlign: 'center', color: '#718094', fontSize: 11 }}>Preview membership · No payment collected.</Copy>
        </> : null}
        {stage === 'summary' ? <>
          <Image source={require('@/assets/images/onboarding-nautilus-v1.png')} style={styles.summaryArt} />
          <Copy kind="title">Welcome to{ '\n' }SUBSTRATE{profile.displayName ? `, ${profile.displayName.split(' ')[0]}` : ''}.</Copy><Copy style={styles.subtitle}>Your skin story starts here. Here’s what you’ve shared so far.</Copy>
          {[{ title: 'Skin photos', detail: `${Object.keys({ ...journey.baselineRefs, ...journey.photos }).filter(key => journey.baselineRefs?.[key as PhotoView] || journey.photos?.[key as PhotoView]).length} of 3 baseline views saved`, Icon: Camera }, { title: 'Products', detail: products.length ? `${products.length} products in your Skin Wardrobe` : 'Add your products whenever you’re ready', Icon: Droplets }, { title: 'Profile', detail: profile.displayName || profile.skinGoals?.length ? 'Your preferences, ready to build on' : 'Personalize your profile at any time', Icon: CircleUserRound }].map(({ title, detail, Icon }) => <View style={styles.summaryRow} key={title}><View style={styles.icon}><Icon size={25} color="#168CD0" strokeWidth={1.2} /></View><View style={{ flex: 1 }}><Copy kind="small" style={styles.label}>{title}</Copy><Copy kind="small" style={styles.subtitle}>{detail}</Copy></View></View>)}
          <View style={styles.tip}><Watch size={24} color="#A86F4B" /><View style={{ flex: 1 }}><Copy kind="small">Your wellbeing, connected.</Copy><Copy kind="small" style={styles.subtitle}>Wearable connections are coming soon.</Copy></View></View><View style={styles.spacer} /><ReportButton copper label="Let’s Get Started" busy={busy} onPress={finish} />
        </> : null}
      </View>}
      {localOnly ? <Copy kind="small" style={styles.sync}>Progress saved on this device. Account sync is pending.</Copy> : null}
    </View>
  </ScrollView>
    <AuthModal visible={authOpen && !userId} initialMode="sign-up" onClose={() => { setAuthOpen(false); router.setParams({ authNext: undefined }); }} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: navy }, scroll: { flexGrow: 1, alignItems: 'center' }, shell: { width: '100%', maxWidth: 480, flexGrow: 1, paddingHorizontal: 12, paddingBottom: 16 },
  signOut: { position: 'absolute', right: 0, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  header: { height: 62, alignItems: 'center', justifyContent: 'center' }, back: { position: 'absolute', left: 0, padding: 12 }, progress: { flexDirection: 'row', gap: 6, marginHorizontal: 10, marginBottom: 12 }, segment: { flex: 1, height: 4, borderRadius: 4 },
  card: { backgroundColor: paper, padding: 22, borderRadius: 23, gap: 14, flexGrow: 1 }, subtitle: { color: '#64758A', fontSize: 13, lineHeight: 20 },
  heroContent: { position: 'relative' }, heroScrim: { position: 'absolute', top: -65, bottom: -12, left: -24, right: -24 },
  hero: { flexGrow: 1, marginHorizontal: -12, padding: 24 }, heroSpace: { minHeight: 245, flexGrow: 1 }, heroCopy: { gap: 14 }, heroTitle: { color: paper, fontSize: 44, lineHeight: 46 }, benefits: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 27 }, benefit: { alignItems: 'center', gap: 9 }, priceCard: { backgroundColor: paper, borderRadius: 22, padding: 17, gap: 9 },
  field: { borderWidth: 1, borderColor: '#E9E1D6', borderRadius: 13, padding: 12, gap: 5 }, label: { fontWeight: '600', fontSize: 12 }, input: { fontSize: 16, color: navy, minHeight: 36, padding: 0 }, row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, chip: { borderRadius: 20, borderWidth: 1, borderColor: '#E9E1D6', paddingVertical: 8, paddingHorizontal: 10 }, category: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderWidth: 1, borderColor: '#E9E1D6', borderRadius: 14 }, icon: { backgroundColor: '#FFFFFF', padding: 9, borderRadius: 12 }, spacer: { flexGrow: 1, minHeight: 16 },
  exampleBadge: { position: 'absolute', bottom: 18, backgroundColor: '#FBF6EEEE', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }, exampleThumbnail: { width: '100%', height: 64, borderRadius: 8, overflow: 'hidden', backgroundColor: '#EAE1D6' },
  photo: { height: 270, backgroundColor: '#EAE1D6', borderRadius: 15, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 12 }, faceGuide: { borderWidth: 1, borderColor: '#C6B9A8', width: 145, height: 180, borderRadius: 80, justifyContent: 'center', alignItems: 'center' }, fillImage: { width: '100%', height: '100%', resizeMode: 'contain' }, photoGuide: { position: 'absolute', top: 13, left: 13, bottom: 13, right: 13, borderWidth: 1, borderColor: '#FFFFFF88', borderRadius: 12 }, thumbnail: { flex: 1, minHeight: 100, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E9E1D6', borderRadius: 12, padding: 6, gap: 6 }, tip: { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: '#F0EDE6', borderRadius: 13, alignItems: 'center' },
  manualButton: { flex: 1, minHeight: 52, borderRadius: 28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9E1D6', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 }, productThumbnail: { width: 48, height: 60, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F6F3ED' },
  productHero: { width: '100%', height: 220, borderRadius: 15 }, productRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderColor: '#E9E1D6' }, membershipPrice: { paddingVertical: 22, borderBottomWidth: 1, borderColor: '#E9E1D6', marginBottom: 8, gap: 5 }, feature: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 4 }, summaryArt: { width: '100%', height: 140, borderRadius: 14, resizeMode: 'cover' }, summaryRow: { flexDirection: 'row', gap: 14, alignItems: 'center', borderBottomWidth: 1, borderColor: '#E9E1D6', paddingVertical: 12 }, sync: { color: '#BCC8D0', fontSize: 11, textAlign: 'center', padding: 12 },
});
