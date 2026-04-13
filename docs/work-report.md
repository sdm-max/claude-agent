# Claude Code Settings Manager — 작업내역서

## 프로젝트 개요
Claude Code의 설정 파일(settings.json, CLAUDE.md, agents, rules, hooks)을 웹 UI로 관리하는 앱.
4개 스코프(Global → User → Project → Local) 계층 구조를 지원하며, 디스크 파일과 양방향 동기화(Import/Export).

## 기술 스택
- Next.js 16.2.3 App Router + TypeScript
- Drizzle ORM + SQLite (better-sqlite3, WAL mode)
- shadcn/ui (@base-ui/react v1.3.0)
- CodeMirror 6 (JSON, Markdown, Shell 구문 강조)

---

## DB 스키마

### projects
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | text PK | nanoid |
| name | text NOT NULL | 프로젝트 이름 |
| path | text NOT NULL | 디스크 경로 (trim 적용) |
| description | text | 설명 |
| created_at | integer | 생성 시각 (epoch ms) |
| updated_at | integer | 수정 시각 |

### settings
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | integer PK | auto increment |
| scope | text NOT NULL | global / user / project / local |
| project_path | text NULL | NULL=global/user, 경로=project/local |
| config | text NOT NULL | JSON 문자열 (검증 후 저장) |
| created_at | integer | 생성 시각 |
| updated_at | integer | 수정 시각 |
| | UNIQUE | (scope, project_path) |

### files
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | text PK | nanoid |
| project_id | text FK → projects.id | CASCADE 삭제 |
| type | text NOT NULL | claude-md / settings |
| scope | text NOT NULL | user / project / local |
| content | text NOT NULL | 파일 내용 |
| created_at | integer | 생성 시각 |
| updated_at | integer | 수정 시각 |

### file_versions
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | text PK | nanoid |
| file_id | text FK → files.id | CASCADE 삭제 |
| content | text NOT NULL | 이전 버전 내용 |
| created_at | integer | 저장 시각 |

---

## 페이지 구성

### 홈 (`/`)
- 앱 소개 + Global/User 설정 바로가기 + 프로젝트 목록

### Global 설정 (`/settings/global`)
- Form / JSON 탭 전환
- Import from disk / Save / Export to disk

### User 설정 (`/settings/user`)
- Global과 동일 구조, scope만 다름

### 프로젝트 목록 (`/projects`)
- 등록된 프로젝트 카드 목록
- 새 프로젝트 생성 폼 (이름, 경로, 설명)

### 프로젝트 상세 (`/projects/[id]`) — 6개 탭
| 탭 | 내용 |
|----|------|
| Overview | 프로젝트 정보, Import from disk 버튼, 파일 목록 + 삭제 |
| Settings | Project/Local/Merged 스코프 전환, Form/JSON 편집, Import/Export/Save/Copy |
| CLAUDE.md | User/Project/Local 스코프, 마크다운 에디터, Import/Export, 버전 히스토리 |
| Agents | split-pane: 파일 목록(좌) + CodeMirror 마크다운 에디터(우) |
| Rules | 동일 split-pane 구조 |
| Hooks | 통합 UI: 좌(스크립트 편집) + 우(이벤트 연결 wiring), Script/Inline 토글 |

---

## UI 컴포넌트

### shadcn/ui 기반 (`src/components/ui/`)
| 컴포넌트 | 파일 | 용도 |
|----------|------|------|
| Button | button.tsx | variant: default/secondary/ghost/outline/link, size: default/sm/xs/icon-xs |
| Badge | badge.tsx | 스코프 표시, 태그 |
| Card | card.tsx | 파일 카드, 설정 섹션, size: default/sm |
| Dialog | dialog.tsx | 모달 (unsaved 경고, 새 파일 생성) |
| Input | input.tsx | 텍스트 입력 |
| Label | label.tsx | 폼 라벨 |
| Select | select.tsx | 모델 선택, 샌드박스 타입 등 |
| Separator | separator.tsx | 구분선 |
| Sheet | sheet.tsx | 사이드 패널 |
| Switch | switch.tsx | 토글 |
| Tabs | Tabs.tsx | 탭 UI (variant: default/line) |
| Textarea | textarea.tsx | 멀티라인 입력 (시스템 프롬프트) |

### 커스텀 컴포넌트
| 컴포넌트 | 파일 | 용도 |
|----------|------|------|
| CodeEditor | editors/CodeEditor.tsx | CodeMirror 6 래퍼 (markdown/json/shell) |
| ClaudeMdEditor | editors/ClaudeMdEditor.tsx | CLAUDE.md 전용 에디터 + 스코프/버전 |
| FileDirectoryEditor | editors/FileDirectoryEditor.tsx | agents/rules/hooks split-pane 에디터 |
| HooksUnifiedEditor | editors/HooksUnifiedEditor.tsx | Hook 통합 에디터 (스크립트 편집 + 이벤트 연결) |
| EditorToolbar | editors/EditorToolbar.tsx | Save/History/커스텀 버튼 툴바 |
| VersionHistory | editors/VersionHistory.tsx | 파일 버전 타임라인 + 복원 |
| ImportModal | project/ImportModal.tsx | 디스크 파일 스캔 + 선택 import |
| SettingsForm | settings-form.tsx | 설정 폼 에디터 (하위 컴포넌트 포함) |
| SettingsPage | settings-page.tsx | Global/User 설정 페이지 공통 |
| ScopeBadge | scope-badge.tsx | 스코프 색상 뱃지 |
| JsonEditor | json-editor.tsx | JSON 전용 CodeMirror |
| Sidebar | sidebar.tsx | 사이드바 네비게이션 |

### SettingsForm 하위 컴포넌트
| 컴포넌트 | 용도 |
|----------|------|
| TagArrayField | Allow/Deny 태그 배열 입력 (Enter로 추가, ×로 삭제) |
| KeyValueEditor | 환경변수, MCP env용 Key-Value 편집 |
| HookSection | 훅 이벤트별 Rule 목록 (Matcher + Command + Timeout) |
| McpServersEditor | MCP 서버 추가/삭제 (Command, Args, Env) |

---

## CodeMirror 확장

| 언어 | 패키지 | 용도 |
|------|--------|------|
| JSON | `@codemirror/lang-json` | settings.json 편집 |
| Markdown | `@codemirror/lang-markdown` | CLAUDE.md, agents, rules 편집 |
| Shell/Bash | `@codemirror/legacy-modes/mode/shell` + `StreamLanguage` | hooks .sh 스크립트 편집 |

기존 `@codemirror/lang-json`, `@codemirror/lang-markdown`에 추가로 `@codemirror/legacy-modes` 패키지를 설치하여 shell 구문 강조 지원.

---

## Merged 설정 병합 로직

API: `GET /api/projects/[id]/settings/merged`

**병합 순서** (낮은 우선순위 → 높은 우선순위):
```
Global → User → Project → Local
```

**병합 규칙:**
- 일반 필드 (model, env, sandbox 등): 상위 스코프를 하위 스코프가 덮어씀 (shallow merge)
- permissions.allow: 4개 스코프의 배열을 **합산** (중복 제거)
- permissions.deny: 4개 스코프의 배열을 **합산** (중복 제거)

