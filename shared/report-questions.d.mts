export type ReportAnswers = Record<string, string | string[]>;
export type ReportQuestion = {
  id: string;
  title: string;
  group: string;
  input?: string;
  optional?: boolean;
  placeholder?: string;
  multi?: boolean;
  options?: string[];
  labels?: Record<string, string>;
  when?: (answers: ReportAnswers) => boolean;
};
export const reportQuestions: ReportQuestion[];
export const questionGroups: string[];
export function visibleReportQuestions(
  answers: ReportAnswers,
  group?: string,
): ReportQuestion[];
export function validateReportAnswers(answers: ReportAnswers): ReportAnswers;
export function engineAnswers(answers: ReportAnswers): ReportAnswers;
