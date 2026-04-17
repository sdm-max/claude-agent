// Reusable hook matcher presets.
//
// Hook matchers (Claude Code settings.json.hooks) are regex patterns matched
// against tool names. Common combinations are repeated across many hook rules;
// these presets centralize them for UI reuse and documentation.

export interface MatcherPreset {
  key: string;
  label: string;
  pattern: string;
  description: string;
  // Which events this preset is commonly used with.
  commonEvents?: string[];
}

export const MATCHER_PRESETS: MatcherPreset[] = [
  {
    key: "write-triad",
    label: "Write actions (Edit + Write + MultiEdit)",
    pattern: "Edit|Write|MultiEdit",
    description: "Any action that creates or modifies files in the workspace.",
    commonEvents: ["PreToolUse"],
  },
  {
    key: "write-triad-bash",
    label: "Write + Bash",
    pattern: "Edit|Write|MultiEdit|Bash",
    description: "File writes or shell commands — broad write-side filter.",
    commonEvents: ["PreToolUse"],
  },
  {
    key: "bash-only",
    label: "Bash only",
    pattern: "Bash",
    description: "Shell command execution only.",
    commonEvents: ["PreToolUse", "PostToolUse"],
  },
  {
    key: "read-only",
    label: "Read actions (Read + Glob + Grep)",
    pattern: "Read|Glob|Grep",
    description: "Read-side tools for discovery and inspection.",
    commonEvents: ["PreToolUse"],
  },
  {
    key: "agents",
    label: "Agents (Task + Agent)",
    pattern: "Task|Agent",
    description: "Sub-agent dispatch. Block or audit delegation.",
    commonEvents: ["PreToolUse"],
  },
  {
    key: "team-ops",
    label: "Team operations",
    pattern: "TeamCreate|TeamDelete|TaskCreate|TaskUpdate",
    description: "Team/task lifecycle operations.",
    commonEvents: ["PreToolUse"],
  },
  {
    key: "any",
    label: "Any tool",
    pattern: "*",
    description: "Match all tools — use sparingly.",
    commonEvents: ["PreToolUse", "PostToolUse"],
  },
  {
    key: "webfetch",
    label: "Web fetch",
    pattern: "WebFetch|WebSearch",
    description: "Network-fetching tools — useful for egress control.",
    commonEvents: ["PreToolUse"],
  },
];

// Claude Code 공식 이벤트 목록. (settings-schema.ts 와 일치 유지)
export const HOOK_EVENTS = [
  { key: "UserPromptSubmit", description: "사용자 프롬프트 제출 — 컨텍스트 주입/검증에 적합" },
  { key: "PreToolUse", description: "도구 호출 직전 — 차단/ask/로깅" },
  { key: "PostToolUse", description: "도구 호출 후 — 결과 후처리/린트" },
  { key: "PostToolUseFailure", description: "도구 실패 시" },
  { key: "Notification", description: "사용자에게 알림이 갈 때" },
  { key: "Stop", description: "세션 정상 종료" },
  { key: "StopFailure", description: "세션 비정상 종료" },
  { key: "SessionStart", description: "세션 시작 — 환경 주입에 적합" },
  { key: "SessionEnd", description: "세션 종료 — 정리 작업" },
  { key: "PermissionRequest", description: "권한 요청 발생 시" },
  { key: "PermissionDenied", description: "권한 거부 시" },
  { key: "FileChanged", description: "외부 파일 변경 감지" },
  { key: "CwdChanged", description: "작업 디렉토리 변경" },
  { key: "ConfigChange", description: "설정 변경" },
  { key: "SubagentStart", description: "서브에이전트 시작 (관찰만 가능, 차단 불가)" },
  { key: "SubagentStop", description: "서브에이전트 종료" },
  { key: "SubagentTurn", description: "서브에이전트 매 턴" },
] as const;

export function findPresetByPattern(pattern: string): MatcherPreset | null {
  return MATCHER_PRESETS.find((p) => p.pattern === pattern) ?? null;
}

export function presetsForEvent(event: string): MatcherPreset[] {
  return MATCHER_PRESETS.filter((p) => !p.commonEvents || p.commonEvents.includes(event));
}