**응답 구조:**
```json
{
  "merged": { /* 최종 합산 설정 */ },
  "sources": {
    "global": { /* global만 */ },
    "user": { /* user만 */ },
    "project": { /* project만 */ },
    "local": { /* local만 */ }
  }
}
```

UI에서 Merged 스코프 선택 시 읽기 전용으로 표시 (Save/Import/Export/Copy 비활성화).

---

## 파일 생성 템플릿

### 에이전트 템플릿 (.md)
```markdown
# {파일명을 제목으로 변환}

## Mandatory Rules
- Follow all governance rules
- Follow all project rules
- No speculation — evidence only

## Role
[Describe the agent's role and responsibilities]

## Required Actions
1. [First action]
2. [Second action]

## Prohibitions
- [What this agent must NOT do]

## Output Format
- [Expected output structure]
```

### 규칙 템플릿 (.md)
```markdown
# {파일명을 제목으로 변환}

## Rules

1. [Rule description]
   - Rationale: [Why this rule exists]

2. [Rule description]
   - Rationale: [Why this rule exists]
```

### 훅 스크립트 템플릿 (.sh)
```bash
#!/bin/bash
# {파일명}
# Hook script for Claude Code
#
# Input: JSON on stdin
# Output: JSON on stdout (optional)

set -euo pipefail

# Read input
INPUT=$(cat)

# Process
# echo "$INPUT" | jq '.tool_name' -r

# Output (optional - for blocking hooks)
# echo '{"decision": "block", "reason": "Blocked by hook"}'
```

---

## CLAUDE.md 프로젝트 규칙

프로젝트 루트에 `CLAUDE.md` 추가. 향후 Claude Code가 이 프로젝트에서 작업할 때 자동 적용:

- 지시받은 작업은 끝까지 완료 후 보고. 중간에 멈추지 않음
- "할까요?" 확인 질문 금지. 지시받은 것은 바로 실행
- 미구현 목록 나열 시 바로 전부 구현
- 완료 보고 시 증거 필수 (API 테스트, 빌드, 동작 확인)
- 에이전트 구현 후 QA/수정까지 한 사이클 완료

---

## 구현 완료 기능

### 1. Settings 관리 (4 스코프)
| 스코프 | 디스크 경로 | 설명 |
|--------|------------|------|
| Global | `~/.claude/settings.json` | 전체 공유 설정 |
| User | `~/.claude/settings.local.json` | 사용자 개인 설정 |
| Project | `{project}/.claude/settings.json` | 프로젝트 공유 설정 |
| Local | `{project}/.claude/settings.local.json` | 프로젝트 로컬 설정 |

- Form 에디터: Model, System Prompt, Max Turns, API Key, Working Directory, Max Tokens, Temperature, Output Format
- JSON 에디터: CodeMirror 6 기반, 구문 강조 + 검색
- Import from disk / Export to disk
- Scope 복사 (Project ↔ Local)
- Merged 미리보기 (4 스코프 합산 결과, 읽기 전용)

### 2. Permissions 관리
- Allow / Deny 규칙 태그 입력
- `Bash(git*)`, `Read`, `WebFetch(domain:...)` 등 패턴 지원

### 3. Hooks JSON 설정 (6개 이벤트)
- PreToolUse, PostToolUse, Notification, Stop, SessionStart, UserPromptSubmit
- 이벤트별 Rule 추가/삭제
- Matcher 패턴 + Command + Timeout 설정

### 4. MCP Servers 관리
- 서버 추가/삭제
- Command, Args, Environment 설정

### 5. Environment Variables
- Key-Value 편집기
- 추가/삭제

### 6. Sandbox 설정
- Docker / None 타입 선택
- Container 이름 설정

### 7. CLAUDE.md 에디터
- User / Project / Local 3개 스코프
- CodeMirror Markdown 에디터
- Import from disk / Export to disk
- 버전 히스토리 (이전 버전 복원)

### 8. 에이전트 관리 (.claude/agents/)
- 파일 목록 (split-pane UI)
- 생성 (구조화된 템플릿 자동 생성)
- 편집 (CodeMirror Markdown)
- 삭제
- sees 프로젝트: 16개 에이전트 정상 조회/편집

### 9. 규칙 관리 (.claude/rules/)
- 파일 목록/생성/편집/삭제
- 구조화된 규칙 템플릿
- sees 프로젝트: 3개 규칙 파일 정상 조회/편집

### 10. 훅 통합 관리 (.claude/hooks/ + settings.hooks)
- 좌측: 파일 목록/생성/편집/삭제 (bash 구문 강조)
- 우측: 6개 이벤트별 hook rule 연결 (아코디언 UI)
- Script 모드: 드롭다운에서 .sh 파일 선택 → 절대경로 저장
- Inline 모드: jq 파이프 등 인라인 명령 직접 입력
- 자동 감지: 기존 설정 로드 시 Script/Inline 자동 판별
- matcher + timeout 설정 지원
- Save Wiring → settings.hooks에 저장
- sees 프로젝트: 15개 훅 스크립트 + 18개 hook rules 정상 조회

### 11. 프로젝트 관리
- 프로젝트 생성/수정/삭제
- Path 자동 trim (앞뒤 공백, 끝 슬래시 제거)
- Path 중복 체크 (409 반환)
- Import from disk (디스크 파일 자동 스캔)

### 12. 사이드바 네비게이션
- Global / User 설정 링크
- 프로젝트 목록 (자동 갱신)
- 프로젝트 추가 바로가기

---

## 보안 및 안정성

### 보안
- Path traversal 방지: 파일명에 `/`, `..`, `.` 차단
- 중복 파일 생성 방지: 409 Conflict 반환
- fs.mkdirSync/unlinkSync try-catch 래핑

### JSON 무결성 (재발 방지)
- **DB 저장 시**: `JSON.parse()` 검증 → invalid JSON은 400 차단
- **Export 시**: parse 실패하면 500 차단, 빈 `{}` 이면 404 차단
- **Import 시**: parse → stringify 정규화 후 저장 (trailing data 제거)
- **Round-trip**: Export → Import 왕복 시 데이터 동일성 검증 완료

### 에러 처리
- 모든 fetch 호출에 try-catch + 서버 에러 메시지 표시
- 네트워크 에러 시 사용자에게 명확한 메시지
- res.ok 체크 후 에러 상태 분기

---

## API 엔드포인트

### Global/User Settings
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/settings?scope=global\|user` | 설정 조회 |
| PUT | `/api/settings?scope=global\|user` | 설정 저장 (JSON 검증) |
| POST | `/api/settings/import?scope=global\|user` | 디스크에서 import |
| POST | `/api/settings/export?scope=global\|user` | 디스크로 export |

### Project Settings
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/projects/[id]/settings?scope=project\|local` | 설정 조회 |
| PUT | `/api/projects/[id]/settings?scope=project\|local` | 설정 저장 (JSON 검증) |
| GET | `/api/projects/[id]/settings/merged` | 4스코프 병합 조회 |
| POST | `/api/projects/[id]/import-settings?scope=project\|local` | 디스크에서 import |
| POST | `/api/projects/[id]/export?scope=project\|local` | 디스크로 export |

