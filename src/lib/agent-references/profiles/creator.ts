import type { GovernanceProfile } from "../types";

export const creatorProfiles: GovernanceProfile[] = [
  {
    id: "creator-additive",
    name: "Additive Only",
    nameKo: "추가 전용",
    description: "Can create new files but cannot edit existing ones",
    descriptionKo: "새 파일 생성만 가능, 기존 파일 수정 차단",
    category: "creator",
    riskLevel: "moderate",
    costTier: 2,
    frontmatter: {
      description: "Additive-only agent — creates new files, never edits existing ones",
      model: "sonnet",
      tools: ["Read", "Write", "Glob", "Grep"],
      disallowedTools: ["Edit", "Bash", "Agent"],
      permissionMode: "acceptEdits",
      maxTurns: 20,
      effort: "medium",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 기존 파일 수정(Edit) 절대 금지
- 새 파일 생성(Write)만 허용
- Bash 명령 실행 금지
- 서브에이전트 생성 금지

## 역할
[커스터마이즈: 생성할 파일 유형과 규칙을 기술]

## 작업 절차
1. 기존 코드 패턴 분석 (Read/Glob/Grep)
2. 컨벤션에 맞는 새 파일 생성
3. 생성한 파일 목록 보고`,
    lockedFields: ["disallowedTools"],
  },
  {
    id: "creator-scoped",
    name: "Scoped Creator",
    nameKo: "범위 제한 생성",
    description: "Can write/edit only in specific directories (docs, tests)",
    descriptionKo: "docs/, tests/ 등 특정 디렉토리에서만 파일 생성/수정 가능",
    category: "creator",
    riskLevel: "moderate",
    costTier: 2,
    frontmatter: {
      description: "Scoped creator — writes only to docs/ and tests/ directories",
      model: "sonnet",
      tools: ["Read", "Write", "Edit", "Glob", "Grep"],
      disallowedTools: ["Bash", "Agent"],
      permissionMode: "acceptEdits",
      maxTurns: 20,
      effort: "medium",
      hooks: {
        PreToolUse: [
          {
            matcher: "Write|Edit",
            hooks: [
              {
                type: "command",
                command:
                  "FILE=$(cat | jq -r '.tool_input.file_path // empty'); echo \"$FILE\" | grep -qE '^\\./?(docs|tests|__tests__)/' || { echo '{\"block\":true,\"message\":\"Scoped: only docs/ and tests/ allowed\"}' >&2; exit 2; }",
                timeout: 5,
              },
            ],
          },
        ],
      },
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- docs/, tests/, __tests__/ 디렉토리에서만 파일 생성/수정 가능
- 소스 코드 디렉토리 수정 절대 금지
- Bash 명령 실행 금지

## 역할
[커스터마이즈: 문서 작성 대상이나 테스트 범위를 기술]

## 허용 디렉토리
- \`docs/\` — 문서 파일
- \`tests/\` — 테스트 파일
- \`__tests__/\` — Jest 테스트 파일`,
    lockedFields: ["disallowedTools", "hooks"],
    companionSettings: {
      hooks: {
        PreToolUse: [
          {
            matcher: "Write|Edit",
            hooks: [
              {
                type: "command",
                command:
                  "FILE=$(cat | jq -r '.tool_input.file_path // empty'); echo \"$FILE\" | grep -qE '^\\./?(docs|tests|__tests__)/' || { echo '{\"block\":true,\"message\":\"Scoped: only docs/ and tests/ allowed\"}' >&2; exit 2; }",
                timeout: 5,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "creator-full",
    name: "Full Creator",
    nameKo: "전체 생성",
    description: "Full write access including Bash for build/test commands",
    descriptionKo: "모든 디렉토리에서 파일 생성/수정 + Bash 빌드/테스트 가능",
    category: "creator",
    riskLevel: "elevated",
    costTier: 3,
    frontmatter: {
      description: "Full creator agent — write, edit, and run build/test commands",
      model: "sonnet",
      tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      disallowedTools: ["Agent"],
      permissionMode: "acceptEdits",
      maxTurns: 30,
      effort: "high",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 서브에이전트 생성 금지
- 파괴적 명령 금지 (rm -rf /, DROP DATABASE, git push --force 등)
- 작업 완료 후 빌드/테스트 확인 필수

## 역할
[커스터마이즈: 개발 작업 범위를 기술]

## 작업 절차
1. 기존 코드 분석
2. 코드 생성/수정
3. 빌드 확인 (npm run build)
4. 테스트 실행 (npm test)
5. 변경 내역 보고`,
    lockedFields: ["disallowedTools"],
  },
];
