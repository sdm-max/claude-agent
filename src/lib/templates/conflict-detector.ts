import type { ClaudeSettings } from "@/lib/settings-schema";

// ── Types ──

export interface PermissionConflict {
  type: "deny-blocks-allow" | "deny-blocks-ask";
  denyPattern: string;
  blockedPattern: string;
  severity: "critical" | "warning";
}

export interface OrderDependencyConflict {
  field: string;
  values: { templateId: string; templateName: string; value: unknown }[];
}

export interface OrderDependencyReport {
  conflicts: OrderDependencyConflict[];
  summary: string;
}

export interface ConflictReport {
  conflicts: PermissionConflict[];
  hasCritical: boolean;
  summary: string;
  orderDependencies?: OrderDependencyConflict[];
  orderSummary?: string;
}

// ── Pattern parsing & matching ──

interface ParsedPattern {
  tool: string;
  arg: string | null;
}

function parsePattern(pattern: string): ParsedPattern {
  const m = pattern.match(/^(\w+)\((.+)\)$/);
  if (m) return { tool: m[1], arg: m[2] };
  return { tool: pattern, arg: null };
}

// 광범위 deny 패턴 (critical severity)
const BROAD_PATTERNS = new Set(["*"]);
const BROAD_TOOLS = new Set(["Agent", "Task"]);

// Agent/Task 는 동의어 (Claude Code 버전별 네이밍 차이)
const AGENT_ALIASES = new Set(["Agent", "Task"]);

function toolsEquivalent(a: string, b: string): boolean {
  if (a === b) return true;
  return AGENT_ALIASES.has(a) && AGENT_ALIASES.has(b);
}

/**
 * deny 패턴이 target 패턴을 차단하는지 확인.
 * Claude Code 규칙: deny > ask > allow
 */
function denyBlocks(deny: string, target: string): boolean {
  const d = parsePattern(deny);
  const t = parsePattern(target);

  // 도구명이 다르면 차단 안 함 (Agent/Task alias 처리 포함)
  if (!toolsEquivalent(d.tool, t.tool)) return false;

  // deny "Agent" (인자 없음) → 모든 Agent 차단
  if (d.arg === null) return true;

  // deny "Bash(*)" → 모든 Bash(...) 차단
  if (d.arg === "*") return true;

  // target에 인자 없으면 (예: "Glob") deny "Glob(xxx)"가 차단? → 아님
  if (t.arg === null) return d.arg === null;

  // 정확히 같으면 차단
  if (d.arg === t.arg) return true;

  // 양방향 glob 매칭
  // 예: deny "Bash(npm *)" + target "Bash(npm run *)" → true (deny가 더 일반)
  // 예: deny "Bash(npm run *)" + target "Bash(npm *)" → true (deny가 target의 부분 집합)
  const dPrefix = d.arg.includes("*") ? d.arg.split("*")[0] : null;
  const tPrefix = t.arg.includes("*") ? t.arg.split("*")[0] : null;

  // deny arg가 와일드카드 포함: deny prefix로 target 시작 체크
  if (dPrefix !== null && t.arg.startsWith(dPrefix)) return true;
  // target arg가 와일드카드 포함: target prefix로 deny 시작 체크 (deny가 더 구체)
  if (tPrefix !== null && d.arg.startsWith(tPrefix)) return true;

  return false;
}

function getSeverity(denyPattern: string): "critical" | "warning" {
  const d = parsePattern(denyPattern);
  // 도구 자체가 광범위 (Agent 등)
  if (BROAD_TOOLS.has(d.tool) && d.arg === null) return "critical";
  // 와일드카드 전체 (Bash(*), Edit(*), Write(*), Read(*))
  if (d.arg && BROAD_PATTERNS.has(d.arg)) return "critical";
  return "warning";
}

// ── Order dependency detection ──

const SCALAR_FIELDS_TO_CHECK = [
  "model",
  "effortLevel",
  "defaultMode",
  "systemPrompt",
  "maxTurns",
  "maxTokens",
  "temperature",
  "outputFormat",
  "editorMode",
  "teammateMode",
  "autoUpdatesChannel",
] as const;

/**
 * 여러 템플릿 조합 시 스칼라 필드가 서로 다른 값을 가지는지 감지.
 * 적용 순서에 따라 결과가 달라짐 → 사용자 경고.
 */