### CLAUDE.md
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/projects/[id]/import-claudemd?scope=...` | 디스크에서 import |
| POST | `/api/projects/[id]/export-claudemd?scope=...` | 디스크로 export |

### Agents / Rules / Hooks
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/projects/[id]/agents` | 에이전트 목록 |
| POST | `/api/projects/[id]/agents` | 에이전트 생성 (중복 409) |
| PUT | `/api/projects/[id]/agents` | 에이전트 수정 |
| DELETE | `/api/projects/[id]/agents?name=...` | 에이전트 삭제 |
| GET | `/api/projects/[id]/rules` | 규칙 목록 |
| POST | `/api/projects/[id]/rules` | 규칙 생성 |
| PUT | `/api/projects/[id]/rules` | 규칙 수정 |
| DELETE | `/api/projects/[id]/rules?name=...` | 규칙 삭제 |
| GET | `/api/projects/[id]/hooks` | 훅 목록 |
| POST | `/api/projects/[id]/hooks` | 훅 생성 |
| PUT | `/api/projects/[id]/hooks` | 훅 수정 |
| DELETE | `/api/projects/[id]/hooks?name=...` | 훅 삭제 |

### Projects / Files
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/projects` | 프로젝트 목록 |
| POST | `/api/projects` | 프로젝트 생성 |
| GET | `/api/projects/[id]` | 프로젝트 상세 |
| PUT | `/api/projects/[id]` | 프로젝트 수정 |
| DELETE | `/api/projects/[id]` | 프로젝트 삭제 |
| GET | `/api/projects/[id]/files` | 파일 목록 |
| POST | `/api/projects/[id]/files` | 파일 생성 |
| PUT | `/api/projects/[id]/files/[fileId]` | 파일 수정 |
| DELETE | `/api/projects/[id]/files/[fileId]` | 파일 삭제 |
| POST | `/api/projects/[id]/import` | 디스크 파일 스캔/import |

---

## 파일 구조

```
src/
├── app/
│   ├── api/
│   │   ├── settings/
│   │   │   ├── route.ts              # Global/User settings CRUD
│   │   │   ├── import/route.ts       # Global/User import
│   │   │   └── export/route.ts       # Global/User export
│   │   └── projects/
│   │       ├── route.ts              # Projects list/create
│   │       └── [id]/
│   │           ├── route.ts          # Project CRUD
│   │           ├── settings/
│   │           │   ├── route.ts      # Project settings CRUD
│   │           │   └── merged/route.ts # Merged 4-scope view
│   │           ├── agents/route.ts   # Agents CRUD
│   │           ├── rules/route.ts    # Rules CRUD
│   │           ├── hooks/route.ts    # Hooks CRUD
│   │           ├── files/
│   │           │   ├── route.ts      # Files list/create
│   │           │   └── [fileId]/route.ts # File CRUD
│   │           ├── import/route.ts
│   │           ├── import-settings/route.ts
│   │           ├── import-claudemd/route.ts
│   │           ├── export/route.ts
│   │           └── export-claudemd/route.ts
│   ├── settings/
│   │   ├── global/page.tsx
│   │   └── user/page.tsx
│   ├── projects/
│   │   ├── page.tsx                  # Projects list page
│   │   └── [id]/page.tsx            # Project detail (6 tabs)
│   ├── page.tsx                      # Home
│   └── globals.css
├── components/
│   ├── editors/
│   │   ├── CodeEditor.tsx            # CodeMirror (markdown/json/shell)
│   │   ├── ClaudeMdEditor.tsx        # CLAUDE.md editor
│   │   ├── FileDirectoryEditor.tsx   # Agents/Rules/Hooks editor
│   │   ├── HooksUnifiedEditor.tsx   # Hook 통합 (스크립트 + 이벤트 연결)
│   │   ├── EditorToolbar.tsx
│   │   └── VersionHistory.tsx
│   ├── project/
│   │   └── ImportModal.tsx
│   ├── ui/                           # shadcn/ui components
│   ├── settings-form.tsx             # Settings form editor
│   ├── settings-page.tsx             # Global/User settings page
│   ├── sidebar.tsx
│   ├── scope-badge.tsx
│   └── json-editor.tsx
├── lib/
│   ├── db/
│   │   ├── schema.ts                # DB schema (projects, settings, files, fileVersions)
│   │   ├── index.ts
│   │   └── migrate.ts
│   ├── file-io/
│   │   └── index.ts                 # Disk operations (read/write/list/detect)
│   ├── settings-schema.ts           # ClaudeSettings type definitions
│   └── utils.ts
└── CLAUDE.md                         # 작업 규칙
```

---

## 테스트 결과

### API 테스트 (23/23 통과)
- Agents CRUD: 16개 조회, 생성(201), 수정(200), 삭제(200)
- Rules CRUD: 3개 조회, 생성/수정/삭제
- Hooks CRUD: 15개 조회, 생성/수정/삭제
- 보안: path traversal(400), 중복(409), 없는 파일(404), 없는 프로젝트(404)

### Import/Export 전수조사 (10/10 통과)
- 4개 스코프 Export → 디스크 valid JSON 확인
- Round-trip (Export→Import) 데이터 동일성 확인
- CLAUDE.md Export 정상
- 빈 `{}` Export 차단 (404)
- Invalid JSON 저장 차단 (400)
- 이중 JSON 없음 확인

### TypeScript 빌드
- `tsc --noEmit` 에러 없음

---

## 발견 및 수정한 버그

| # | 버그 | 원인 | 수정 |
|---|------|------|------|
| 1 | Import/Export scope 하드코딩 | `resolveFilePath("", "settings", "user")` 고정 | 실제 scope 파라미터 전달 |
| 2 | Null query 버그 (project import) | `eq(settings.projectPath, ...)` null 비교 | `isNull()` 사용 |
| 3 | res.ok 미체크 | 모든 fetch가 에러 무시 | res.ok 체크 + 에러 표시 |
| 4 | loadProject() try/finally 누락 | 네트워크 에러 시 무한 스피너 | try/catch/finally 래핑 |
| 5 | Scope 변경 시 설정 미갱신 | setState만 하고 loadSettings 안 함 | loadSettings(newScope) 호출 |
| 6 | 사이드바 프로젝트 목록 미갱신 | useEffect `[]` 의존성 | `[pathname]` 변경 |
| 7 | sees 프로젝트 path 공백 | `" /Users/min/..."` 앞 공백 | `.trim()` 자동 처리 |
| 8 | Global/User 설정 분리 누락 | 한 파일로 합쳐버림 | 별도 스코프로 분리 |
| 9 | settings.json 이중 JSON | Export 시 `{}` 선행 기록 | JSON 검증 + 빈값 차단 |
| 10 | Export가 invalid JSON 허용 | catch에서 raw 그대로 기록 | parse 실패 시 500 반환 |

---

## sees 프로젝트 분석 결과

### 에이전트 오케스트라 (16개 에이전트, 8단계)
- Phase 1 (분석): A1~A5 — 데이터/코드/DB/기능/비교 분석
- Phase 2 (기획): B1~B2 — 기획/UI 설계
- Phase 3 (개발): C1~C2 — 백엔드/프론트엔드
- Phase 4 (리뷰): D1~D3 — 코드/보안/검증
- Phase 5 (배포): E1 — 배포
- Phase 6 (테스트): F1~F3 — API/UI/회귀 테스트

### 리더 폭주 사건
- 리더 에이전트가 임의 코드 수정, 에이전트 80개+ 좀비 생성
- 대응: block-leader-edit.sh, block-leader-team-create.sh 등 차단 훅 적용
- 교훈: 에이전트 팀 모드에서 리더 권한 제한은 필수

---

## 설치한 패키지

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `@codemirror/legacy-modes` | ^6.5.2 | Shell/Bash 구문 강조 (hooks .sh 편집) |

> 기존 패키지 (`next`, `drizzle-orm`, `better-sqlite3`, `@codemirror/lang-json`, `@codemirror/lang-markdown`, `@base-ui/react` 등)는 초기 커밋에 포함.

---

## git 변경 파일 목록

### 신규 파일 (New)
| 파일 | 설명 |
|------|------|
| `CLAUDE.md` | 프로젝트 작업 규칙 |
| `docs/work-report.md` | 작업내역서 |
| `src/app/api/projects/[id]/agents/route.ts` | Agents CRUD API |
| `src/app/api/projects/[id]/rules/route.ts` | Rules CRUD API |
| `src/app/api/projects/[id]/hooks/route.ts` | Hooks CRUD API |
| `src/app/api/projects/[id]/settings/merged/route.ts` | Merged 4-scope API |
| `src/app/api/projects/[id]/export/route.ts` | Project settings export |
| `src/app/api/projects/[id]/export-claudemd/route.ts` | CLAUDE.md export |
| `src/app/api/projects/[id]/import-settings/route.ts` | Project settings import |
| `src/app/api/projects/[id]/import-claudemd/route.ts` | CLAUDE.md import |
| `src/app/api/settings/export/route.ts` | Global/User settings export |
| `src/app/api/settings/import/route.ts` | Global/User settings import |
| `src/components/editors/FileDirectoryEditor.tsx` | Agents/Rules/Hooks split-pane 에디터 |
| `src/components/editors/HooksUnifiedEditor.tsx` | Hook 통합 에디터 (Script/Inline 토글 + 이벤트 연결) |
| `src/components/ui/badge.tsx` | Badge 컴포넌트 |
| `src/components/ui/card.tsx` | Card 컴포넌트 |
| `src/components/ui/dialog.tsx` | Dialog 컴포넌트 |
| `src/components/ui/input.tsx` | Input 컴포넌트 |
| `src/components/ui/label.tsx` | Label 컴포넌트 |
| `src/components/ui/select.tsx` | Select 컴포넌트 |
| `src/components/ui/separator.tsx` | Separator 컴포넌트 |
| `src/components/ui/sheet.tsx` | Sheet 컴포넌트 |
| `src/components/ui/switch.tsx` | Switch 컴포넌트 |
| `src/components/ui/textarea.tsx` | Textarea 컴포넌트 |

### 수정 파일 (Modified)
| 파일 | 변경 내용 |
|------|----------|
| `package.json` / `package-lock.json` | @codemirror/legacy-modes 추가 |
| `src/app/globals.css` | 스타일 수정 |
| `src/app/page.tsx` | 홈 페이지 UI 개선 |
| `src/app/projects/[id]/page.tsx` | Agents/Rules/Hooks 탭 추가, Merged 스코프 |
| `src/app/projects/page.tsx` | 프로젝트 목록 UI |
| `src/app/api/projects/route.ts` | path trim + 중복 체크 |
| `src/app/api/projects/[id]/route.ts` | 프로젝트 CRUD |
| `src/app/api/projects/[id]/settings/route.ts` | PUT JSON 검증 추가 |
| `src/app/api/projects/[id]/files/[fileId]/route.ts` | 파일 CRUD |
| `src/app/api/projects/[id]/import/route.ts` | import 개선 |
| `src/app/api/settings/route.ts` | PUT JSON 검증 추가 |
| `src/components/editors/CodeEditor.tsx` | Shell 구문 강조 추가 (StreamLanguage + legacy-modes) |
| `src/components/editors/ClaudeMdEditor.tsx` | 스코프 + 버전 히스토리 |
| `src/app/api/projects/[id]/import-settings/route.ts` | 404 시 다른 scope 파일 존재 힌트 추가 |
| `src/components/editors/EditorToolbar.tsx` | 툴바 버튼 개선 |
| `src/components/editors/VersionHistory.tsx` | 버전 히스토리 UI |
| `src/components/project/ImportModal.tsx` | import 모달 |
| `src/components/scope-badge.tsx` | 스코프 뱃지 |
| `src/components/settings-form.tsx` | 설정 폼 에디터 |
| `src/components/settings-page.tsx` | Global/User 설정 페이지 |
| `src/components/sidebar.tsx` | 사이드바 네비게이션 |
| `src/components/ui/Tabs.tsx` | 탭 컴포넌트 |
| `src/lib/db/migrate.ts` | DB 마이그레이션 |
| `src/lib/file-io/index.ts` | listDirectoryFiles, detectClaudeFiles 확장 |
| `src/lib/settings-schema.ts` | UserPromptSubmit 이벤트 추가 |

### 삭제 파일 (Deleted)
| 파일 | 이유 |
|------|------|
| `src/components/editors/SettingsEditor.tsx` | settings-form.tsx로 통합, 미사용 |

---

## 설정값 / 상수 정의

### `src/lib/settings-schema.ts`

```typescript
// Hook 이벤트 (6개)
export const HOOK_EVENTS = [
  "PreToolUse", "PostToolUse", "Notification",
  "Stop", "SessionStart", "UserPromptSubmit",
] as const;

