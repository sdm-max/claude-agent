/**
 * settings 객체를 한글 주석이 포함된 JSONC 문자열로 변환
 */

const KEY_COMMENTS: Record<string, string> = {
  // Core
  model: "사용할 Claude 모델",
  effortLevel: "응답 품질 수준 (low/medium/high)",
  defaultMode: "기본 실행 모드 (default/auto/plan/acceptEdits/dontAsk/bypassPermissions)",

  // Permissions
  permissions: "권한 설정",
  allow: "자동 허용 규칙",
  ask: "사용자 확인 필요 규칙",
  deny: "차단 규칙",
  additionalDirectories: "추가 허용 디렉토리",
  disableBypassPermissionsMode: "바이패스 모드 비활성화 사유",
  disableAutoMode: "자동 모드 비활성화 사유",

  // Environment
  env: "환경변수 설정",
  DISABLE_TELEMETRY: "텔레메트리 비활성화 (1=끔)",
  DISABLE_ERROR_REPORTING: "에러 리포팅 비활성화 (1=끔)",
  BASH_DEFAULT_TIMEOUT_MS: "Bash 기본 타임아웃 (ms)",
  BASH_MAX_TIMEOUT_MS: "Bash 최대 타임아웃 (ms)",
  API_TIMEOUT_MS: "API 타임아웃 (ms)",
  CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY: "도구 동시 실행 수",
  MAX_MCP_OUTPUT_TOKENS: "MCP 최대 출력 토큰",
  HTTP_PROXY: "HTTP 프록시 주소",
  HTTPS_PROXY: "HTTPS 프록시 주소",
  NO_PROXY: "프록시 제외 대상",
  GITHUB_TOKEN: "GitHub 인증 토큰",
  SLACK_BOT_TOKEN: "Slack 봇 토큰",
  SLACK_TEAM_ID: "Slack 팀 ID",
  DATABASE_URL: "데이터베이스 접속 URL",
  SENTRY_AUTH_TOKEN: "Sentry 인증 토큰",
  LINEAR_API_KEY: "Linear API 키",
  BRAVE_API_KEY: "Brave 검색 API 키",
  DB_PATH: "SQLite DB 파일 경로",
  WEBHOOK_URL: "알림 웹훅 URL",
  WEBHOOK_TOKEN: "웹훅 인증 토큰",

  // Hooks
  hooks: "훅 설정 (이벤트별 자동 실행)",
  PreToolUse: "도구 실행 전 훅",
  PostToolUse: "도구 실행 후 훅",
  PostToolUseFailure: "도구 실행 실패 시 훅",
  Notification: "알림 훅",
  Stop: "작업 완료 시 훅",
  StopFailure: "작업 완료 실패 시 훅",
  SessionStart: "세션 시작 시 훅",
  SessionEnd: "세션 종료 시 훅",
  UserPromptSubmit: "사용자 프롬프트 제출 시 훅",
  PermissionRequest: "권한 요청 시 훅",
  PermissionDenied: "권한 거부 시 훅",
  FileChanged: "파일 변경 시 훅",
  CwdChanged: "작업 디렉토리 변경 시 훅",
  ConfigChange: "설정 변경 시 훅",
  SubagentStart: "서브에이전트 시작 시 훅",
  SubagentStop: "서브에이전트 종료 시 훅",
  SubagentTurn: "서브에이전트 턴 시 훅",
  matcher: "매칭 패턴 (도구명 또는 정규식)",
  type: "훅 타입 (command/http/prompt/agent)",
  command: "실행할 셸 명령어",
  url: "요청할 URL",
  method: "HTTP 메서드",
  headers: "HTTP 헤더",
  timeout: "타임아웃 (초)",
  prompt: "프롬프트 텍스트",
  agent: "에이전트 이름",

  // Sandbox
  sandbox: "샌드박스 설정 (격리 실행)",
  enabled: "활성화 여부",
  failIfUnavailable: "샌드박스 불가 시 실패 처리",
  autoAllowBashIfSandboxed: "샌드박스 시 Bash 자동 허용",
  excludedCommands: "샌드박스 제외 명령어",
  filesystem: "파일시스템 제한",
  denyRead: "읽기 차단 경로",
  denyWrite: "쓰기 차단 경로",
  allowRead: "읽기 허용 경로",
  allowWrite: "쓰기 허용 경로",
  network: "네트워크 제한",
  allowedDomains: "허용 도메인 목록",

  // MCP
  mcpServers: "MCP 서버 설정",
  args: "실행 인자",
  disabled: "비활성화 여부",

  // Worktree
  worktree: "Worktree 설정 (모노레포용)",
  symlinkDirectories: "심볼릭 링크 디렉토리",
  sparsePaths: "스파스 체크아웃 경로",

  // Attribution
  attribution: "어트리뷰션 설정 (Claude 기여 표시)",
  commit: "커밋 메시지 어트리뷰션",
  pr: "PR 어트리뷰션",

  // Auto Mode
  autoMode: "자동 모드 세부 설정",
  environment: "환경 설명",
  soft_deny: "소프트 차단 규칙 (경고 후 허용 가능)",

  // UI/UX
  editorMode: "에디터 모드 (normal/vim)",
  showTurnDuration: "턴 소요시간 표시",
  terminalProgressBarEnabled: "터미널 진행 바 표시",
  autoConnectIde: "IDE 자동 연결",
  autoInstallIdeExtension: "IDE 확장 자동 설치",
  teammateMode: "팀메이트 모드 (auto/in-process/tmux)",
  outputFormat: "출력 형식 (text/json/stream-json)",

  // Feature Flags
  alwaysThinkingEnabled: "상시 씽킹 모드 활성화",
  contextCompression: "컨텍스트 압축 활성화",

  // Model
  availableModels: "사용 가능한 모델 목록",
  modelOverrides: "서브에이전트별 모델 오버라이드",

  // API / Session
  apiKey: "API 키",
  systemPrompt: "시스템 프롬프트",
  maxTurns: "최대 턴 수",
  maxTokens: "최대 출력 토큰",
  temperature: "온도 (0=결정적, 1=창의적)",

  // Cleanup
  cleanupPeriodDays: "자동 정리 기간 (일)",
  autoUpdatesChannel: "자동 업데이트 채널 (stable/beta)",
};

export function annotateSettingsJson(settings: Record<string, unknown>): string {
  if (!settings || Object.keys(settings).length === 0) return "{}";

  const lines = JSON.stringify(settings, null, 2).split("\n");
  const result: string[] = [];

  for (const line of lines) {
    // Match "key": value pattern
    const keyMatch = line.match(/^(\s*)"([^"]+)"(\s*:\s*)/);
    if (keyMatch) {
      const indent = keyMatch[1];
      const key = keyMatch[2];
      const comment = KEY_COMMENTS[key];
      if (comment) {
        result.push(`${indent}// ${comment}`);
      }
    }
    result.push(line);
  }

  return result.join("\n");
}
