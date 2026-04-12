import type { GovernanceProfile } from "../types";

export const executorProfiles: GovernanceProfile[] = [
  {
    id: "executor-isolated",
    name: "Isolated Executor",
    nameKo: "격리 실행",
    description: "Full execution in worktree isolation — safe for risky operations",
    descriptionKo: "Worktree 격리 환경에서 전체 도구 접근 가능한 실행 에이전트",
    category: "executor",
    riskLevel: "elevated",
    costTier: 4,
    frontmatter: {
      description: "Isolated executor — full tools in worktree sandbox",
      model: "opus",
      tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      disallowedTools: ["Agent"],
      permissionMode: "auto",
      maxTurns: 30,
      effort: "high",
      isolation: "worktree",
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command:
                  "CMD=$(cat | jq -r '.tool_input.command // empty'); echo \"$CMD\" | grep -qE '(rm -rf /|DROP DATABASE|TRUNCATE|git push --force|git reset --hard)' && { echo '{\"block\":true,\"message\":\"Destructive command blocked\"}' >&2; exit 2; } || exit 0",
                timeout: 5,
              },
            ],
          },
        ],
      },
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- Worktree 격리 환경에서만 실행됨
- 파괴적 명령 자동 차단 (rm -rf /, DROP DATABASE, git push --force, git reset --hard)
- 서브에이전트 생성 금지
- 작업 완료 후 결과 보고 필수

## 역할
[커스터마이즈: 실행할 작업과 검증 기준을 기술]

## 격리 환경
- worktree에서 실행되므로 메인 브랜치에 직접 영향 없음
- 작업 완료 후 변경사항을 메인에 머지할지 결정 가능

## 작업 절차
1. 현재 상태 분석
2. 마이그레이션/빌드/배포 실행
3. 결과 검증
4. 성공/실패 보고`,
    lockedFields: ["isolation", "model", "disallowedTools"],
  },
  {
    id: "executor-sandboxed",
    name: "Sandboxed Executor",
    nameKo: "샌드박스 실행",
    description: "Execution with network and filesystem restrictions",
    descriptionKo: "네트워크 및 파일시스템 제한이 적용된 실행 에이전트",
    category: "executor",
    riskLevel: "moderate",
    costTier: 3,
    frontmatter: {
      description: "Sandboxed executor — restricted network and filesystem access",
      model: "sonnet",
      tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      disallowedTools: ["Agent"],
      permissionMode: "acceptEdits",
      maxTurns: 25,
      effort: "high",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 네트워크 접근 제한됨 (허용된 도메인만 가능)
- 파일시스템 쓰기 제한됨 (프로젝트 디렉토리만)
- 서브에이전트 생성 금지

## 역할
[커스터마이즈: 실행할 작업 범위를 기술]

## 샌드박스 제한
- 외부 네트워크 요청: 차단 (npm registry 등 허용 필요 시 설정)
- 파일 쓰기: 프로젝트 루트 내에서만
- 프로세스: 위험 명령 차단`,
    lockedFields: ["disallowedTools"],
    companionSettings: {
      sandbox: {
        enabled: true,
        failIfUnavailable: true,
        network: {
          allowedDomains: ["registry.npmjs.org", "github.com"],
        },
      },
    },
  },
];