// 모델 옵션 (3개)
export const MODEL_OPTIONS = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
] as const;

// 샌드박스 타입 (2개)
export const SANDBOX_TYPES = [
  { value: "docker", label: "Docker" },
  { value: "none", label: "None" },
] as const;

// 출력 형식 (3개)
export const OUTPUT_FORMAT_OPTIONS = ["text", "json", "stream-json"] as const;
```

### `src/lib/file-io/index.ts` — 파일 경로 규칙

| scope | type=settings | type=claude-md |
|-------|--------------|----------------|
| global | `~/.claude/settings.json` | — |
| user | `~/.claude/settings.local.json` | `~/.claude/CLAUDE.md` |
| project | `{path}/.claude/settings.json` | `{path}/CLAUDE.md` |
| local | `{path}/.claude/settings.local.json` | `{path}/.claude/CLAUDE.local.md` |

### `src/components/editors/FileDirectoryEditor.tsx` — 디렉토리 경로

| type | 디렉토리 | 확장자 | 에디터 언어 |
|------|----------|--------|------------|
| agents | `{project}/.claude/agents/` | `.md` | markdown |
| rules | `{project}/.claude/rules/` | `.md` | markdown |
| hooks | `{project}/.claude/hooks/` | `.sh` | shell |

---

## 데이터 흐름

### Settings Save (PUT) 경로
```
UI (Form/JSON 에디터)
  → PUT /api/settings?scope=... 또는 PUT /api/projects/[id]/settings?scope=...
  → body.config 파싱: string이면 그대로, object이면 JSON.stringify()
  → JSON.parse(config) 검증 — 실패 시 400 반환
  → DB upsert (scope + projectPath unique)
  → 응답: 저장된 row 반환
