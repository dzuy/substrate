import { reportSectionLabel } from "../../shared/report-section-labels.mjs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Download, LockKeyhole, Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  type ViewStyle,
} from "react-native";
import { useAuth } from "@/lib/auth-context";
import { Copy, Notice, Panel, ReportButton, ReportFrame } from "@/report/ui";
import { useReportTheme } from "@/report/theme";
import {
  deleteReport,
  exportReport,
  getReport,
  unlockReport,
} from "@/report/service";
import type { SkinReport } from "@/report/types";

export default function ReportRoute() {
  const { user } = useAuth();
  const { id, reveal } = useLocalSearchParams<{
    id: string;
    reveal?: string;
  }>();
  return user ? (
    <ReportView
      key={`${user.id}:${id}`}
      userId={user.id}
      id={id}
      reveal={reveal}
    />
  ) : null;
}
function ReportView({
  userId,
  id,
  reveal,
}: {
  userId: string;
  id: string;
  reveal?: string;
}) {
  const { theme: t } = useReportTheme();
  const router = useRouter();
  const [report, setReport] = useState<SkinReport | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    setError("");
    void getReport(userId, id)
      .then(async (result) => {
        if (!active) return;
        let seen = true;
        const key = `substrate-preview-seen:${userId}:${id}`;
        try {
          seen = Boolean(await AsyncStorage.getItem(key));
        } catch {
          /* Locked is the safe fallback. */
        }
        if (!active) return;
        setReport(result);
        setLoading(false);
        if (result.experience !== "daily-summary-v1" && !result.unlocked && reveal === "1" && !seen) {
          setPreview(true);
          void AsyncStorage.setItem(key, "1").catch(() => {});
          timer = setTimeout(() => setPreview(false), 6000);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [userId, id, reveal, attempt]);
  const unlock = async () => {
    if (!report || busy) return;
    setBusy("unlock");
    setError("");
    try {
      setReport(await unlockReport(userId, report));
      setPreview(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to unlock.");
    } finally {
      setBusy("");
    }
  };
  const download = async () => {
    if (!report || !report.unlocked || busy) return;
    setBusy("pdf");
    setError("");
    try {
      await exportReport(report, t);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to export your report.",
      );
    } finally {
      setBusy("");
    }
  };
  const remove = async () => {
    if (busy) return;
    setBusy("delete");
    setDeleteError("");
    try {
      await deleteReport(userId, id);
      setConfirmDelete(false);
      router.replace("/past-reports" as Href);
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "Unable to delete. Please try again.",
      );
    } finally {
      setBusy("");
    }
  };
  const locked = Boolean(report && report.experience !== "daily-summary-v1" && !report.unlocked && !preview);
  return (
    <>
      <ReportFrame>
        {loading ? <Copy>Opening your report…</Copy> : null}
        {error && !locked ? <Notice>{error}</Notice> : null}
        {!loading && !report ? (
          <>
            <ReportButton
              label="Try again"
              onPress={() => setAttempt((v) => v + 1)}
            />
            <ReportButton
              secondary
              label="Back to reports"
              onPress={() => router.replace("/home" as Href)}
            />
          </>
        ) : null}
        {report ? (
          <>
            <View style={{ gap: 16 }}>
              <Copy kind="eyebrow" style={{ color: t.gold }}>
                PERSONAL SKIN INTELLIGENCE /{" "}
                {new Date(report.createdAt).toLocaleDateString()}
              </Copy>
              <Copy kind="title">
                {report.name === "Your" ? "Your" : report.name + "’s"} skin,
                understood.
              </Copy>
              <Copy style={{ color: t.muted }}>{report.summary}</Copy>
              {preview ? (
                <Notice>
                  Your six-second preview is open. The full report unlocks with
                  a simulated $79 purchase.
                </Notice>
              ) : null}
            </View>
            {report.photo ? (
              <Image
                accessibilityLabel="Your report baseline photo"
                source={{ uri: report.photo }}
                style={{
                  width: "100%",
                  height: 300,
                  resizeMode: "contain",
                  borderRadius: t.radius,
                  backgroundColor: t.surface,
                }}
              />
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {report.concerns.map((c) => (
                <View
                  key={c}
                  style={{
                    paddingHorizontal: 15,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: t.line,
                    borderRadius: 30,
                  }}
                >
                  <Copy kind="small">{c}</Copy>
                </View>
              ))}
            </View>
            {locked ? (
              <View
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
                style={
                  Platform.OS === "web"
                    ? ({ filter: "blur(8px)", userSelect: "none" } as ViewStyle)
                    : { opacity: 0.2 }
                }
              >
                {report.sections.slice(0, 4).map((s) => (
                  <Panel key={s.id} style={{ marginBottom: 20 }}>
                    <Copy kind="heading">{s.title}</Copy>
                    {[90, 100, 75, 85].map((width, i) => (
                      <View
                        key={i}
                        style={{
                          height: 12,
                          width: `${width}%`,
                          backgroundColor: t.line,
                          borderRadius: 6,
                        }}
                      />
                    ))}
                  </Panel>
                ))}
              </View>
            ) : (
              report.sections.map((section, i) => (
                <Panel key={section.id}>
                  <Copy kind="eyebrow" style={{ color: t.gold }}>
                    {reportSectionLabel(section, i).toUpperCase()}
                  </Copy>
                  <Copy kind="heading">{section.title}</Copy>
                  <Copy style={{ color: t.muted }}>{section.intro}</Copy>
                  {section.items.map((entry, j) => (
                    <View
                      key={j}
                      style={{
                        paddingTop: 18,
                        borderTopWidth: 1,
                        borderColor: t.line,
                        gap: 8,
                      }}
                    >
                      <Copy style={{ fontWeight: "600" }}>{entry.label}</Copy>
                      {entry.evidence ? (
                        <Copy
                          kind="eyebrow"
                          style={{ color: t.gold, letterSpacing: 1 }}
                        >
                          {entry.evidence.toUpperCase()}
                        </Copy>
                      ) : null}
                      <Copy>{entry.body}</Copy>
                      {entry.clarifications?.map((note) => (
                        <View key={note.label} style={{ gap: 4 }}>
                          <Copy kind="small" style={{ fontWeight: "600" }}>
                            {note.label}
                          </Copy>
                          <Copy kind="small" style={{ color: t.muted }}>
                            {note.body}
                          </Copy>
                        </View>
                      ))}
                      {entry.detail ? (
                        <Copy kind="small" style={{ color: t.muted }}>
                          {entry.detail}
                        </Copy>
                      ) : null}
                      {entry.sourceUrl?.startsWith("https://") ? (
                        <Pressable
                          accessibilityRole="link"
                          onPress={() => void Linking.openURL(entry.sourceUrl!)}
                        >
                          <Copy
                            kind="small"
                            style={{ textDecorationLine: "underline" }}
                          >
                            View source ↗
                          </Copy>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </Panel>
              ))
            )}
            {report.unlocked ? (
              <>
                <Panel>
                  <Copy kind="heading">A report you can keep.</Copy>
                  <Copy style={{ color: t.muted }}>
                    Download or share a private PDF with the current design
                    settings. The PDF includes your photo and personal answers.
                  </Copy>
                  <Download color={t.gold} size={23} />
                  <ReportButton
                    label="Share / download PDF"
                    busy={busy === "pdf"}
                    onPress={() => void download()}
                  />
                </Panel>
                <Panel>
                  <Copy kind="small" style={{ color: t.muted }}>
                    Photo limitations:{" "}
                    {report.photoLimitations.join(" ") ||
                      "No additional limitations recorded."}
                  </Copy>
                </Panel>
                <ReportButton
                  secondary
                  label="Back to my reports"
                  onPress={() => router.replace("/home" as Href)}
                />
              </>
            ) : null}
            <ReportButton
              destructive
              label="Delete report"
              disabled={Boolean(busy)}
              onPress={() => {
                setDeleteError("");
                setConfirmDelete(true);
              }}
            />
          </>
        ) : null}
      </ReportFrame>
      <Modal
        visible={confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setConfirmDelete(false);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#102F3C88",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            accessibilityViewIsModal
            style={{ width: "100%", maxWidth: 460, alignSelf: "center" }}
          >
            <Panel>
              <Copy kind="heading">Permanently delete this report?</Copy>
              <Copy style={{ color: t.muted }}>
                This removes the report and its saved photo from your account
                and this device. It cannot be undone. PDFs you already
                downloaded or shared will remain.
              </Copy>
              {deleteError ? <Notice>{deleteError}</Notice> : null}
              <ReportButton
                secondary
                label="Keep report"
                disabled={Boolean(busy)}
                onPress={() => setConfirmDelete(false)}
              />
              <ReportButton
                destructive
                label="Permanently delete report"
                busy={busy === "delete"}
                disabled={Boolean(busy)}
                onPress={() => void remove()}
              />
            </Panel>
          </View>
        </View>
      </Modal>
      <Modal
        visible={locked && !confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => router.replace("/home" as Href)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#102F3C88",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          >
            <View
              accessibilityViewIsModal
              style={{
                width: "100%",
                maxWidth: 460,
                alignSelf: "center",
                backgroundColor: t.surface,
                borderRadius: t.radius,
                padding: 32,
                gap: 20,
              }}
            >
              <LockKeyhole size={28} color={t.gold} />
              <Copy kind="eyebrow" style={{ color: t.gold }}>
                YOUR FULL PICTURE
              </Copy>
              <Copy kind="title" style={{ fontSize: 38 * t.scale }}>
                Your skin deserves a clear next step.
              </Copy>
              <Copy style={{ color: t.muted }}>
                Unlock your ingredient connections, product matches, wardrobe
                review, and personal routine in one report.
              </Copy>
              {[
                "Your complete skin intelligence report",
                "Ingredients and products, with reasons",
                "A shareable PDF to keep",
              ].map((line) => (
                <View
                  key={line}
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <Check size={17} color={t.gold} />
                  <Copy kind="small" style={{ flex: 1 }}>
                    {line}
                  </Copy>
                </View>
              ))}
              <Copy kind="title">
                $79<Copy kind="small"> USD · one report</Copy>
              </Copy>
              <ReportButton
                label="Simulate $79 purchase & unlock"
                busy={busy === "unlock"}
                onPress={() => void unlock()}
              />
              <Copy
                kind="small"
                style={{ color: t.muted, textAlign: "center" }}
              >
                Preview checkout only. No card required. No charge.
              </Copy>
              {error ? <Notice>{error}</Notice> : null}
              <ReportButton
                destructive
                label="Delete report"
                disabled={Boolean(busy)}
                onPress={() => {
                  setDeleteError("");
                  setConfirmDelete(true);
                }}
              />
              <ReportButton
                secondary
                label="Back to my reports"
                onPress={() => router.replace("/home" as Href)}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
