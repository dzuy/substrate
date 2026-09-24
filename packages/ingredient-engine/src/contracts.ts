export type Row = Record<string, any> & { _source: { sheet: string; row: number } };
export interface Knowledge { schemaVersion: number; version: string; sha256: string; sourceFile: string; tables: Record<string, Row[]> }
export interface Finding { concern: string; assessment: string; observation?: string }
export interface Analysis { faceDetected: boolean; lighting: number; sharpness: number; framing: number; confidence: number; retakeReasons?: string[]; detailedFindings: Finding[]; regions?: Array<Record<string, any>>; [key: string]: any }
export type Answers = Record<string, string | string[]>;
export type Status = 'candidate' | 'needs_context' | 'withheld' | 'clinician_review' | 'evidence_review' | 'research_only' | 'no_change';
export interface State { conditionId: string; name: string; supported: boolean; source: string; concerns: string[]; reasons: string[] }
export interface DecisionInput { analysis: Analysis; answers: Answers; now: string; assumedContext?: { ageBand: string; source: string }; clinicalApprovals?: ClinicalApproval[] }
export interface ClinicalApproval { id: string; version: string; approved: boolean; form: string; trigger: string; action: 'clinician_review' | 'withheld' | 'candidate' }
export interface Trace { conditionId: string; pathwayId: string; relevance: number; evidenceScore: number | null; sourceRows: string[]; origin: string; evidenceIds: string[]; endpointApplicable: boolean; modifierIds: string[] }
export interface Card { ingredientId: string; name: string; form: string; concerns: string[]; conditionIds: string[]; pathwayIds: string[]; pathwayId: string; job: string; status: Status; reasons: string[]; ruleIds: string[]; findingRefs: Array<{concern: string; source: string; field?: string; regions: string[]}>; explanation: string; evidence: string; evidenceIds: string[]; source: string | null; sourceRow: string; priority: number; trace: Trace[]; action: string; admission: string }
export interface Decision { knowledgeVersion: string; ruleVersion: string; createdAt: string; answers: Answers; assumedContext: DecisionInput['assumedContext']; status: string; message: string; cards: Card[]; notes: string[]; unmetConcerns: string[]; states: State[]; pathways: Array<{id:string;priority:number}>; coverage: Record<string, unknown>; policyNotes: string[] }
