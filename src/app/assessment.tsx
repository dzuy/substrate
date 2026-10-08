import { getProfile, toProfileContext } from "@/services/profile";
import { profileReportAnswers } from "../../shared/profile-report-answers.mjs";
import { photoQualityIssue } from "../../shared/photo-quality.mjs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, type Href } from "expo-router";
import { Camera, Check } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, TextInput, View } from "react-native";
import { useAuth } from "@/lib/auth-context";
import {
  listCatalogProducts,
  listUserWardrobe,
  type CatalogProduct,
} from "@/services/catalog";
import {
  questionGroups,
  visibleReportQuestions,
  validateReportAnswers,
  type ReportQuestion,
} from "../../shared/report-questions.mjs";
import {
  Copy,
  Notice,
  Panel,
  ReportButton,
  ReportFrame,
  Spiral,
} from "@/report/ui";
import { fontFamily, useReportTheme } from "@/report/theme";
import { pickReportPhoto, reportApi, saveReport } from "@/report/service";
import type { ReportDraft, ScanResult, SkinReport } from "@/report/types";

const empty: ReportDraft = {
  answers: {},
  productIds: [],
  unlisted: [],
  mode: "optimize",
  step: 0,
};
export default function Assessment() {
  const { user } = useAuth();
  return user ? <AssessmentForUser key={user.id} userId={user.id} /> : null;
}
function AssessmentForUser({ userId }: { userId: string }) {
  const { theme: t } = useReportTheme();
  const router = useRouter();
  const key = `substrate-assessment-v1:${userId}`;
  const [draft, setDraft] = useState<ReportDraft>(empty);
  const [profileAnswers, setProfileAnswers] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [query, setQuery] = useState("");
  const [wardrobeProductIds, setWardrobeProductIds] = useState<string[]>([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [generated, setGenerated] = useState<SkinReport | null>(null);
  const locked = useRef(false);
  const alive = useRef(true);
  const currentDraft = useRef(draft);
  currentDraft.current = draft;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const patch = (value: Partial<ReportDraft>) =>
    setDraft((current) => ({ ...current, ...value }));
  useEffect(() => {
    let active = true;
    void (async () => {
      let restored = empty;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const value = JSON.parse(raw);
          if (value.answers && Number.isInteger(value.step) && value.step >= 0 && value.step <= 5)
            restored = { ...empty, ...value };
        }
      } catch {
        if (active) setStorageWarning("This device could not restore your assessment.");
      }
      let saved: Record<string, string> = {};
      try {
        const profile = await getProfile(userId);
        if (!profile.error) saved = profileReportAnswers(toProfileContext(profile.data));
      } catch { /* Missing profile remains editable in the questionnaire. */ }
      if (!active) return;
      setProfileAnswers(saved);
      setDraft({ ...restored, answers: { ...restored.answers, ...saved },
        step: restored.step === 1 && saved.name && saved.ageBand ? 2 : restored.step });
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [key, userId]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(key, JSON.stringify(draft)).catch(() =>
        setStorageWarning(
          "Your answers are in this session only. Keep this page open.",
        ),
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, key, ready]);
  useEffect(() => {
    if (draft.step !== 5 || catalogReady) return;
    let active = true;
    void Promise.all([listCatalogProducts(), listUserWardrobe(userId)])
      .then(([catalog, wardrobe]) => {
        if (!active) return;
        if (catalog.error) throw Error(catalog.error.message);
        const owned = (wardrobe.data || [])
          .filter((w) => w.status === "active" && w.product)
          .map((w) => w.product!);
        setProducts([
          ...new Map(
            [...(catalog.data || []), ...owned].map((p) => [p.id, p]),
          ).values(),
        ]);
        setWardrobeProductIds([
          ...new Set([
            ...owned.map((p) => p.id),
            ...currentDraft.current.productIds,
          ]),
        ]);
        setCatalogReady(true);
        setDraft((current) =>
          current.productIds.length
            ? current
            : { ...current, productIds: owned.map((p) => p.id) },
        );
      })
      .catch(() => {
        if (active)
          setError(
            "The product library could not load. Retry the library, or continue without adding products.",
          );
      });
    return () => {
      active = false;
    };
  }, [draft.step, catalogReady, userId, loadAttempt]);
  const execute = async (label: string, work: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(label);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      locked.current = false;
      setBusy("");
    }
  };
  const choosePhoto = (camera: boolean) =>
    execute("Preparing your photo", async () => {
      const photo = await pickReportPhoto(camera);
      if (photo && alive.current) {
        patch({ photo, scan: undefined });
        setGenerated(null);
      }
    });
  const scan = () =>
    execute("Reading your skin photo", async () => {
      if (!draft.photo) throw Error("Choose a photo first.");
      // Previously rejected cached results must not trap the user in a retry loop.
      const cached = draft.scan;
      const result =
        cached && !photoQualityIssue(cached.scan.analysis)
          ? cached
          : await reportApi<ScanResult>({ action: "scan", image: draft.photo });
      if (!alive.current) return;
      const issue = photoQualityIssue(result.scan.analysis);
      if (issue) {
        patch({ scan: undefined });
        throw Error(issue);
      }
      patch({ scan: result, step: profileAnswers.name && profileAnswers.ageBand ? 2 : 1 });
    });
  const answer = (q: ReportQuestion, value: string) => {
    setGenerated(null);
    setDraft((current) => {
      const previous = current.answers[q.id];
      let next: string | string[] = value;
      if (q.multi) {
        const list = Array.isArray(previous) ? previous : [];
        next = ["None", "Unsure"].includes(value)
          ? [value]
          : list.includes(value)
            ? list.filter((v) => v !== value)
            : [...list.filter((v) => !["None", "Unsure"].includes(v)), value];
      }
      return { ...current, answers: { ...current.answers, [q.id]: next } };
    });
  };
  const next = () => {
    const missing = visibleReportQuestions(
      draft.answers,
      questionGroups[draft.step - 1],
    ).find(
      (q) =>
        !q.optional &&
        (!draft.answers[q.id] ||
          (Array.isArray(draft.answers[q.id]) && !draft.answers[q.id].length) ||
          (typeof draft.answers[q.id] === "string" &&
            !String(draft.answers[q.id]).trim())),
    );
    if (missing) {
      setError(`Please answer: ${missing.title}`);
      return;
    }
    setError("");
    patch({ step: draft.step + 1 });
  };
  const toggleProduct = (id: string) => {
    setGenerated(null);
    // Keep products visible after deselection so the action is clear and reversible.
    setWardrobeProductIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    setDraft((current) => ({
      ...current,
      productIds: current.productIds.includes(id)
        ? current.productIds.filter((p) => p !== id)
        : [...current.productIds, id],
    }));
  };
  const generate = () =>
    execute(
      generated
        ? "Saving your report"
        : "Connecting your findings to ingredients and products",
      async () => {
        validateReportAnswers(draft.answers);
        if (!draft.scan)
          throw Error("Return to your photo and complete the scan first.");
        const result = generated || {
          ...(
            await reportApi<{ report: SkinReport }>({
              action: "generate",
              scanToken: draft.scan.scanToken,
              answers: draft.answers,
              productIds: draft.productIds,
              mode: draft.mode,
            })
          ).report,
          photo: draft.photo,
        };
        if (!alive.current) return;
        if (JSON.stringify(currentDraft.current) !== JSON.stringify(draft))
          throw Error(
            "Your answers changed while the report was building. Generate again with the updated answers.",
          );
        setGenerated(result);
        const saved = await saveReport(userId, result);
        await AsyncStorage.removeItem(key).catch(() => {});
        if (alive.current)
          router.replace(`/report?id=${saved.id}&reveal=1` as Href);
      },
    );
  if (!ready)
    return (
      <ReportFrame>
        <Copy>Restoring your assessment…</Copy>
      </ReportFrame>
    );
  const group = questionGroups[draft.step - 1];
  const progress = draft.step === 0 ? 0 : draft.step === 5 ? 2 : 1;
  const inputStyle = {
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 12,
    padding: 14,
    fontFamily: fontFamily(t.bodyFont),
    fontSize: 16,
    color: t.ink,
    backgroundColor: t.surface,
  };
  return (
    <ReportFrame key={draft.step}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {["Your photo", "Your context", "Your products", "Your report"].map(
          (label, i) => (
            <View key={label} style={{ flex: 1, gap: 8 }}>
              <View
                style={{
                  height: 3,
                  backgroundColor: i <= progress ? t.gold : t.line,
                }}
              />
              <Copy
                kind="small"
                style={{
                  fontSize: 11,
                  color: i === progress ? t.ink : t.muted,
                }}
              >
                {label}
              </Copy>
            </View>
          ),
        )}
      </View>
      {storageWarning ? <Notice>{storageWarning}</Notice> : null}
      {draft.step === 0 ? (
        <>
          <Copy kind="eyebrow" style={{ color: t.gold }}>
            01 / YOUR BASELINE
          </Copy>
          <Copy kind="title">Let’s start with your skin.</Copy>
          <Copy style={{ color: t.muted }}>
            One clear, makeup-free photo. Face the camera in soft daylight, with
            your whole face visible. Avoid filters, direct sun, or taking it
            just after exercise.
          </Copy>
          <Panel style={{ alignItems: "center", padding: 20 }}>
            {draft.photo ? (
              <Image
                accessibilityLabel="Your selected face photo"
                source={{ uri: draft.photo }}
                style={{
                  width: "100%",
                  height: 330,
                  borderRadius: t.radius,
                  resizeMode: "contain",
                }}
              />
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 28 }}>
                <Spiral size={180} />
                <Camera color={t.gold} size={28} />
                <Copy kind="small" style={{ color: t.muted, marginTop: 12 }}>
                  Your first point of reference
                </Copy>
              </View>
            )}
            <View style={{ width: "100%", gap: 10 }}>
              <ReportButton
                label={
                  draft.photo ? "Choose a different photo" : "Upload a photo"
                }
                secondary
                disabled={!!busy}
                onPress={() => void choosePhoto(false)}
              />
              <ReportButton
                label="Take a photo"
                secondary
                disabled={!!busy}
                onPress={() => void choosePhoto(true)}
              />
            </View>
          </Panel>
          <ReportButton
            label={
              busy === "Reading your skin photo"
                ? "Analyzing..."
                : "Analyze photo & continue"
            }
            busy={busy === "Reading your skin photo"}
            disabled={
              !draft.photo || (!!busy && busy !== "Reading your skin photo")
            }
            onPress={() => void scan()}
          />
        </>
      ) : null}
      {draft.step >= 1 && draft.step <= 4 ? (
        <>
          <Copy kind="eyebrow" style={{ color: t.gold }}>
            02 / YOUR CONTEXT · {draft.step} OF 4
          </Copy>
          <Copy kind="title">
            {group === "About you"
              ? "A little about you."
              : group === "Your skin"
                ? "How does your skin feel?"
                : group === "Your everyday"
                  ? "The life around your skin."
                  : "What your photo can’t tell us."}
          </Copy>
          <Copy style={{ color: t.muted }}>
            These answers shape your report. Choose what’s true for you;
            “unsure” is always better than a guess.
          </Copy>
          {visibleReportQuestions(draft.answers, group).filter((q) => !profileAnswers[q.id]).map((q) => (
            <Panel key={q.id}>
              <Copy style={{ fontWeight: "600" }}>
                {q.title}
                {q.optional ? " · Optional" : " · Required"}
              </Copy>
              {q.input ? (
                <TextInput
                  accessibilityLabel={`${q.title}, ${q.optional ? "optional" : "required"}`}
                  placeholder={q.placeholder || q.title}
                  placeholderTextColor={t.muted}
                  value={String(draft.answers[q.id] || "")}
                  onChangeText={(v) => answer(q, v)}
                  maxLength={1200}
                  multiline={q.id === "notes" || q.id === "supplements"}
                  style={inputStyle}
                />
              ) : (
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}
                >
                  {q.options?.map((value) => {
                    const current = draft.answers[q.id];
                    const selected = Array.isArray(current)
                      ? current.includes(value)
                      : current === value;
                    return (
                      <Pressable
                        key={value}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        disabled={!!busy}
                        onPress={() => answer(q, value)}
                        style={{
                          paddingHorizontal: 15,
                          paddingVertical: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: selected ? t.ink : t.line,
                          backgroundColor: selected ? t.ink : t.surface,
                        }}
                      >
                        <Copy
                          kind="small"
                          style={{ color: selected ? t.paper : t.ink }}
                        >
                          {q.labels?.[value] || value}
                        </Copy>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Panel>
          ))}
          <ReportButton
            label={draft.step === 4 ? "Continue to your products" : "Continue"}
            onPress={next}
          />
        </>
      ) : null}
      {draft.step === 5 ? (
        <>
          <Copy kind="eyebrow" style={{ color: t.gold }}>
            03 / YOUR PRODUCTS
          </Copy>
          <Copy kind="title">Start with what you own.</Copy>
          <Copy style={{ color: t.muted }}>
            Select the products you use for a more useful report. Search the
            catalog to add products to your wardrobe. This step is optional.
          </Copy>
          <Panel>
            <Copy kind="heading">Your approach</Copy>
            <Copy kind="small" style={{ color: t.muted }}>
              Choose one approach for your report.
            </Copy>
            <View style={{ gap: 10 }}>
              {[
                ["optimize", "Optimize what I own"],
                ["fresh", "Build a fresh routine"],
              ].map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="checkbox"
                  accessibilityLabel={label}
                  accessibilityState={{
                    checked: draft.mode === value,
                    disabled: !!busy,
                  }}
                  disabled={!!busy}
                  onPress={() => {
                    setGenerated(null);
                    patch({ mode: value as "optimize" | "fresh" });
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 10,
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      borderWidth: 1,
                      borderColor: draft.mode === value ? t.ink : t.line,
                      backgroundColor: draft.mode === value ? t.ink : t.surface,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {draft.mode === value ? (
                      <Check size={17} color={t.paper} />
                    ) : null}
                  </View>
                  <Copy>{label}</Copy>
                </Pressable>
              ))}
            </View>
          </Panel>
          <Panel>
            <Copy kind="heading">Your wardrobe</Copy>
            <Copy kind="small" style={{ color: t.muted }}>
              Check the products you use to include them in this report. Uncheck
              a product to leave it out.
            </Copy>
            {!catalogReady ? (
              <ReportButton
                secondary
                label="Retry product library"
                onPress={() => setLoadAttempt((v) => v + 1)}
              />
            ) : null}
            <TextInput
              accessibilityLabel="Search your products"
              value={query}
              onChangeText={setQuery}
              placeholder="Search product or brand"
              placeholderTextColor={t.muted}
              style={inputStyle}
            />
            {(query
              ? products
                  .filter((p) =>
                    `${p.brand?.name} ${p.name}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .slice(0, 15)
              : products.filter((p) => wardrobeProductIds.includes(p.id))
            ).map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="checkbox"
                accessibilityLabel={`${p.brand?.name || ""} ${p.name}`.trim()}
                accessibilityState={{
                  checked: draft.productIds.includes(p.id),
                  disabled: !!busy,
                }}
                disabled={!!busy}
                onPress={() => toggleProduct(p.id)}
                style={{
                  flexDirection: "row",
                  gap: 12,
                  alignItems: "center",
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderColor: t.line,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Copy kind="small" style={{ color: t.muted }}>
                    {p.brand?.name}
                  </Copy>
                  <Copy>{p.name}</Copy>
                </View>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Copy
                    kind="small"
                    style={{
                      color: draft.productIds.includes(p.id) ? t.ink : t.muted,
                    }}
                  >
                    {draft.productIds.includes(p.id)
                      ? "Included"
                      : "Not included"}
                  </Copy>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      borderWidth: 1,
                      borderColor: draft.productIds.includes(p.id)
                        ? t.ink
                        : t.line,
                      backgroundColor: draft.productIds.includes(p.id)
                        ? t.ink
                        : t.surface,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {draft.productIds.includes(p.id) ? (
                      <Check size={17} color={t.paper} />
                    ) : null}
                  </View>
                </View>
              </Pressable>
            ))}
            {query &&
            !products.some((p) =>
              `${p.brand?.name} ${p.name}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            ) ? (
              <Copy kind="small">
                No products found. Try another product or brand name.
              </Copy>
            ) : null}
            <Copy kind="small">
              {draft.productIds.length} catalog products selected
            </Copy>
          </Panel>
          <ReportButton
            label={
              generated ? "Retry saving report" : "Create my report preview"
            }
            disabled={!!busy}
            onPress={() => void generate()}
          />
        </>
      ) : null}
      {busy ? (
        <Panel>
          <Copy>{busy}…</Copy>
          <Copy kind="small" style={{ color: t.muted }}>
            This can take a minute. Keep this page open.
          </Copy>
        </Panel>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
    </ReportFrame>
  );
}
