import type { Decision } from "../../packages/ingredient-engine/src/contracts";
import type { ReportAnswers } from "../../shared/report-questions.mjs";
export type { ReportAnswers };
export type ReportItem = {
  label: string;
  body: string;
  detail?: string;
  evidence?: string;
  ingredientId?: string;
  clarifications?: { label: string; body: string }[];
  sourceUrl?: string | null;
  productId?: string | null;
};
export type SkinReport = {
  experience?: "daily-summary-v1";
  id: string;
  version: string;
  createdAt: string;
  name: string;
  title: string;
  summary: string;
  photo?: string;
  mode: "optimize" | "fresh";
  answers: ReportAnswers;
  sections: { id: string; title: string; intro: string; items: ReportItem[] }[];
  concerns: string[];
  photoLimitations: string[];
  provenance: Record<string, string>;
  unlocked: boolean;
  price: number;
  currency: string;
  paymentMode: "simulation";
  cloudSaved?: boolean;
  decision?: Decision;
};
export type ReportSummary = Pick<
  SkinReport,
  "id" | "createdAt" | "name" | "summary" | "unlocked"
>;
export type ScanResult = {
  scan: {
    analysis: {
      faceDetected: boolean;
      summary: string;
      retakeReasons: string[];
      lighting: number;
      sharpness: number;
      framing: number;
      confidence: number;
    };
    model: string;
  };
  scanToken: string;
};
export type ReportDraft = {
  answers: ReportAnswers;
  photo?: string;
  scan?: ScanResult;
  productIds: string[];
  unlisted: string[];
  mode: "optimize" | "fresh";
  step: number;
};
