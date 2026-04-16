# 백로그 (Backlog)

디스크 직접 일원화 12단계 리팩토링 이후 남은 개선 작업들을 기록합니다.
우선순위는 시나리오 회귀 완료 + 커밋 후 재검토.

---

## [B-1] User Settings 페이지 탭 구조 확장 (high)

### 배경
현재 `/settings/user` 페이지는 `settings.json` 편집만 지원. 그러나 `~/.claude/` 디렉토리에는 모든 Claude 세션에 자동 적용되는 여러 자원이 존재하며, 이들을 한 UI 에서 관리할 수 없음.

사용자 피드백(2026-04-15): "claude.md 는 글로벌만 적용되는건가? 그리고 hooks 도 필요해. 모든 클로드를 기본적으로 적용받자나."

### Claude Code 실제 스코프 모델 (확정 사실)

| 앱에서 부르는 이름 | 실제 파일 | Claude Code 적용 범위 |
|---|---|---|
| **Global** | `~/.claude/managed-settings.json` | 기업/관리자 정책용. settings.json 형식만. 모든 세션 최우선 적용. |
| **User** | `~/.claude/` 디렉토리 전체 | 개인 사용자의 모든 세션에 공통 적용되는 자원 허브. |

#### User 레벨에서 실제로 존재하는 자원
| 파일/디렉토리 | 역할 | 적용 조건 |
|---|---|---|
| `~/.claude/settings.json` | 개인 settings | 자동 |
| `~/.claude/CLAUDE.md` | User 메모리 — 모든 프로젝트 세션에 자동 합쳐짐 | 자동 |
| `~/.claude/agents/*.md` | User 에이전트 — 모든 프로젝트에서 호출 가능 (Claude Code 네이티브) | 자동 (호출 시) |
| `~/.claude/hooks/*.sh` | User hook 스크립트 파일 | settings.json `hooks` 필드에서 참조된 경우만 |
| `~/.claude/rules/*.md` | **네이티브 기능 아님**. 앱 컨벤션 — `~/.claude/CLAUDE.md` 에서 `@rules/foo.md` 로 @-import 되어야 적용 | 참조된 경우만 |

#### Global (managed-settings.json) 가 가질 수 있는 것
- ✅ settings.json 형식 키 (model, systemPrompt, hooks config, mcpServers 등)
- ❌ CLAUDE.md (managed 버전 개념 없음)
- ❌ agents (managed 버전 개념 없음)
- ❌ hook 스크립트 파일 (managed config 는 가능, 스크립트 파일은 user 디렉토리에 의존)
- ❌ rules (해당 없음)

→ **Global 페이지는 현재 그대로 settings editor 만으로 충분**. 확장 불필요.

### 제안 구조

**Global 페이지** (`/settings/global`):
- 변경 없음. 현재 `SettingsPage scope="global"` 그대로.

**User 페이지** (`/settings/user`):
프로젝트 페이지와 동일한 탭 구조. 단 "local" 스코프는 없음 (user 에는 local 개념 없음).

