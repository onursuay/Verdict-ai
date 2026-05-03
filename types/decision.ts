export interface DecisionAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: Date;
  contentText?: string;
  analysisStatus?: "metadata_only" | "content_extracted" | "unsupported" | "too_large" | "error";
  contentSummary?: string;
  dataUrl?: string;
  visionStatus?: "ready" | "analyzed" | "unsupported" | "too_large" | "error";
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
  | "prompt_generated"
  | "implementation_queued"
  | "implementation_running"
  | "implementation_completed"
  | "implementation_failed"
  | "review_required";

export type AIRole = "chatgpt_judge" | "claude_engineer" | "codex_reviewer";

export interface DecisionFollowUp {
  id: string;
  question: string;
  answer: string;
  createdAt: Date;
}

export interface ImplementationTaskInfo {
  taskId: string;
  status: string;
  promptTitle: string;
  promptBody: string;
}

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
  safetyRules?: string[];
  implementationScope?: string;
  forbiddenChanges?: string[];
  expectedReportFormat?: string[];
}

export interface ProjectContext {
  githubRepoUrl?: string;
  localProjectPath?: string;
  liveUrl?: string;
  vercelProjectUrl?: string;
  vpsHost?: string;
  supabaseProjectUrl?: string;
  notes?: string;
  githubConnectionStatus?: "manual" | "connected" | "not_connected";
  githubRepoFullName?: string;
  liveUrlStatus?: "not_checked" | "valid" | "invalid";
  projectConnectionsUpdatedAt?: string;
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
  projectContext?: ProjectContext;
}

export type AnalysisSource = "mock" | "live";

export interface RepoSelectedFile {
  path: string;
  size: number;
  language: string;
  reason: string;
  contentPreview: string;
}

export interface RepoContextSource {
  source: "github";
  owner: string;
  repo: string;
  branch: string;
  selectedFiles: RepoSelectedFile[];
  warnings: string[];
  fetchedAt: string; // ISO timestamp
  errorMessage?: string;
}

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
  enrichedAttachments?: DecisionAttachment[];
  followUps?: DecisionFollowUp[];
  repoContext?: RepoContextSource;
}
