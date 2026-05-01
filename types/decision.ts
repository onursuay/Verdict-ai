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

export type ActionStatus = "pending" | "approved" | "rejected" | "observed";

export interface DecisionRequest {
  id: string;
  projectName: string;
  requestType: RequestType;
  priority: Priority;
  description: string;
  expectedOutput: ExpectedOutput;
  repoRequired: boolean;
  createdAt: Date;
}

export interface ClaudeAnalysis {
  engineerOpinion: string;
  feasibility: string;
  risks: string[];
}

export interface CodexReview {
  codeRisk: string;
  testRisk: string;
  alternativeSuggestion: string;
}

export interface ChatGPTVerdict {
  finalDecision: string;
  implementationPath: string;
  rejectedSuggestions: string[];
  nextAction: string;
}

export interface DecisionResult {
  requestId: string;
  claudeAnalysis: ClaudeAnalysis;
  codexReview: CodexReview;
  chatGPTVerdict: ChatGPTVerdict;
  generatedPrompt: string;
  status: ActionStatus;
  createdAt: Date;
}
