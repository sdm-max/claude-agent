import type { AgentFrontmatter, GovernanceProfile, GovernanceCategory } from "./types";

export interface ValidationError {
  field: string;
  message: string;
  messageKo: string;
  severity: "error" | "warning";
}

/**
 * 에이전트 이름 유효성 검사
 */
export function validateAgentName(name: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!name || name.trim() === "") {
    errors.push({
      field: "name",
      message: "Agent name is required",
      messageKo: "에이전트 이름은 필수입니다",
      severity: "error",
    });
    return errors;
  }

  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    errors.push({
      field: "name",
      message: "Name must start with lowercase letter, contain only a-z, 0-9, hyphens",
      messageKo: "이름은 소문자로 시작하고, a-z, 0-9, 하이픈만 포함해야 합니다",
      severity: "error",
    });
  }

  if (name.length > 50) {
    errors.push({
      field: "name",
      message: "Name must be 50 characters or less",
      messageKo: "이름은 50자 이하여야 합니다",
      severity: "error",
    });
  }

  return errors;
}

/**
 * frontmatter 유효성 검사
 */
export function validateFrontmatter(fm: AgentFrontmatter): ValidationError[] {
  const errors: ValidationError[] = [];

  // name
  errors.push(...validateAgentName(fm.name));

  // description
  if (!fm.description || fm.description.trim() === "") {
    errors.push({
      field: "description",
      message: "Description is required",
      messageKo: "설명은 필수입니다",
      severity: "error",
    });
  }

  // tools + disallowedTools 충돌
  if (fm.tools && fm.disallowedTools) {
    const overlap = fm.tools.filter((t) => fm.disallowedTools!.includes(t));
    if (overlap.length > 0) {
      errors.push({
        field: "tools",
        message: `Tools conflict: ${overlap.join(", ")} in both tools and disallowedTools`,
        messageKo: `도구 충돌: ${overlap.join(", ")}이(가) 허용/차단 목록에 동시 존재`,
        severity: "error",
      });
    }
  }

  // Agent 도구 + 오케스트레이터가 아닌 경우 경고
  if (fm.tools?.includes("Agent") && fm.permissionMode !== "default") {
    errors.push({
      field: "tools",
      message: "Agent tool with non-default permission mode may cause issues",
      messageKo: "Agent 도구 + 비기본 권한 모드는 문제를 일으킬 수 있습니다",
      severity: "warning",
    });
  }

  // bypassPermissions 경고
  if (fm.permissionMode === "bypassPermissions") {
    errors.push({
      field: "permissionMode",
      message: "bypassPermissions is dangerous — use only for trusted automation",
      messageKo: "bypassPermissions 모드는 위험합니다 — 신뢰할 수 있는 자동화에서만 사용하세요",
      severity: "warning",
    });
  }

  // tools 없이 disallowedTools만 있는 경우
  if ((!fm.tools || fm.tools.length === 0) && fm.disallowedTools && fm.disallowedTools.length > 0) {
    errors.push({
      field: "tools",
      message: "disallowedTools set but no tools specified — agent may have unexpected access",
      messageKo: "차단 도구가 설정되었지만 허용 도구가 없음 — 예상치 못한 접근이 발생할 수 있습니다",
      severity: "warning",
    });
  }

  // opus 모델 + 높은 maxTurns 비용 경고
  if (fm.model === "opus" && fm.maxTurns && fm.maxTurns > 30) {
    errors.push({
      field: "maxTurns",
      message: "Opus model with >30 turns can be very expensive",
      messageKo: "Opus 모델 + 30턴 이상은 비용이 매우 높을 수 있습니다",
      severity: "warning",
    });
  }

  // Write/Edit 도구 + worktree 격리 없음 경고
  if (fm.tools?.some((t) => ["Write", "Edit"].includes(t)) && !fm.isolation) {
    errors.push({
      field: "isolation",
      message: "Write/Edit tools without worktree isolation — changes affect working tree directly",
      messageKo: "Write/Edit 도구 사용 시 worktree 격리 없음 — 변경사항이 작업 트리에 직접 영향",
      severity: "warning",
    });
  }

  // maxTurns 범위
  if (fm.maxTurns !== undefined && (fm.maxTurns < 1 || fm.maxTurns > 100)) {
    errors.push({
      field: "maxTurns",
      message: "maxTurns must be between 1 and 100",
      messageKo: "최대 턴 수는 1~100 사이여야 합니다",
      severity: "error",
    });
  }

  return errors;
}