```
┌─ User Settings ─────────────────────────────────────┐
│ [Overview] [CLAUDE.md] [Settings] [Agents] [Hooks]  │ ← 탭
│─────────────────────────────────────────────────────│
│                                                     │
│  (선택된 탭 내용)                                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### 탭별 설계

1. **Overview** — `~/.claude/` 디렉토리 파일 스캔 결과 리스트 (ScannedFile 형태). `src/lib/disk-files/index.ts` 의 `scanProjectFiles` 와 유사한 `scanHomeFiles()` 추가 필요.

2. **CLAUDE.md** — `~/.claude/CLAUDE.md` 편집. 기존 `ClaudeMdEditor` 재사용 가능하지만 현재 project 전용(`projectId` 필수) → 분리 또는 prop 확장. Version history 는 이미 home scope 지원 (`projectId={null}`, relativePath `~/.claude/CLAUDE.md`).

3. **Settings** — 현재 `SettingsPage scope="user"` 의 내용. 상위 페이지를 탭으로 바꾸면서 이 탭 안으로 이동.

4. **Agents** — `~/.claude/agents/*.md` 관리. 기존 `FileDirectoryEditor` 재사용. 현재 project 전용(`apiBase = /api/projects/${projectId}/agents`) → home scope 엔드포인트 신설 필요 (`/api/user/agents`).

5. **Hooks** — 두 부분:
   - **스크립트 파일** — `~/.claude/hooks/*.sh`. FileDirectoryEditor 재사용 (home scope 엔드포인트 신설).
   - **Config** — `~/.claude/settings.json` 의 `hooks` 필드. `HooksUnifiedEditor` 가 project 전용이라 home scope 지원 확장 필요.

### Rules 탭 — 결정 보류
- Claude Code 네이티브 기능이 아니라 `~/.claude/CLAUDE.md` 가 명시적으로 `@rules/foo.md` 참조를 넣어야 작동
- 있으면 user 레벨 CLAUDE.md 가 커질 때 파편화 관리 편의
- 없어도 User CLAUDE.md 에 다 직접 쓰면 됨
- **결정 필요**: 포함 / 제외

### Agents 탭 — 결정 보류
- 네이티브 기능 (O)
- 사용자 반응(2026-04-15): "에이전트는 필요없지"
- 하지만 기능 자체는 유효 — 제거보다는 사용자가 안 쓰면 그만
- **결정 필요**: 포함 / 제외

### 구현 작업 범위

#### 신규 API 라우트 (home scope)
- `GET/PUT /api/user/claudemd` — user CLAUDE.md CRUD (이미 있으면 확인)
- `GET/POST /api/user/agents` + `GET/PUT/DELETE /api/user/agents/[name]` — agents CRUD
- `GET/POST /api/user/hooks` + `GET/PUT/DELETE /api/user/hooks/[name]` — hook 스크립트 파일 CRUD
- `GET /api/user/overview` — home 파일 스캔 결과

#### 신규 lib 함수
- `scanHomeFiles()` in `src/lib/disk-files/index.ts`

#### 기존 컴포넌트 확장
- `ClaudeMdEditor` — home scope 지원 (현재는 project 전용)
  - 옵션 A: `projectId?: string` + `homeScope?: boolean` prop 추가
  - 옵션 B: `ClaudeMdEditorHome` 별도 컴포넌트 분리
  - **선호**: A (코드 중복 방지, 복원 시 `projectId={null}` 로직 이미 VersionHistory 에 있음)
- `FileDirectoryEditor` — home scope 지원 (apiBase prop 추상화)
- `HooksUnifiedEditor` — home scope 지원

#### 라우팅
- `/settings/user/page.tsx` 를 현재의 단일 `SettingsPage` → `UserDetailPage` 탭 구조로 교체
- `SettingsPage` 컴포넌트는 내부 "Settings 탭" 용으로 축소 또는 그대로 두고 래핑

#### fs-watcher
- 이미 `HomeWatchKind = "user-settings" | "user-claudemd"` 지원 중
- 추가 필요: `"user-agents"`, `"user-hooks"` (또는 일반화된 `"user-*"`)
- `~/.claude/agents/` 와 `~/.claude/hooks/` 디렉토리를 chokidar watch 대상에 추가

#### SSE
- `useHomeEvents` 훅이 이미 존재. 추가 kind 만 핸들링하면 됨.

### 검증 항목
- [ ] User CLAUDE.md 생성/편집/저장/버전 히스토리/외부 변경 SSE 반영
- [ ] User agents 생성/편집/저장/삭제/SSE 반영
- [ ] User hooks 스크립트 생성/편집/저장/삭제/SSE 반영
- [ ] User hooks config 와 스크립트 파일 연동 (settings.json hooks 필드에서 스크립트 경로 참조)
- [ ] Global 페이지는 변경 없음 확인
- [ ] project 페이지는 변경 없음 확인

### 예상 임팩트
- 신규 API 파일: ~6개
- 수정 컴포넌트: 3개 (ClaudeMdEditor, FileDirectoryEditor, HooksUnifiedEditor) — home scope prop 추가
- 신규 페이지 구조: `/settings/user` 탭 레이아웃
- fs-watcher 확장: home watcher 에 agents/hooks 디렉토리 추가
- DB 스키마 변경 없음 (file_versions 이미 home scope `projectId=NULL` 지원)

### 착수 조건
- 디스크 직접 일원화 시나리오 1~10 전부 PASS
- Step 7~12 커밋 완료
- 작업내역서 (work-report.md) 업데이트 완료
- Agents 탭 / Rules 탭 포함 여부 사용자 결정 수령

---

---

## [B-2] 클릭 기반 파일 추가 UI 통일 (medium)

### 배경
사용자 피드백(2026-04-15): "Hooks 탭에는 예시가 있어서 편하고, 클릭으로 추가하는 방식이 좋다. 여러 개를 쉽게 추가할 수 있어서 다른 곳도 이렇게 되었으면 좋겠다. 등록하는 곳을 따로 빼면 손쉽게 추가할 수 있을 것 같다."

### 현재 상태
- **Hooks 탭**: `HooksUnifiedEditor` — 우측에 "Hook Wiring" 영역이 있고 이벤트별(PreToolUse/PostToolUse/SessionStart 등)로 `+ Rule` 버튼 클릭만으로 항목 추가. 예시/템플릿이 시각적으로 나열돼서 빠르게 여러 개를 꽂을 수 있음.
- **Rules / Agents 탭**: `FileDirectoryEditor` — 좌측에 `New` 버튼을 누르고 다이얼로그에서 파일명 입력 후 Create. 한 개씩 수동 생성만 가능.

### 제안
Rules / Agents 탭에도 "예시 리스트 + 클릭 추가" 패턴 도입. 예를 들어:
- **Rules** — 공통 규칙 템플릿 카탈로그 (ex: "Mandatory Rules", "No Speculation", "Output Format") 를 리스트로 보여주고 `+ 추가` 클릭 시 해당 템플릿이 `.claude/rules/` 에 파일로 생성
- **Agents** — 자주 쓰는 서브 에이전트 프리셋 (ex: "Code Reviewer", "Test Writer", "Refactorer") 를 리스트로 보여주고 `+ 추가` 클릭 시 `.claude/agents/` 에 생성

"등록하는 곳을 따로 빼라" = 카탈로그 패널과 편집 패널을 시각적으로 분리 (Hook Wiring 구조와 유사).

### 구현 범위 추정
- 새 컴포넌트: `RuleCatalog`, `AgentCatalog` (또는 공통 `FileCatalogPanel`)
- 템플릿 카탈로그 데이터: `src/lib/templates/` 쪽에 rule/agent presets 파일 추가
- `FileDirectoryEditor` 수정 또는 상위에서 카탈로그 패널과 병렬 배치
- 템플릿 클릭 시 파일명 충돌 처리, 미리보기 옵션 등 UX 결정 필요

### 착수 조건
- 시나리오 회귀 1~10 완료
- B-1 (User 페이지 탭 구조) 과 통합 여부 결정 — User/Global 페이지에도 적용할지
- 템플릿 카탈로그 항목을 누가 관리할지 (코드 내장 vs 사용자 정의 vs claude-agent 프로젝트 공통)

---

## 작업 추가 템플릿

```markdown
## [B-N] 제목 (priority)

### 배경
왜 이 작업이 필요한가, 사용자 요청 인용

### 제안 구조
설계 요약

### 구현 범위
건드리는 파일/API/컴포넌트 목록

### 검증 항목
- [ ] 체크리스트

### 착수 조건
선행 작업
```
