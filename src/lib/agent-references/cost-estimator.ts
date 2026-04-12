import type { AgentFrontmatter, CostTier } from "./types";

// 모델별 토큰당 대략적 비용 (상대값, Haiku = 1)
const MODEL_COST_MULTIPLIER: Record<string, number> = {
  opus: 15,
  "claude-opus-4-6": 15,
  sonnet: 3,
  "claude-sonnet-4-6": 3,
  haiku: 1,
  "claude-haiku-4-5-20251001": 1,
  inherit: 3, // default to sonnet level
};

export interface CostEstimate {
  model: string;
  maxTurns: number;
  costMultiplier: number;
  costTier: CostTier;
  estimatedTokens: string; // 범위
  monthlyEstimate: string; // 대략적 비용 레이블
}

/**
 * 에이전트 frontmatter로부터 비용 추정
 */
export function estimateAgentCost(fm: AgentFrontmatter): CostEstimate {
  const model = fm.model ?? "sonnet";
  const maxTurns = fm.maxTurns ?? 10;
  const multiplier = MODEL_COST_MULTIPLIER[model] ?? 3;

  // 턴당 평균 I/O 토큰 추정
  const avgTokensPerTurn = 4000; // input + output
  const totalTokens = maxTurns * avgTokensPerTurn;

  // 비용 등급 산출
  const rawCost = multiplier * maxTurns;
  let costTier: CostTier;
  if (rawCost <= 15) costTier = 1;
  else if (rawCost <= 45) costTier = 2;
  else if (rawCost <= 150) costTier = 3;
  else costTier = 4;

  // 토큰 범위 레이블
  let estimatedTokens: string;
  if (totalTokens < 50000) estimatedTokens = "~50K tokens";
  else if (totalTokens < 100000) estimatedTokens = "50K-100K tokens";
  else if (totalTokens < 200000) estimatedTokens = "100K-200K tokens";
  else estimatedTokens = "200K+ tokens";

  // 비용 레이블
  const costLabels: Record<CostTier, string> = {
    1: "$ — 저비용",
    2: "$$ — 보통",
    3: "$$$ — 고비용",
    4: "$$$$ — 매우 높음",
  };

  return {
    model,
    maxTurns,
    costMultiplier: multiplier,
    costTier,
    estimatedTokens,
    monthlyEstimate: costLabels[costTier],
  };
}

/**
 * 프로젝트 전체 에이전트 비용 요약
 */
export function estimateProjectCost(agents: AgentFrontmatter[]): {
  totalAgents: number;
  byTier: Record<CostTier, number>;
  byModel: Record<string, number>;
  overallTier: CostTier;
  summary: string;
} {
  const byTier: Record<CostTier, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const byModel: Record<string, number> = {};

  for (const fm of agents) {
    const est = estimateAgentCost(fm);
    byTier[est.costTier]++;
    byModel[est.model] = (byModel[est.model] ?? 0) + 1;
  }

  // 전체 등급은 최고 등급 기준
  let overallTier: CostTier = 1;
  if (byTier[4] > 0) overallTier = 4;
  else if (byTier[3] > 0) overallTier = 3;
  else if (byTier[2] > 0) overallTier = 2;

  const summaryParts: string[] = [];
  if (byModel["opus"]) summaryParts.push(`Opus ${byModel["opus"]}개`);
  if (byModel["sonnet"]) summaryParts.push(`Sonnet ${byModel["sonnet"]}개`);
  if (byModel["haiku"]) summaryParts.push(`Haiku ${byModel["haiku"]}개`);

  return {
    totalAgents: agents.length,
    byTier,
    byModel,
    overallTier,
    summary: summaryParts.join(", ") || "에이전트 없음",
  };
}

/**
 * 에이전트 의존성 그래프 생성
 * body에서 위임 대상 에이전트를 추출하여 그래프를 만듦
 */
export interface AgentNode {
  name: string;
  model: string;
  costTier: CostTier;
  canCallAgents: boolean;
  delegates: string[]; // 위임 대상 에이전트 이름
}

export function buildDependencyGraph(
  agents: { name: string; frontmatter: AgentFrontmatter; body: string }[]
): AgentNode[] {
  const agentNames = new Set(agents.map((a) => a.name));

  return agents.map((agent) => {
    const canCallAgents = agent.frontmatter.tools?.includes("Agent") ?? false;
    const delegates: string[] = [];

    if (canCallAgents) {
      // body에서 "위임: agent-name" 또는 "delegate: agent-name" 패턴 추출
      for (const otherName of agentNames) {
        if (otherName === agent.name) continue;
        if (agent.body.includes(otherName)) {
          delegates.push(otherName);
        }
      }
    }

    const est = estimateAgentCost(agent.frontmatter);

    return {
      name: agent.name,
      model: agent.frontmatter.model ?? "sonnet",
      costTier: est.costTier,
      canCallAgents,
      delegates,
    };
  });
}
