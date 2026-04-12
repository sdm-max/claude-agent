import type { AgentFrontmatter, GovernanceProfile } from "./types";

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
