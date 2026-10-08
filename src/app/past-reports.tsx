import { useRouter, useFocusEffect, type Href } from "expo-router";
import { ArrowUpRight, FileText } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { Copy, Notice, Panel, ReportButton, ReportFrame } from "@/report/ui";
import { useReportTheme } from "@/report/theme";
import { listReports } from "@/report/service";
import type { ReportSummary } from "@/report/types";

export default function PastReports() {
  const { user } = useAuth();
  const { theme: t } = useReportTheme();
  const router = useRouter();
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      if (user)
        void listReports(user.id)
          .then((result) => {
            if (active) {
              setReports(result.reports);
              setError(result.warning);
              setLoading(false);
            }
          })
          .catch(() => {
            if (active) {
              setError("Reports could not be loaded. Try refreshing.");
              setLoading(false);
            }
          });
      return () => { active = false; };
    // Changing attempt retries the request while this screen stays focused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, attempt]),
  );
  return (
    <ReportFrame wide showStyleGuide={false}>
      <View style={{ gap: 18 }}>
        <Copy kind="title">Reports</Copy>
        <Copy style={{ color: t.muted }}>Your skin story, saved in one place. Revisit your insights and next steps.</Copy>
        {error ? <><Notice>{error}</Notice><ReportButton secondary label="Try again" onPress={() => setAttempt((value) => value + 1)} /></> : null}
        {loading ? (
          <Copy style={{ color: t.muted }}>Loading your reports…</Copy>
        ) : reports.length ? (
          reports.map((r) => (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              onPress={() => router.push(`/report?id=${r.id}` as Href)}
            >
              <Panel style={{ flexDirection: "row", alignItems: "center" }}>
                <FileText color={t.gold} size={27} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Copy>
                    {r.name === "Your" ? "Your" : r.name + "’s"} Skin
                    Intelligence Report
                  </Copy>
                  <Copy kind="small" style={{ color: t.muted }}>
                    {new Date(r.createdAt).toLocaleDateString()} ·{" "}
                    {r.unlocked ? "Full report" : "Preview ready"}
                  </Copy>
                </View>
                <ArrowUpRight color={t.ink} size={20} />
              </Panel>
            </Pressable>
          ))
        ) : (
          <Panel>
            <Copy style={{ color: t.muted }}>
              No reports yet. Start with a photo to discover your baseline,
              your goals, and your next step.
            </Copy>
          </Panel>
        )}
      </View>
      <ReportButton label="Create a new report" onPress={() => router.navigate("/assessment" as Href)} />
    </ReportFrame>
  );
}