export function detectOrderDependencies(
  templates: { id: string; name: string; settings: ClaudeSettings }[],
): OrderDependencyReport {
  const fieldValues = new Map<
    string,
    { templateId: string; templateName: string; value: unknown }[]
  >();

  for (const tmpl of templates) {
    for (const field of SCALAR_FIELDS_TO_CHECK) {
      const val = (tmpl.settings as Record<string, unknown>)[field];
      if (val === undefined) continue;
      if (!fieldValues.has(field)) fieldValues.set(field, []);
      fieldValues.get(field)!.push({
        templateId: tmpl.id,
        templateName: tmpl.name,
        value: val,
      });
    }
  }

  const conflicts: OrderDependencyConflict[] = [];
  for (const [field, values] of fieldValues.entries()) {
    if (values.length < 2) continue;
    const unique = new Set(values.map((v) => JSON.stringify(v.value)));
    if (unique.size > 1) {
      conflicts.push({ field, values });
    }
  }

  let summary = "";
  if (conflicts.length > 0) {
    const first = conflicts[0];
    summary = `${conflicts.length}건 순서 의존: "${first.field}" 가 ${first.values.length}개 카드에서 다른 값`;
  }

  return { conflicts, summary };
}

// ── Public API ──

/**
 * 두 설정을 머지했을 때 발생하는 충돌 감지.
 * current: 현재 적용된 설정, incoming: 새로 적용할 템플릿 설정
 */
export function detectConflicts(
  current: ClaudeSettings,
  incoming: ClaudeSettings,
): ConflictReport {
  // 머지 결과 시뮬레이션
  const mergedDeny = [
    ...(current.permissions?.deny || []),
    ...(incoming.permissions?.deny || []),
  ];
  const mergedAllow = [
    ...(current.permissions?.allow || []),
    ...(incoming.permissions?.allow || []),
  ];
  const mergedAsk = [
    ...(current.permissions?.ask || []),
    ...(incoming.permissions?.ask || []),
  ];

  return findConflicts(mergedDeny, mergedAllow, mergedAsk);
}

/**
 * 단일 설정 내부의 deny/allow/ask 충돌 감지.
 */
export function detectInternalConflicts(
  settings: ClaudeSettings,
): ConflictReport {
  const deny = settings.permissions?.deny || [];
  const allow = settings.permissions?.allow || [];
  const ask = settings.permissions?.ask || [];

  return findConflicts(deny, allow, ask);
}

function findConflicts(
  deny: string[],
  allow: string[],
  ask: string[],
): ConflictReport {
  const conflicts: PermissionConflict[] = [];

  // deny가 allow를 차단하는 경우
  for (const d of deny) {
    for (const a of allow) {
      if (denyBlocks(d, a)) {
        conflicts.push({
          type: "deny-blocks-allow",
          denyPattern: d,
          blockedPattern: a,
          severity: getSeverity(d),
        });
      }
    }
  }

  // deny가 ask를 차단하는 경우
  for (const d of deny) {
    for (const a of ask) {
      if (denyBlocks(d, a)) {
        conflicts.push({
          type: "deny-blocks-ask",
          denyPattern: d,
          blockedPattern: a,
          severity: getSeverity(d),
        });
      }
    }
  }

  // 중복 제거
  const unique = conflicts.filter(
    (c, i, arr) =>
      arr.findIndex(
        (x) =>
          x.denyPattern === c.denyPattern &&
          x.blockedPattern === c.blockedPattern &&
          x.type === c.type,
      ) === i,
  );

  const hasCritical = unique.some((c) => c.severity === "critical");

  // 한글 요약
  let summary = "";
  if (unique.length === 0) {
    summary = "충돌 없음";
  } else {
    const critCount = unique.filter((c) => c.severity === "critical").length;
    const warnCount = unique.filter((c) => c.severity === "warning").length;
    const parts: string[] = [];
    if (critCount > 0) parts.push(`위험 ${critCount}건`);
    if (warnCount > 0) parts.push(`주의 ${warnCount}건`);
    summary = `${parts.join(", ")}: `;
    // 첫 번째 충돌 설명
    const first = unique[0];
    summary += `${first.denyPattern} deny가 ${first.blockedPattern} ${first.type === "deny-blocks-allow" ? "allow" : "ask"}를 차단`;
    if (unique.length > 1) {
      summary += ` 외 ${unique.length - 1}건`;
    }
  }

  return { conflicts: unique, hasCritical, summary };
}
