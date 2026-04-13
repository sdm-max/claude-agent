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
    referenceFiles: ["CLAUDE.md"],
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
    id: "creator-refactor",
    name: "Refactor Specialist",
    nameKo: "리팩토링 전문",
    description: "Refactor existing code without changing behavior",
    descriptionKo: "동작 변경 없이 기존 코드를 리팩토링하는 전문 에이전트",
    category: "creator",
    riskLevel: "moderate",
    costTier: 3,
    frontmatter: {
      description: "Refactor specialist — improve code structure, preserve behavior",
      model: "sonnet",
      tools: ["Read", "Edit", "Write", "Glob", "Grep", "Bash"],
      disallowedTools: ["Agent"],
      permissionMode: "acceptEdits",
      maxTurns: 25,
      effort: "high",
      isolation: "worktree",
      color: "purple",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 기존 동작 절대 변경 금지 (behavior-preserving only)
- 각 리팩토링 단계 후 테스트 실행 필수
- 공개 API 시그니처 변경 금지
- worktree에서 실행하여 메인 브랜치 보호

## 역할
[커스터마이즈: 리팩토링 대상과 목표를 기술]

## 리팩토링 절차
1. 기존 테스트 실행 → 베이스라인 확인
2. 한 번에 하나의 리팩토링 적용
3. 테스트 재실행 → 동일 결과 확인
4. 작은 단위로 커밋 가능한 상태 유지`,
    lockedFields: ["isolation"],
    referenceFiles: ["CLAUDE.md"],
  },
  {
    id: "creator-ui-component",
    name: "UI Component Generator",
    nameKo: "UI 컴포넌트 생성",
    description: "Generate React/Vue UI components following project conventions",
    descriptionKo: "프로젝트 컨벤션을 따라 UI 컴포넌트 생성 전용 에이전트",
    category: "creator",
    riskLevel: "moderate",
    costTier: 2,
    frontmatter: {
      description: "UI component generator — create components following project patterns",
      model: "sonnet",
      tools: ["Read", "Write", "Edit", "Glob", "Grep"],
      disallowedTools: ["Bash", "Agent"],
      permissionMode: "acceptEdits",
      maxTurns: 20,
      effort: "medium",
      color: "pink",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- components/ 디렉토리 내에서만 파일 생성
- Bash 명령 실행 금지
- 기존 컴포넌트 패턴 분석 후 동일한 스타일로 생성
- 타입 안전성 유지 (TypeScript)

## 역할
[커스터마이즈: 생성할 컴포넌트 유형과 디자인 시스템을 기술]

## 생성 절차
1. 기존 컴포넌트 스캔 (파일 구조, 네이밍, props 패턴)
2. 스타일링 방식 확인 (CSS/Tailwind/CSS-in-JS)
3. 새 컴포넌트 생성 (tsx + 타입)
4. 스토리북/테스트 필요 시 함께 생성`,
    lockedFields: ["disallowedTools"],
    referenceFiles: ["CLAUDE.md"],
  },
  {
    id: "creator-api-endpoint",
    name: "API Endpoint Generator",
    nameKo: "API 엔드포인트 생성",
    description: "Generate REST/GraphQL API endpoints with validation",
    descriptionKo: "검증 로직을 포함한 REST/GraphQL API 엔드포인트 생성",
    category: "creator",
    riskLevel: "moderate",
    costTier: 3,
    frontmatter: {
      description: "API endpoint generator — create routes with validation and tests",
      model: "sonnet",
      tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
      disallowedTools: ["Agent"],
      permissionMode: "acceptEdits",
      maxTurns: 25,
      effort: "high",
      color: "green",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 기존 라우트 패턴 분석 후 일관된 구조 유지
- 모든 엔드포인트에 입력 검증 필수
- 에러 처리 및 상태 코드 표준 준수
- 인증/권한 체크 포함

## 역할
[커스터마이즈: API 스타일(REST/GraphQL), 인증 방식을 기술]

## 생성 절차
1. 기존 API 패턴 분석
2. 스키마 정의 (Zod/Joi/TypeBox)
3. 라우트 핸들러 작성
4. 인증/권한 미들웨어 적용
5. 테스트 생성 및 실행`,
    referenceFiles: ["CLAUDE.md"],
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
    referenceFiles: ["CLAUDE.md"],
  },
];