```

### Settings Import (디스크 → DB) 경로
```
UI (Import 버튼)
  → POST /api/settings/import?scope=... 또는 POST /api/projects/[id]/import-settings?scope=...
  → resolveFilePath()로 디스크 경로 결정
  → readFileContent()로 파일 읽기 — 없으면 404
  → JSON.parse(content) — 실패 시 400
  → JSON.stringify(parsed, null, 2) 정규화 (trailing data 제거, 포맷팅)
  → DB upsert
  → 응답: { success, path, scope }
```

### Settings Export (DB → 디스크) 경로
```
UI (Export 버튼)
  → POST /api/settings/export?scope=... 또는 POST /api/projects/[id]/export?scope=...
  → DB에서 row 조회
  → config === "{}" 이면 404 (빈 설정 export 차단)
  → JSON.parse(row.config) — 실패 시 500 (DB 오염 감지)
  → JSON.stringify(parsed, null, 2) 정규화
  → writeFileContent()로 디스크에 기록
  → 응답: { success, path, scope }
```

### Agents/Rules/Hooks CRUD 경로
```
UI (FileDirectoryEditor)
  ├─ GET /api/projects/[id]/agents → fs.readdirSync → 파일 목록 반환
  ├─ POST (생성) → isValidName() 검증 → fileExists() 중복 체크(409) → mkdirSync → writeFileSync
  ├─ PUT (수정) → 파일 읽기 → 내용 덮어쓰기
  └─ DELETE → unlinkSync → 200
```

### Merged Settings 경로
```
GET /api/projects/[id]/settings/merged
  → DB에서 4개 스코프 조회 (global, user, project, local)
  → 순서대로 shallow merge (후순위가 덮어씀)
  → permissions.allow/deny는 배열 합산 + Set 중복 제거
  → 응답: { merged, sources: { global, user, project, local } }
