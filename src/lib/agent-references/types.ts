import type { ClaudeSettings } from "@/lib/settings-schema";

// ─── Agent Frontmatter ───

export interface AgentFrontmatter {
  name: string;
  description: string;
  model?: string;
  tools?: string[];
  disallowedTools?: string[];
  permissionMode?: string;
  maxTurns?: number;
  effort?: string;
  isolation?: string;
  memory?: string;
  background?: boolean;
  color?: string;
  hooks?: Record<string, unknown>;
  mcpServers?: Record<string, unknown>;
  skills?: string[];
  initialPrompt?: string;
}

// ─── Governance Profile ───

export type GovernanceCategory =
  | "readonly"
  | "creator"
  | "executor"
  | "researcher"
  | "devops"
  | "orchestrator";

export type RiskLevel = "safe" | "moderate" | "elevated" | "high";
export type CostTier = 1 | 2 | 3 | 4;

export interface GovernanceProfile {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  category: GovernanceCategory;
  riskLevel: RiskLevel;
  costTier: CostTier;
  frontmatter: Omit<AgentFrontmatter, "name">;
  bodyTemplate: string;
  companionSettings?: Partial<ClaudeSettings>;
  allowedCallTargets?: string[];
  lockedFields?: (keyof AgentFrontmatter)[];
  /**
   * 에이전트 실행 시 자동으로 컨텍스트에 로드할 참조 파일 경로.
   * 렌더 시 body 상단에 "## 참조 문서" 섹션으로 `@path` 형식으로 주입됨.
   * 프로젝트 루트 기준 상대 경로 사용.
   */
  referenceFiles?: string[];
}

// ─── Category Metadata ───

export const GOVERNANCE_CATEGORIES: Record<
  GovernanceCategory,
  { nameKo: string; descriptionKo: string; order: number }
> = {
  readonly: { nameKo: "읽기 전용", descriptionKo: "코드를 읽고 분석만 수행", order: 0 },
  creator: { nameKo: "생성", descriptionKo: "파일/코드 생성 및 수정", order: 1 },
  executor: { nameKo: "실행", descriptionKo: "명령 실행 및 마이그레이션", order: 2 },
  researcher: { nameKo: "조사", descriptionKo: "웹 검색 및 정보 수집", order: 3 },
  devops: { nameKo: "DevOps", descriptionKo: "인프라 관리 및 배포", order: 4 },
  orchestrator: { nameKo: "오케스트레이터", descriptionKo: "다른 에이전트 조율 및 관리", order: 5 },
};

// ─── Constants ───

export const RISK_LABELS: Record<RiskLevel, { emoji: string; labelKo: string }> = {
  safe: { emoji: "🟢", labelKo: "안전" },
  moderate: { emoji: "🟡", labelKo: "보통" },
  elevated: { emoji: "🟠", labelKo: "주의" },
  high: { emoji: "🔴", labelKo: "위험" },
};

export const COST_LABELS: Record<CostTier, string> = {
  1: "$",
  2: "$$",
  3: "$$$",
  4: "$$$$",
};

export const MODEL_SHORT_NAMES: Record<string, string> = {
  opus: "Opus",
  sonnet: "Sonnet",
  haiku: "Haiku",
  inherit: "Inherit",
  "claude-opus-4-6": "Opus",
  "claude-sonnet-4-6": "Sonnet",
  "claude-haiku-4-5-20251001": "Haiku",
};
