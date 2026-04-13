import type { GovernanceProfile } from "../types";

export const readonlyProfiles: GovernanceProfile[] = [
  {
    id: "readonly-strict",
    name: "Strict Read-Only",
    nameKo: "엄격 읽기 전용",
    description: "Read-only analysis agent — no modifications allowed",
    descriptionKo: "파일 읽기와 검색만 가능한 분석 전용 에이전트",
    category: "readonly",
    riskLevel: "safe",
    costTier: 2,
    frontmatter: {
      description: "Read-only analysis agent — code review without modifications",
      model: "sonnet",
      tools: ["Read", "Glob", "Grep"],
      disallowedTools: ["Write", "Edit", "Bash", "Agent", "WebFetch", "WebSearch"],
      permissionMode: "plan",
      maxTurns: 10,
      effort: "high",
      color: "blue",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 파일 수정, 생성, 삭제 절대 금지
- 셸 명령 실행 금지
- 서브에이전트 생성 금지
- 분석 결과만 구조화된 텍스트로 출력

## 역할
[커스터마이즈: 이 에이전트가 리뷰할 대상을 기술]

## 분석 프레임워크
1. Glob/Grep으로 대상 코드 탐색
2. 보안, 성능, 품질 관점에서 분석
3. 심각도별 결과 보고

## 출력 형식
- [CRITICAL] — 머지 전 반드시 수정
- [WARNING] — 수정 권장
- [SUGGESTION] — 개선 제안`,
    lockedFields: ["tools", "disallowedTools", "permissionMode"],
  },
  {
    id: "readonly-analysis",
    name: "Analysis Read-Only",
    nameKo: "분석 읽기 전용",
    description: "Read-only with Bash for analysis commands (git log, npm audit, etc.)",
    descriptionKo: "Bash 분석 명령(git log, npm audit 등)을 허용하는 읽기 전용",
    category: "readonly",
    riskLevel: "safe",
    costTier: 2,
    frontmatter: {
      description: "Read-only analysis with Bash for safe read commands",
      model: "sonnet",
      tools: ["Read", "Glob", "Grep", "Bash"],
      disallowedTools: ["Write", "Edit", "Agent"],
      permissionMode: "plan",
      maxTurns: 15,
      effort: "high",
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command:
                  "CMD=$(cat | jq -r '.tool_input.command // empty'); echo \"$CMD\" | grep -qE '^(npm audit|git log|git diff|git show|wc |head |tail |cat |ls )' || { echo '{\"block\":true,\"message\":\"Read-only: only analysis commands allowed\"}' >&2; exit 2; }",
                timeout: 5,
              },
            ],
          },
        ],
      },
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 파일 수정, 생성, 삭제 절대 금지
- 허용된 Bash 명령: git log, git diff, git show, npm audit, wc, head, tail, cat, ls
- 서브에이전트 생성 금지

## 역할
[커스터마이즈: 분석 대상과 관점을 기술]

## 분석 도구 활용
- git log/diff로 변경 이력 분석
- npm audit로 의존성 보안 점검
- wc/head/tail로 파일 규모 파악`,
    lockedFields: ["tools", "disallowedTools", "permissionMode"],
    companionSettings: {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command:
                  "CMD=$(cat | jq -r '.tool_input.command // empty'); echo \"$CMD\" | grep -qE '^(npm audit|git log|git diff|git show|wc |head |tail |cat |ls )' || { echo '{\"block\":true,\"message\":\"Read-only: only analysis commands allowed\"}' >&2; exit 2; }",
                timeout: 5,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "readonly-log-analyzer",
    name: "Log Analyzer",
    nameKo: "로그 분석",
    description: "Read-only log file analysis",
    descriptionKo: "로그 파일을 분석하여 에러 패턴과 이상 징후를 찾는 에이전트",
    category: "readonly",
    riskLevel: "safe",
    costTier: 2,
    frontmatter: {
      description: "Log analyzer — find errors and anomalies in log files",
      model: "sonnet",
      tools: ["Read", "Glob", "Grep", "Bash"],
      disallowedTools: ["Write", "Edit", "Agent"],
      permissionMode: "plan",
      maxTurns: 15,
      effort: "high",
      color: "orange",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 로그 파일 수정 금지
- grep, awk, sed(출력만), head, tail 사용 가능
- 분석 결과를 구조화하여 보고

## 역할
[커스터마이즈: 분석할 로그 종류와 포커스를 기술]

## 분석 프레임워크
1. 시간대별 에러 빈도 집계
2. 에러 패턴 분류 (severity, component)
3. 이상 징후 식별 (급증, 반복 등)
4. 근본 원인 가설 제시`,
    lockedFields: ["disallowedTools"],
  },
  {
    id: "readonly-dep-checker",
    name: "Dependency Checker",
    nameKo: "의존성 체커",
    description: "Check dependencies for vulnerabilities and updates",
    descriptionKo: "의존성 취약점과 업데이트 확인 전용 에이전트",
    category: "readonly",
    riskLevel: "safe",
    costTier: 1,
    frontmatter: {
      description: "Dependency checker — audit vulnerabilities and outdated packages",
      model: "haiku",
      tools: ["Read", "Glob", "Grep", "Bash"],
      disallowedTools: ["Write", "Edit", "Agent"],
      permissionMode: "plan",
      maxTurns: 10,
      effort: "low",
      color: "yellow",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 의존성 파일 수정 금지 (package.json, requirements.txt 등)
- npm audit, pip audit, outdated 명령만 실행
- 업데이트는 제안만 수행

## 역할
의존성 취약점과 업데이트 체크

## 체크 항목
1. \`npm audit\` — 보안 취약점
2. \`npm outdated\` — 구버전 패키지
3. package.json의 peer dependency 충돌
4. 사용하지 않는 의존성 (depcheck)`,
    lockedFields: ["disallowedTools"],
  },
  {
    id: "readonly-web",
    name: "Web Research Read-Only",
    nameKo: "웹 조사 읽기 전용",
    description: "Read-only with web access for research",
    descriptionKo: "웹 검색과 페이지 조회가 가능한 읽기 전용 조사 에이전트",
    category: "readonly",
    riskLevel: "safe",
    costTier: 1,
    frontmatter: {
      description: "Read-only web research agent — search and summarize",
      model: "haiku",
      tools: ["Read", "Glob", "Grep", "WebFetch", "WebSearch"],
      disallowedTools: ["Write", "Edit", "Bash", "Agent"],
      permissionMode: "default",
      maxTurns: 15,
      effort: "low",
      background: true,
      color: "cyan",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 파일 수정, 생성, 삭제 절대 금지
- 셸 명령 실행 금지
- 웹 검색 결과를 요약하여 보고

## 역할
[커스터마이즈: 조사 대상과 범위를 기술]

## 조사 절차
1. WebSearch로 관련 정보 검색
2. WebFetch로 상세 페이지 확인
3. 프로젝트 코드와 비교 분석
4. 구조화된 보고서 작성`,
    lockedFields: ["tools", "disallowedTools"],
  },
];