```

---

## [2차 작업] Hook 통합 관리 UI

### 배경
Settings 탭의 HookSection(matcher/command/timeout 폼)과 Hooks 탭의 FileDirectoryEditor(.sh 파일 편집)가 분리되어 있어서, 스크립트를 만들어도 hook 이벤트에 연결하려면 Settings 탭에서 JSON을 직접 수정해야 했음.

### 구현 내용

#### 신규 파일
| 파일 | 설명 |
|------|------|
| `src/components/editors/HooksUnifiedEditor.tsx` | Hook 통합 에디터 (좌: 스크립트 편집, 우: 이벤트 연결) |

#### 수정 파일
| 파일 | 변경 |
|------|------|
| `src/components/editors/FileDirectoryEditor.tsx` | `onFilesChange` prop 추가 (스크립트 목록 상위 전달) |
| `src/components/settings-form.tsx` | `hideHooks` prop 추가 (프로젝트 스코프에서 Hooks 카드 숨김) |
| `src/app/projects/[id]/page.tsx` | Hooks 탭에 HooksUnifiedEditor 연결, Settings 탭 hideHooks, hooks 탭 진입 시 loadSettings 호출 |
| `src/app/api/projects/[id]/import-settings/route.ts` | 404 에러 시 다른 scope 파일 존재 힌트 제공 |

#### HooksUnifiedEditor 구조
```
┌──────────────────────┬──────────────────────────────────┐
│  .sh 스크립트 편집    │  Hook 이벤트 연결 (Wiring)        │
│  FileDirectoryEditor │  6개 이벤트 아코디언              │
│  (기존 컴포넌트)      │  각 Rule: matcher + commands     │
│                      │  각 Command: Script/Inline 토글  │
│                      │  [Save Wiring] 버튼              │
└──────────────────────┴──────────────────────────────────┘
```

#### CommandEntry — Script/Inline 토글
- **Script 모드**: 드롭다운에서 .sh 파일 선택 → `{projectPath}/.claude/hooks/{filename}` 절대경로로 저장
- **Inline 모드**: 텍스트 입력 (jq 파이프 등 인라인 명령)
- **자동 감지**: command가 `{projectPath}/.claude/hooks/*.sh` 패턴이면 Script, 아니면 Inline

#### 데이터 흐름
```
스크립트 생성:
  FileDirectoryEditor → POST /api/projects/[id]/hooks → .sh 파일 생성
  → onFilesChange 콜백 → HookWiringPanel 드롭다운 갱신

이벤트 연결:
  HookWiringPanel → Script 선택 → command = 절대경로
  → Save Wiring → PUT /api/projects/[id]/settings → settings.hooks 업데이트
  → onSettingsSaved → 부모 rawContent 동기화
```

### 발견/수정 버그 (2차)

| # | 버그 | 원인 | 수정 |
|---|------|------|------|
| 11 | Hooks 탭 진입 시 settings 미로드 | `onValueChange`가 settings 탭만 처리 | hooks 탭도 `loadSettings` 호출 추가 |
| 12 | Import 404 에러 메시지 불친절 | scope 불일치 시 파일 없다고만 표시 | 다른 scope 파일 존재 여부 힌트 추가 |

---

## 자체 점검 (CLAUDE.md 체크리스트)

- [x] 프로젝트 개요 + 기술 스택
- [x] DB 스키마 (테이블별 컬럼 명세)
- [x] API 엔드포인트 전체 목록 (Method, Path, 설명)
- [x] 페이지 구성 (URL별 기능 설명)
- [x] UI 컴포넌트 목록 (파일명, 용도, props)
- [x] 파일 구조 트리
- [x] 구현 기능 상세 (기능별 동작 설명)
- [x] 보안/에러 처리 내역
- [x] 발견/수정한 버그 목록
- [x] 테스트 결과 (증거)
- [x] 설치한 패키지 목록
- [x] git 변경 파일 목록 (신규 24 / 수정 25 / 삭제 1)
- [x] 설정값/템플릿/상수 정의 내용
- [x] 데이터 흐름 설명 (Import/Export/Save 경로)
- [x] 빠진 항목 스스로 점검 후 보완 ← 이 항목

---

*작성일: 2026-04-12*

---

# 추가 작업 — 에이전트 거버넌스 프로필 확장 & 참조 파일 자동 주입 (2026-04-13)

## 프로젝트 개요 (추가분)
기존 에이전트 거버넌스 시스템(Phase 1~8)에 대해 두 가지 개선을 수행:
1. 거버넌스 프로필 16개 → 28개 확장 (현실 업무 커버리지 향상)
2. 에이전트 생성 시 참조 문서(`@path`)를 자동 주입하는 `referenceFiles` 기능 추가

## 기술 스택
- (변경 없음) Next.js 16 App Router, TypeScript, Drizzle, base-ui, CodeMirror 6

## DB 스키마
- (변경 없음) 본 작업은 런타임 데이터베이스 영향 없음 — 순수 코드 레벨 추가

## API 엔드포인트 (변경/확장)
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/agent-references` | 28개 프로필 전체 반환 (기존) |
| GET | `/api/agent-references/[id]` | 단일 프로필 반환 (기존) |
| POST | `/api/agent-references/[id]/render` | **확장** — body에 `referenceFiles?: string[]` 수신, 응답에 `defaultReferenceFiles` 추가 |
| GET | `/api/agent-references/policies` | 거버넌스 정책 (기존) |
| GET | `/api/projects/[id]/agents/analysis` | 비용·의존성·검증 분석 (기존) |

## 페이지 구성
- (변경 없음) `/projects/[id]?category=agents` 에서 `AgentEditor` → `CreateAgentDialog`로 진입

## UI 컴포넌트 변경 내역
| 파일 | 용도 | 이번 변경 |
|---|---|---|
| `CreateAgentDialog.tsx` | 2단계 에이전트 생성 다이얼로그 | Step 2에 참조 문서 관리 UI 추가 (칩 리스트 + 추가 input + 제거 버튼 + 실시간 프리뷰 재렌더) |
| `ProfileSelector.tsx` | 카테고리별 프로필 선택 | 변경 없음 (28개 자동 반영) |
| `AgentPreview.tsx` | CodeMirror 읽기 전용 미리보기 | 변경 없음 |

### CreateAgentDialog 신규 상태
- `referenceFiles: string[]` — Step 2 진입 시 `defaultReferenceFiles`로 초기화
- `newRefPath: string` — 신규 경로 입력
- `fetchPreview(refs, useDefaultsIfFirst)` — 단일 렌더 함수로 통합
- `addRef()` / `removeRef(path)` — 변경 시 즉시 프리뷰 refetch

## 파일 구조 트리 (이번 세션 변경 범위)
```
src/lib/agent-references/
├── types.ts                    ← referenceFiles?: string[] 필드 추가
├── renderer.ts                 ← renderReferenceSection() + renderAgentMd 확장
└── profiles/
    ├── readonly.ts             ← 5개 프로필 (+2 log-analyzer, dep-checker) + refs
    ├── creator.ts              ← 6개 프로필 (+3 refactor, ui-component, api-endpoint) + refs
    ├── executor.ts             ← 4개 프로필 (+2 db-migrator, deployer) + refs
    ├── researcher.ts           ← 4개 프로필 (+2 library-evaluator, rfc-drafter) + refs
    ├── devops.ts               ← 4개 프로필 (+2 monitoring, k8s-operator) + refs
    └── orchestrator.ts         ← 5개 프로필 (+3 feature/release/incident) + refs
src/app/api/agent-references/[id]/render/route.ts  ← referenceFiles 수신 + defaults 반환
src/components/agents/CreateAgentDialog.tsx        ← Step 2 refs 관리 UI
```

## 구현 기능 상세

### 1) 프로필 28개 확장
- **readonly (3→5)**: `readonly-log-analyzer`(로그 분석), `readonly-dep-checker`(의존성 취약점/구버전)
- **creator (3→6)**: `creator-refactor`(worktree 리팩토링), `creator-ui-component`(React/Vue 컴포넌트), `creator-api-endpoint`(REST/GraphQL 라우트)
- **executor (2→4)**: `executor-db-migrator`(DROP/TRUNCATE 차단 훅), `executor-deployer`(canary/blue-green)
- **researcher (2→4)**: `researcher-library-evaluator`(비교 표), `researcher-rfc-drafter`(RFC 초안)
- **devops (2→4)**: `devops-monitoring`(RED/USE + 알림), `devops-k8s-operator`(namespace 삭제 차단 훅)
- **orchestrator (2→5)**: `orchestrator-feature-builder`(설계→구현→테스트→리뷰), `orchestrator-release-manager`(릴리스 파이프라인), `orchestrator-incident-response`(장애 대응)

### 2) referenceFiles 자동 주입
**동작 흐름:**
1. 프로필에 `referenceFiles: ["CLAUDE.md", "docs/..."]` 선언
2. `renderAgentMd()`가 body의 `# 제목` 뒤에 섹션 삽입:
   ```markdown
   ## 참조 문서 (자동 로드)
   @CLAUDE.md
   @docs/api-conventions.md
   ```
3. Claude Code가 에이전트 실행 시 `@경로` 를 자동으로 컨텍스트에 로드
4. UI에서 사용자가 Step 2 미리보기 상에서 기본값 확인 후 추가/제거 가능

**렌더러 로직:**
- `renderReferenceSection(files: string[])` — `@` 접두사 정규화, 빈 배열이면 빈 문자열
- body `^(#[^\n]*\n\n?)` 정규식 매치 후 그 뒤에 섹션 삽입 (제목 없으면 최상단)
- 우선순위: `overrides.referenceFiles` (API 호출) > `profile.referenceFiles` (기본값)

### 3) 프로필별 기본 참조 파일
| 프로필 | 기본 참조 파일 |
|---|---|
| readonly-strict / analysis / log-analyzer / web | `CLAUDE.md` |
| readonly-dep-checker | `package.json` |
| creator-additive / full | `CLAUDE.md` |
| creator-refactor | `CLAUDE.md`, `docs/coding-standards.md` |
| creator-ui-component | `CLAUDE.md`, `docs/design-system.md` |
| creator-api-endpoint | `CLAUDE.md`, `docs/api-conventions.md` |
| executor-isolated / sandboxed | `CLAUDE.md` |
| executor-db-migrator | `CLAUDE.md`, `docs/db-migration-guide.md` |
| executor-deployer | `CLAUDE.md`, `docs/deployment.md` |
| researcher-light / deep | `CLAUDE.md` |
| researcher-library-evaluator | `package.json` |
| researcher-rfc-drafter | `CLAUDE.md`, `docs/architecture.md` |
| devops-readonly / apply | `CLAUDE.md` |
| devops-monitoring | `CLAUDE.md`, `docs/slo.md` |
| devops-k8s-operator | `CLAUDE.md`, `docs/k8s-runbook.md` |
| orchestrator-readonly / full | `CLAUDE.md` |
| orchestrator-feature-builder | `CLAUDE.md`, `docs/architecture.md` |
| orchestrator-release-manager | `CLAUDE.md`, `docs/release-process.md` |
| orchestrator-incident-response | `CLAUDE.md`, `docs/runbook.md`, `docs/slo.md` |

## 보안/에러 처리 내역
- **파괴적 명령 자동 차단 훅** — 신규 프로필에 적용:
  - `executor-db-migrator`: `DROP TABLE | TRUNCATE | DELETE FROM ... WHERE 1=1 | DROP DATABASE`
  - `devops-k8s-operator`: `kubectl delete namespace | kubectl delete -f | helm uninstall | kubectl drain --force`
- **lockedFields 확장** — 14개 신규 프로필에 보안/거버넌스 필드 잠금 설정
- **존재하지 않는 참조 파일** — `@docs/xxx.md`가 실제 없어도 Claude Code가 경고만 출력 (에이전트 실행 자체는 실패하지 않음)
- **API 검증** — `validateAgentName` / `validateFrontmatter` / `checkLockedFieldChanges` 기존 로직 그대로 적용

## 발견/수정한 버그
- 이번 세션 중 신규 버그 발견 없음 (모든 변경이 additive)

## 테스트 결과 (증거)
1. **TypeScript 빌드**: `npx tsc --noEmit` → 무출력 (통과)
2. **프로필 개수 검증**:
   ```
   $ curl -s http://localhost:3000/api/agent-references | jq '.total'
   28
   ```
3. **기본 참조 파일 주입 검증**:
   ```
   $ curl -s -X POST .../creator-api-endpoint/render -d '{"agentName":"test-api"}'
   → defaultReferenceFiles: ["CLAUDE.md", "docs/api-conventions.md"]
   → md 본문에 "## 참조 문서 (자동 로드)\n@CLAUDE.md\n@docs/api-conventions.md" 삽입 확인
   ```
4. **override 동작 검증**:
   ```
   $ curl -s -X POST .../creator-api-endpoint/render \
       -d '{"agentName":"test-api","referenceFiles":["docs/custom.md"]}'
   → 본문에 @docs/custom.md 만 표시 (기본값 대체)
   ```

## 설치한 패키지 목록
- 없음 (이번 세션은 기존 스택만 사용)

## git 변경 파일 목록

### 커밋 `b8c0c03` — feat(agents): expand governance profiles from 16 to 28
수정 6개:
- `src/lib/agent-references/profiles/readonly.ts`
- `src/lib/agent-references/profiles/creator.ts`
- `src/lib/agent-references/profiles/executor.ts`
- `src/lib/agent-references/profiles/researcher.ts`
- `src/lib/agent-references/profiles/devops.ts`
- `src/lib/agent-references/profiles/orchestrator.ts`
총 +578 삽입

### 커밋 `0acb83e` — feat(agents): add referenceFiles for auto-loaded agent context
수정 10개:
- `src/lib/agent-references/types.ts` (+6)
- `src/lib/agent-references/renderer.ts` (+36/-)
- `src/lib/agent-references/profiles/readonly.ts` (+5)
- `src/lib/agent-references/profiles/creator.ts` (+5)
- `src/lib/agent-references/profiles/executor.ts` (+4)
- `src/lib/agent-references/profiles/researcher.ts` (+4)
- `src/lib/agent-references/profiles/devops.ts` (+4)
- `src/lib/agent-references/profiles/orchestrator.ts` (+5)
- `src/app/api/agent-references/[id]/render/route.ts` (+8/-)
- `src/components/agents/CreateAgentDialog.tsx` (+118/-)
총 +174 / -21

## 설정값/템플릿/상수 정의 내용

### 신규 타입 필드
```ts
// src/lib/agent-references/types.ts
export interface GovernanceProfile {
  // ... 기존 필드
  referenceFiles?: string[];  // 자동 로드될 @-mention 파일 경로
}
```

### 렌더러 신규 함수
```ts
// src/lib/agent-references/renderer.ts
function renderReferenceSection(referenceFiles: string[]): string
// → "## 참조 문서 (자동 로드)\n@path1\n@path2\n\n"

export function renderAgentMd(
  profile: GovernanceProfile,
  agentName: string,
  overrides?: Partial<AgentFrontmatter>,
  referenceFiles?: string[]  // ← 신규 파라미터
): string
```

## 데이터 흐름 설명

### 에이전트 생성 플로우 (참조 파일 포함)
```
[사용자] CreateAgentDialog 열기
   ↓
Step 1: agentName 입력 + profileId 선택
   ↓ "Next →"
POST /api/agent-references/{profileId}/render { agentName }
   ↓
서버: renderAgentMd(profile, name, undefined, undefined)
     → referenceFiles = profile.referenceFiles (프로필 기본값)
     → body에 "## 참조 문서" 섹션 주입
   ↓
응답: { md, warnings, defaultReferenceFiles, companionSettings }
   ↓
Step 2: md 프리뷰 + defaultReferenceFiles를 칩으로 표시
   ↓ [사용자가 칩 ×클릭 / 입력+추가 버튼]
refreshPreview(next) → POST render { agentName, referenceFiles: next }
   ↓
서버: renderAgentMd(profile, name, undefined, next)  ← 명시적 override
     → 사용자 지정 목록으로 섹션 재생성
   ↓
CodeMirror 프리뷰 즉시 업데이트
   ↓ "Create"
onCreate(name, md) → AgentEditor가 파일 저장
```

### Claude Code 런타임 흐름
```
에이전트 실행 → .md body의 @CLAUDE.md / @docs/xxx.md 파싱
   ↓
Claude Code가 해당 파일을 자동으로 읽어 시스템 프롬프트 컨텍스트에 주입
   ↓
에이전트는 별도 Read 호출 없이 참조 문서 내용을 이미 알고 있는 상태로 작업 시작
```

## 빠진 항목 스스로 점검
- [x] 프로젝트 개요 + 기술 스택
- [x] DB 스키마 (변경 없음 명시)
- [x] API 엔드포인트 (render 확장 명시)
- [x] 페이지 구성 (진입 경로)
- [x] UI 컴포넌트 (CreateAgentDialog 변경분)
- [x] 파일 구조 트리 (변경 범위)
- [x] 구현 기능 상세 (3개 섹션)
- [x] 보안/에러 처리 (파괴적 명령 훅 + lockedFields + 미존재 파일 처리)
- [x] 발견/수정한 버그 (없음 명시)
- [x] 테스트 결과 (tsc + curl 3건)
- [x] 설치한 패키지 (없음 명시)
- [x] git 변경 파일 (커밋별)
- [x] 설정값/템플릿/상수 (타입/함수 시그니처)
- [x] 데이터 흐름 (생성 + 런타임)
- [x] 빠진 항목 점검 ← 이 항목

---

*추가 작업 완료일: 2026-04-13*
*커밋: `b8c0c03`, `0acb83e`*

---

# 긴급 수정 — referenceFiles 재설계 (2026-04-13, 같은 날)

## 문제 발견
직전 작업(`0acb83e`)에서 `referenceFiles` 를 body에 `@path` 형태로 렌더링했지만, **Claude Code 공식 문서 확인 결과 `@path` 자동 import는 CLAUDE.md 전용 기능이며 subagent body에서는 동작하지 않음**이 확인됨.

출처: https://code.claude.com/docs/en/memory — "CLAUDE.md files can import additional files using `@path/to/import` syntax." / https://code.claude.com/docs/en/sub-agents — "The body becomes the system prompt... Subagents receive only this system prompt, not the full Claude Code system prompt."

즉 기존 렌더 결과 `@CLAUDE.md` 는 subagent에 단순 문자열로 전달되어 **파일 내용 자동 로드가 발생하지 않음**. 기능이 의도대로 동작하지 않는 상태였음.

## 수정 내역

### 1) 렌더 포맷 변경 (`@path` → Read 툴 지시)
`src/lib/agent-references/renderer.ts` 의 `renderReferenceSection()` 출력 변경:
- **Before**: `## 참조 문서 (자동 로드)\n@CLAUDE.md`
- **After**: `` ## 참조 문서 (작업 시작 전 Read 툴로 반드시 읽을 것)\n- `CLAUDE.md` ``
- `@` 접두사 제거 — 오해 방지
- 백틱으로 경로 감싸기

### 2) `parseReferenceSection()` 유틸 추가 (renderer.ts)
body 문자열에서 참조 섹션을 파싱해 `{ files: string[], bodyWithoutRef: string }` 반환. 편집 UI round-trip용.

### 3) validator 확장
`src/lib/agent-references/validator.ts` 에 `validateReferenceFiles()` 추가:
- tools 에 `Read` 가 없거나 `disallowedTools` 에 `Read` 가 있으면 경고
- 참조 파일을 읽을 수 없는 상태 방지

### 4) render API 통합
`src/app/api/agent-references/[id]/render/route.ts` 에서 `validateReferenceFiles` 호출, warnings에 포함.

### 5) 허수 docs 경로 제거
28개 프로필의 `referenceFiles` 에서 실존하지 않는 `docs/*.md` 전부 제거:
- `docs/coding-standards.md`, `docs/design-system.md`, `docs/api-conventions.md`, `docs/architecture.md`, `docs/release-process.md`, `docs/runbook.md`, `docs/slo.md`, `docs/k8s-runbook.md`, `docs/db-migration-guide.md`, `docs/deployment.md` 전부 제거
- 실존 파일만 유지: `CLAUDE.md`, `package.json`

### 6) AgentSettingsForm 에 참조 문서 섹션 추가
`src/components/agents/AgentSettingsForm.tsx`:
- `body` / `onBodyChange` prop 추가
- `parseReferenceSection()` 으로 body에서 참조 파일 목록 파싱 → 칩 리스트 표시
- 추가/제거 시 body 재조립 후 `onBodyChange` 호출
- Read 툴 없을 때 인라인 경고 표시

### 7) AgentEditor 연결
`src/components/agents/AgentEditor.tsx` 에서 `body` / `setBody` 를 `AgentSettingsForm` 에 전달.

### 8) CreateAgentDialog 문구 수정
- 레이블: "참조 문서 (자동 로드 — @경로)" → "참조 문서 (작업 시작 전 Read 툴로 읽음)"
- 칩 표시에서 `@` 제거

## 테스트 결과 (증거)

### TypeScript
```
$ npx tsc --noEmit
(무출력 — 통과)
```

### API — 새 포맷 렌더링
```
$ curl -s -X POST .../creator-api-endpoint/render -d '{"agentName":"test-api"}'
→ DEFAULTS: ['CLAUDE.md']
→ body:
  # test-api
  ## 참조 문서 (작업 시작 전 Read 툴로 반드시 읽을 것)
  - `CLAUDE.md`
```

### API — Read 툴 없을 때 경고
```
$ curl -s -X POST .../researcher-light/render \
    -d '{"agentName":"test","overrides":{"tools":["Glob"],"disallowedTools":["Read"]}}'
→ warnings 에 포함:
  - "참조 파일이 지정되었지만 Read 툴이 없음 — 에이전트가 파일을 읽을 수 없습니다"
```

### Parser round-trip
```
$ npx tsx -e 'parseReferenceSection 테스트'
→ files: ['CLAUDE.md', 'package.json']
→ bodyWithoutRef: 참조 섹션이 제거된 본문
```

## 빠진 항목 스스로 점검
- [x] 문제 정의 (왜 수정하는지 + 출처)
- [x] 수정 항목 나열 (8개)
- [x] 변경 파일 전부 명시
- [x] TypeScript 빌드 결과
- [x] API curl 검증 2건
- [x] Parser round-trip 검증
- [x] 허수 docs 제거 명시
- [x] UI 변경 (CreateAgentDialog + AgentSettingsForm + AgentEditor)

## 남은 작업
- 브라우저 실제 클릭 테스트 (사용자 수행 예정)

---

*긴급 수정 완료일: 2026-04-13*

---

# 추가 수정 — 루트 CLAUDE.md Rules 탭 노출 (2026-04-13)

## 문제
사용자가 프로젝트 루트에 `CLAUDE.md` 를 만들어도 앱의 Rules 탭 어디에도 표시되지 않음. 앱은 `.claude/rules/*.md` 만 스캔했고, Claude Code 공식 규약상 정식 프로젝트 메모리 파일인 루트 `CLAUDE.md` 는 UI 편집 경로가 없었음. 에이전트 `referenceFiles` 기본값이 `"CLAUDE.md"` 로 설정되어 있어 불일치가 혼란을 유발.

## 변경 사항
### API (`src/app/api/projects/[id]/rules/route.ts`)
- GET: 루트 `CLAUDE.md` 존재 시 `pinned: true` 항목으로 리스트 최상단에 prepend
- PUT: `name=CLAUDE.md` + `pinned=true` → 루트 파일에 쓰기, 아니면 기존 `.claude/rules/` 경로 유지
- POST: 루트 `CLAUDE.md` 중복 생성 시 409
- DELETE: 루트 `CLAUDE.md` 는 UI 삭제 금지 (403)
- `.claude/rules/CLAUDE.md` 와 루트 둘 다 있으면 console.warn

### UI (`src/components/editors/FileDirectoryEditor.tsx`)
- `FileEntry` 에 `pinned?: boolean` 필드 추가
- 파일 리스트 pinned 그룹(📌 "Project Memory" 서브헤더)과 일반 그룹 분리 렌더
- pinned 항목은 삭제 버튼 숨김 + 삭제 시도 시 한국어 안내
- PUT/DELETE 요청에 `pinned` 플래그 자동 전파

## 검증 증거
```bash
# GET — pinned 항목이 최상단에
$ curl .../api/projects/slU6UiJ0Gmptwv5j2htvt/rules
[{"name":"CLAUDE.md","content":"# 규칙\n- 증거 없이 답변 금지...","pinned":true}]

# PUT — 루트 파일이 실제로 갱신, .claude/rules/ 생성 안 됨
$ curl -X PUT .../rules -d '{"name":"CLAUDE.md","pinned":true,"content":"..."}'
{"name":"CLAUDE.md","content":"...","pinned":true}
$ ls /Users/min/Documents/test-ref-agent/.claude
ls: No such file or directory   ← rules 폴더 자동생성 안 됨 (정상)

# DELETE — pinned 거부
$ curl -X DELETE ".../rules?name=CLAUDE.md&pinned=true"
{"error":"Root CLAUDE.md cannot be deleted from the UI — it is the project memory file"}

# POST — 중복 거부
$ curl -X POST .../rules -d '{"name":"CLAUDE.md","pinned":true,"content":"dup"}'
{"error":"Root CLAUDE.md already exists"}
```

`npx tsc --noEmit` 통과.

## 파일 변경 목록
- 수정: `src/app/api/projects/[id]/rules/route.ts`
- 수정: `src/components/editors/FileDirectoryEditor.tsx`
- 수정: `docs/work-report.md`