/**
 * 에이전트 간 호출 권한 검증
 * 오케스트레이터만 Agent 도구를 사용할 수 있음
 */
export function validateCallPermission(
  callerCategory: GovernanceCategory,
  hasAgentTool: boolean
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (hasAgentTool && callerCategory !== "orchestrator") {
    errors.push({
      field: "tools",
      message: `Only orchestrator agents can use the Agent tool. Current category: ${callerCategory}`,
      messageKo: `오케스트레이터만 Agent 도구를 사용할 수 있습니다. 현재 카테고리: ${callerCategory}`,
      severity: "error",
    });
  }

  return errors;
}

/**
 * 프로젝트 내 에이전트 집합의 정합성 검증
 */
export function validateProjectAgents(
  agents: { name: string; frontmatter: AgentFrontmatter; category?: GovernanceCategory }[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  // 이름 중복 검사
  const names = agents.map((a) => a.name);
  const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
  if (duplicates.length > 0) {
    errors.push({
      field: "name",
      message: `Duplicate agent names: ${[...new Set(duplicates)].join(", ")}`,
      messageKo: `에이전트 이름 중복: ${[...new Set(duplicates)].join(", ")}`,
      severity: "error",
    });
  }

  // 오케스트레이터 여러 개 경고
  const orchestrators = agents.filter((a) => a.category === "orchestrator");
  if (orchestrators.length > 1) {
    errors.push({
      field: "category",
      message: `Multiple orchestrators (${orchestrators.map((o) => o.name).join(", ")}) — ensure no recursive calls`,
      messageKo: `오케스트레이터 ${orchestrators.length}개 — 재귀 호출이 없는지 확인하세요`,
      severity: "warning",
    });
  }

  // Agent 도구 + 비-오케스트레이터 검사
  for (const agent of agents) {
    if (agent.frontmatter.tools?.includes("Agent") && agent.category && agent.category !== "orchestrator") {
      errors.push({
        field: "tools",
        message: `Agent "${agent.name}" (${agent.category}) has Agent tool but is not an orchestrator`,
        messageKo: `에이전트 "${agent.name}" (${agent.category})이(가) Agent 도구를 갖고 있지만 오케스트레이터가 아닙니다`,
        severity: "warning",
      });
    }
  }

  // 전체 비용 경고
  const opusCount = agents.filter((a) => a.frontmatter.model === "opus").length;
  if (opusCount > 3) {
    errors.push({
      field: "model",
      message: `${opusCount} agents use Opus model — consider using Sonnet/Haiku for simpler tasks`,
      messageKo: `${opusCount}개 에이전트가 Opus 모델 사용 중 — 단순 작업에는 Sonnet/Haiku를 고려하세요`,
      severity: "warning",
    });
  }

  return errors;
}

/**
 * 프로필 잠금 필드 변경 검사
 */
export function checkLockedFieldChanges(
  profile: GovernanceProfile,
  overrides: Partial<AgentFrontmatter>
): ValidationError[] {
  const warnings: ValidationError[] = [];

  if (!profile.lockedFields) return warnings;

  for (const field of profile.lockedFields) {
    if (field in overrides) {
      const original = profile.frontmatter[field as keyof typeof profile.frontmatter];
      const changed = overrides[field as keyof AgentFrontmatter];

      if (JSON.stringify(original) !== JSON.stringify(changed)) {
        warnings.push({
          field: field as string,
          message: `Locked field "${field}" changed from governance profile "${profile.nameKo}"`,
          messageKo: `거버넌스 프로필 "${profile.nameKo}"의 잠금 필드 "${field}"이(가) 변경되었습니다`,
          severity: "warning",
        });
      }
    }
  }

  return warnings;
}
