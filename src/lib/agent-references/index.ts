import { readonlyProfiles } from "./profiles/readonly";
import { creatorProfiles } from "./profiles/creator";
import { executorProfiles } from "./profiles/executor";
import { researcherProfiles } from "./profiles/researcher";
import { devopsProfiles } from "./profiles/devops";
import { orchestratorProfiles } from "./profiles/orchestrator";
import type { GovernanceProfile, GovernanceCategory } from "./types";

export { GOVERNANCE_CATEGORIES, RISK_LABELS, COST_LABELS, MODEL_SHORT_NAMES, getModelDisplayName, getModelFullLabel } from "./types";
export type {
  GovernanceProfile,
  GovernanceCategory,
  AgentFrontmatter,
  RiskLevel,
  CostTier,
} from "./types";

// ─── All Profiles ───

export const ALL_PROFILES: GovernanceProfile[] = [
  ...readonlyProfiles,
  ...creatorProfiles,
  ...executorProfiles,
  ...researcherProfiles,
  ...devopsProfiles,
  ...orchestratorProfiles,
];

// ─── Lookup Helpers ───

export function getProfileById(id: string): GovernanceProfile | undefined {
  return ALL_PROFILES.find((p) => p.id === id);
}

export function getProfilesByCategory(category: GovernanceCategory): GovernanceProfile[] {
  return ALL_PROFILES.filter((p) => p.category === category);
}

export function getAllCategories(): GovernanceCategory[] {
  return ["readonly", "creator", "executor", "researcher", "devops", "orchestrator"];
}
