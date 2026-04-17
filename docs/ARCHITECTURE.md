# Architecture — 기능 매트릭스

본 문서는 앱의 모든 기능을 **Claude Code 공식 스펙**과 대조한 매트릭스다. 새 세션이 여기서 "무엇이 있고 무엇이 표준이고 무엇이 gap인지" 즉시 파악 가능하도록 유지.

## 페이지 (6개)

| URL | 탭 구조 | 상태 |
|-----|--------|------|
| `/` (Dashboard) | - | 정상 |
| `/projects` | - | 정상 |
| `/projects/{id}` | Overview / Settings / CLAUDE.md / Agents / Rules / Hooks (6탭) | Rules frontmatter UI 없음, Skills 미구현, Worktrees 탭 미구현 |
| `/settings/global` | Form / JSON (2뷰) | CLAUDE.md 탭 없음 |
| `/settings/user` | Settings / CLAUDE.md / Rules / Hooks / Agents (5탭) | Skills 탭 미구현 |
| `/templates` | 카테고리별 | Workflows 섹션 미구현 |

## DB 테이블 (4개)

| 테이블 | 용도 |
|--------|------|
| projects | 프로젝트 목록 |
| file_versions | CLAUDE.md/settings.json 버전 스냅샷 |
| applied_templates | 템플릿 적용 기록 + delta (Undo 정합성) |
| custom_templates | 사용자 정의 템플릿 |

**추가 필요** (본 계획):
- workflows (S3)
- agent_header_templates (S4)
- matcher_presets (S5)

## API (38개 routes)

모두 활성 호출. 추가 필요 (본 계획):
- /api/user/skills/* + /api/projects/[id]/skills/*
- /api/workflows/*
- /api/projects/[id]/agent-header-template
- /api/projects/[id]/worktrees/status + sync

## Claude Code 스펙 정합성

| 기능 | 표준? | 앱 구현 | Gap |
|------|------|---------|----|
| CLAUDE.md (user/project/local/managed) | ✅ | 완전 | - |
| `.claude/agents/*.md` | ✅ | 완전 | 공통 헤더 중복 관리 부족 (R1) |
| `.claude/rules/*.md` + `paths:` frontmatter + 재귀 | ✅ v2.1.59+ | 저장 경로 OK | frontmatter UI 없음, 하위 디렉토리 미지원 |
| `.claude/skills/<name>/SKILL.md` | ✅ | **미구현** | 신규 필요 |
| `.claude/commands/*.md` | ✅ Legacy | 미구현 | 스킬로 통합 (별도 구현 안 함) |
| settings.json.hooks | ✅ (17 이벤트) | 완전 | matcher preset 없음 (R3), 변수 치환 없음 (R2), Bash 빌더 없음 (R4) |
| settings.json.permissions | ✅ | 완전 | - |
| settings.json.mcpServers | ✅ | 완전 | - |
| Managed (`/Library/.../managed-settings.json` + CLAUDE.md) | ✅ | Settings만 | CLAUDE.md 탭 미구현 (G1) |
| Auto memory (`~/.claude/projects/<p>/memory/MEMORY.md`) | ✅ v2.1.59+ | **미활용** | 활성화 필요 (CTX8~9) |
| `@path` import | ✅ | CLAUDE.md 루트에서 미사용 | 이번 S1에서 적용 |

## 핵심 라이브러리 (`src/lib/`)

- `templates/` — 템플릿 merge/subtract/apply/conflict-detector
- `disk-files/` — scope별 경로 resolve + 디스크 I/O
- `settings-schema.ts` — ClaudeSettings 전체 타입
- `agent-references/` — 에이전트 프로필 (6 카테고리, GovernanceProfile)
- `fs-watcher/` — chokidar + SSE
- `db/` — Drizzle + migration
- `permission-presets.ts` + `permission-descriptions.ts` + `deny-warning.ts`
- `codemirror/` — JSON hover + inline hints

## 죽은 코드 (삭제 예정, D1)

- `src/components/ui/Modal.tsx`
- `src/components/ui/ConfirmDialog.tsx`
- `src/components/editors/EditorToolbar.tsx`

## sees 프로젝트 관련 발견사항 (요약)

- 16 에이전트 (a1~f3) Phase 1~6 워크플로
- 15 hooks (UserPromptSubmit 5, PreToolUse 8, PostToolUse 1)
- 3 rules (governance / project-rules / role-system) + worktree별 확장
- 20+ git worktrees (`/Users/min/.codex/worktrees/*/sees`)
- Claude Code Settings Manager가 풀어야 할 실전 Pain: 공통 헤더 중복, 화이트리스트 hardcoding, worktree drift, Bash grep 패턴 시각화 부재
