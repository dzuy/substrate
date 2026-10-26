import { clarifyReport } from "../../shared/report-clarifications.mjs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { encode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import type { ReportTheme } from "./theme";
import type { SkinReport, ReportSummary } from "./types";

class DeletedReportError extends Error {}

function endpoint() {
  if (process.env.EXPO_PUBLIC_REPORT_API_URL)
    return process.env.EXPO_PUBLIC_REPORT_API_URL;
  if (Platform.OS === "web" && typeof window !== "undefined")
    return __DEV__ &&
      ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? "http://localhost:4318/api/skin-report"
      : "/api/skin-report";
  throw Error(
    "Set EXPO_PUBLIC_REPORT_API_URL to the report server address for native builds.",
  );
}
export async function reportRequest(body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw Error("Sign in to continue.");
  // React Native's AbortSignal polyfill does not expose the static timeout API.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  let response: Response;
  try {
    response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Report service unavailable." }));
    if (response.status === 410) throw new DeletedReportError(error.error);
    throw Error(error.error || "Unable to complete request.");
  }
  return response;
}
export async function reportApi<T>(body: Record<string, unknown>): Promise<T> {
  return (await reportRequest(body)).json();
}
const cacheKey = (userId: string) => `substrate-reports-v1:${userId}`;
export async function localReports(userId: string): Promise<SkinReport[]> {
  const raw = await AsyncStorage.getItem(cacheKey(userId));
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
async function cacheReport(userId: string, report: SkinReport) {
  const existing = await localReports(userId);
  await AsyncStorage.setItem(
    cacheKey(userId),
    JSON.stringify(
      [report, ...existing.filter((r) => r.id !== report.id)].slice(0, 5),
    ),
  );
}
export async function saveReport(
  userId: string,
  report: SkinReport,
): Promise<SkinReport> {
  let cloudSaved = false;
  try {
    await reportApi({ action: "save", report });
    if (report.unlocked) await reportApi({ action: "unlock", id: report.id });
    cloudSaved = true;
  } catch (error) {
    if (error instanceof DeletedReportError) {
      await forgetReport(userId, report.id);
      throw error;
    }
    /* Keep the device copy pending a later cloud retry. */
  }
  const result = { ...report, cloudSaved };
  try {
    await cacheReport(userId, result);
  } catch {
    if (!cloudSaved)
      throw Error(
        "Your report is ready, but it could not be saved. Keep this page open and retry saving.",
      );
  }
  return result;
}
export async function listReports(
  userId: string,
): Promise<{ reports: ReportSummary[]; warning: string }> {
  const local = await localReports(userId).catch(() => []);
  // Migrate reports created before cloud storage was enabled, including unlocks.
  for (let i = 0; i < local.length; i++) {
    if (!local[i].cloudSaved) {
      try {
        local[i] = await saveReport(userId, local[i]);
      } catch (error) {
        if (!(error instanceof DeletedReportError)) throw error;
        local.splice(i--, 1);
      }
    }
  }
  let warning = "";
  let remote: ReportSummary[] = [];
  try {
    const data = await reportApi<{
      deletedIds: string[];
      reports: {
        id: string;
        created_at: string;
        name: string;
        summary: string;
        simulated_unlocked: boolean;
      }[];
    }>({ action: "list" });
    for (const id of data.deletedIds || []) {
      const index = local.findIndex((r) => r.id === id);
      if (index >= 0) local.splice(index, 1);
      await forgetReport(userId, id);
    }
    remote = data.reports.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      name: r.name,
      summary: r.summary,
      unlocked: r.simulated_unlocked,
    }));
  } catch {
    warning =
      "Cloud reports are unavailable. Reports saved on this device are still accessible.";
  }
  const map = new Map(local.map((r) => [r.id, r as ReportSummary]));
  remote.forEach((r) => {
    const cached = map.get(r.id);
    map.set(r.id, { ...r, unlocked: r.unlocked || Boolean(cached?.unlocked) });
  });
  return {
    reports: [...map.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    ),
    warning,
  };
}
export async function getReport(
  userId: string,
  id: string,
): Promise<SkinReport> {
  let cached = (await localReports(userId).catch(() => [])).find(
    (r) => r.id === id,
  );
  if (cached && !cached.cloudSaved) cached = await saveReport(userId, cached);
  try {
    const data = await reportApi<{ report: SkinReport }>({ action: "get", id });
    return clarifyReport({
      ...data.report,
      unlocked: data.report.unlocked || Boolean(cached?.unlocked),
      cloudSaved: true,
    });
  } catch (error) {
    if (error instanceof DeletedReportError) {
      await forgetReport(userId, id);
      throw error;
    }
    if (cached) return clarifyReport(cached);
    throw error;
  }
}
async function forgetReport(userId: string, id: string) {
  const reports = await localReports(userId);
  await AsyncStorage.setItem(
    cacheKey(userId),
    JSON.stringify(reports.filter((r) => r.id !== id)),
  );
  await AsyncStorage.removeItem(`substrate-preview-seen:${userId}:${id}`);
}
export async function deleteReport(userId: string, id: string) {
  await reportApi({ action: "delete", id });
  await forgetReport(userId, id);
}
export async function unlockReport(userId: string, report: SkinReport) {
  let cloudSaved = false;
  try {
    await reportApi({ action: "save", report });
    await reportApi({ action: "unlock", id: report.id });
    cloudSaved = true;
  } catch (error) {
    if (error instanceof DeletedReportError) {
      await forgetReport(userId, report.id);
      throw error;
    }
    /* Simulation may be saved locally. */
  }
  const result = { ...report, unlocked: true, cloudSaved };
  try {
    await cacheReport(userId, result);
  } catch {
    if (!cloudSaved)
      throw Error("Unable to save the simulated unlock. Please try again.");
  }
  return result;
}
export async function pickReportPhoto(camera = false, frontCamera = true): Promise<string | null> {
  if (camera && Platform.OS !== "web") {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted)
      throw Error("Allow camera access or choose a photo from your library.");
  }
  const result = await (
    camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync
  )({ mediaTypes: ["images"], quality: 0.9, cameraType: frontCamera ? ImagePicker.CameraType.front : ImagePicker.CameraType.back });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  context.resize(
    asset.width > asset.height
      ? { width: Math.min(1400, asset.width) }
      : { height: Math.min(1400, asset.height) },
  );
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.85,
    base64: true,
  });
  if (!image.base64)
    throw Error("Could not prepare this photo. Try another image.");
  if (image.base64.length > 3_700_000)
    throw Error("This photo is too large. Try a smaller image.");
  return `data:image/jpeg;base64,${image.base64}`;
}
export async function exportReport(report: SkinReport, theme: ReportTheme) {
  const response = await reportRequest({ action: "pdf", report, theme });
  if (Platform.OS === "web") {
    const blob = await response.blob();
    const file = new File([blob], "Substrate-Skin-Report.pdf", {
      type: "application/pdf",
    });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "My Substrate report" });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    const uri = FileSystem.cacheDirectory + "Substrate-Skin-Report.pdf";
    await FileSystem.writeAsStringAsync(
      uri,
      encode(await response.arrayBuffer()),
      { encoding: FileSystem.EncodingType.Base64 },
    );
    if (await Sharing.isAvailableAsync())
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
      });
    else throw Error("Sharing is unavailable on this device.");
  }
}
