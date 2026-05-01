export interface DecisionAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: Date;
}

export type RequestType =
  | "Hata"
  | "Yeni Özellik"
  | "Mimari Karar"
  | "UI/UX Kararı"
  | "API Entegrasyonu"
  | "Güvenlik"
  | "Diğer";

export type Priority = "Düşük" | "Orta" | "Kritik";

export type ExpectedOutput =
  | "Karar"
  | "Prompt"
  | "Teknik Plan"
  | "Hata Analizi"
  | "Kod Review";

export type DecisionStatus =
  | "draft"
  | "analyzing"
  | "completed"
  | "approved"
  | "rejected"
  | "observation"
  | "prompt_generated";

export type AIRole = "chatgpt_judge" | "claude_engineer" | "codex_reviewer";

export interface AIAnalysis {
  role: AIRole;
  title: string;
  summary: string;
  strengths: string[];
  risks: string[];
  objections: string[];
  recommendation: string;
  confidenceScore: number; // 0–100
}

export interface FinalVerdict {
  verdict: string;
  executionPlan: string[];
  rejectedSuggestions: string[];
  risks: string[];
  nextAction: string;
  confidenceScore: number; // 0–100
}

export interface PromptOutput {
  targetTool: string;
  promptTitle: string;
  promptBody: string;
}

export interface DecisionRequest {
  id: string;
  projectName: string;
  requestType: RequestType;
  priority: Priority;
  problem: string;
  expectedOutput: ExpectedOutput;
  repoRequired: boolean;
  createdAt: Date;
  status: DecisionStatus;
  attachments?: DecisionAttachment[];
}

export type AnalysisSource = "mock" | "live";

export interface DecisionResult {
  requestId: string;
  analyses: AIAnalysis[];
  finalVerdict: FinalVerdict;
  promptOutput: PromptOutput;
  createdAt: Date;
  claudeSource?: AnalysisSource;
  codexSource?: AnalysisSource;
  judgeSource?: AnalysisSource;
  saved?: boolean;
  recordId?: string;
}
