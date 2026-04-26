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

## [B-3] Settings JSON 모드 주석 지원 (medium)

### 배경
사용자 피드백(2026-04-16): "JSON에 주석들이 없네. 어떤게 어떤 코드인지 알 수가 없잖아?"

현재 Settings 탭 JSON 모드에서 순수 JSON만 표시됨. 각 필드가 무슨 역할인지 설명이 없어서 사용자가 설정값의 의미를 파악하기 어려움. 템플릿 상세 다이얼로그의 `settingsJson`에는 주석 달린 JSON이 있지만, 실제 편집기에는 반영 안 됨.

### 제안
- CodeMirror 에디터에 JSONC (JSON with Comments) 모드 적용 — 주석 허용
- 또는 각 설정 블록 옆에 인라인 설명 표시 (Form 모드 강화)
- 또는 JSON 필드 hover 시 툴팁으로 설명 표시

### 구현 범위 추정
- `JsonEditor` 컴포넌트에 JSONC 파서 적용 (CodeMirror lang-json → lang-json5 또는 커스텀)
- 저장 시 주석 strip 후 순수 JSON으로 디스크 쓰기
- 또는 Form 모드에 필드별 description 라벨 추가

### 착수 조건
- 시나리오 회귀 완료
- JSONC vs Form 강화 vs 툴팁 중 방향 결정 필요

---

## [B-4] 템플릿 선택 적용 + 적용 흔적 표시 (high)

### 배경
사용자 피드백(2026-04-16): "카드에 읽기만 허용 있잖아. 어떤 건 설정하고 어떤 건 설정 안 하게 가이드를 주고 체크를 해서 적용을 해야 하는데 지금처럼 일괄 처리하니 병신이 되는 거지"

현재 템플릿 Apply는 일괄 머지만 지원. 사용자가 항목별로 선택할 수 없고, 적용 후 어떤 템플릿에서 온 설정인지 표시 안 됨. 되돌리기도 전체 덮어쓰기밖에 없음.

### 제안
1. **Apply 다이얼로그에 항목별 체크리스트**: 템플릿 내 각 설정 블록을 체크박스로 표시, 사용자가 원하는 것만 선택 적용
2. **적용 이력 추적**: DB에 `template_applies` 테이블 추가 (projectId, templateId, appliedAt, appliedFields)
3. **Settings 페이지에 적용된 템플릿 표시**: 어떤 설정이 어떤 템플릿에서 왔는지 라벨/뱃지
4. **템플릿별 Undo**: 해당 템플릿이 추가한 블록만 선택적 제거

### 구현 범위
- `src/app/templates/page.tsx` — Apply 다이얼로그에 체크리스트 UI
- `src/lib/templates/merge.ts` — 선택된 필드만 머지하는 로직
- `src/lib/db/schema.ts` — template_applies 테이블
- `src/app/api/templates/[id]/apply/route.ts` — 선택 적용 + 이력 저장
- `src/app/projects/[id]/page.tsx` — Settings 탭에 적용 이력 표시

### 검증 항목
- [ ] 체크리스트에서 일부만 선택 → 선택한 것만 적용
- [ ] 적용 후 Settings에 템플릿 출처 표시
- [ ] Undo 클릭 → 해당 템플릿 블록만 제거

### 착수 조건
- 시나리오 회귀 완료
- B-3 (JSON 주석)과 통합 검토

---

## [B-5] 훅/룰/에이전트 생성 위자드 + 커스텀 템플릿 카드 등록 (high → 최우선)

### 배경
사용자 피드백(2026-04-16):
- "sh 파일 생성하면 빈 에디터만 있어서 bash 모르면 못 쓴다"
- "Hook Wiring이랑 .sh 파일이 따로 놀아서 사용자가 두번 작업해야 한다"
- "수동으로 만든 훅을 다른 프로젝트에서 재사용할 수 없다. 프로젝트마다 노가다해야 하냐?"

### 기능 1: 새 훅 만들기 위자드
수동 생성도 템플릿 카드처럼 한번에 완료되어야 함.

**흐름**:
1. [+ 새 훅 만들기] 클릭
2. 기능 선택: 린트 실행 / 위험 명령 차단 / 실행 로그 기록 / 커스텀
3. 이벤트 선택: PostToolUse, PreToolUse 등
4. 도구 선택: 체크박스 (Write, Edit, Bash 등)
5. 옵션 설정: 기능별 UI (확장자, 차단 명령어, 로그 경로 등)
6. [만들기] → .sh 파일(한글 주석 포함) + settings.json Wiring 한번에 생성

**생성되는 .sh 파일**: 각 섹션에 한글 주석으로 역할 설명 포함

### 기능 2: 커스텀 템플릿 카드 등록
수동 생성한 훅/룰/에이전트를 카드로 저장 → 다른 프로젝트에 재사용

**흐름**:
1. 수동으로 훅 생성 완료 (.sh + Wiring)
2. [내 템플릿으로 저장] 버튼 클릭
3. 카드 이름 / 설명 입력
4. Templates 페이지 "내 템플릿" 카테고리에 카드 등록
5. 다른 프로젝트에서 해당 카드 Apply → 한번에 적용

**적용 대상**: hooks, rules, agents 전부 동일

### 기능 3: 훅 삭제 연동
- .sh 파일 삭제 시 → "이 스크립트를 참조하는 Hook Wiring도 삭제하시겠습니까?" 확인

### 구현 범위
- `src/components/editors/HooksUnifiedEditor.tsx` — 위자드 다이얼로그
- `src/components/editors/FileDirectoryEditor.tsx` — hooks일 때 위자드 연결, 삭제 연동
- `src/lib/hooks-presets.ts` — 프리셋 목록 + 코드 생성 템플릿
- `src/lib/db/schema.ts` — custom_templates 테이블 (사용자 카드)
- `src/app/api/templates/custom/route.ts` — 커스텀 카드 CRUD API
- `src/app/templates/page.tsx` — "내 템플릿" 카테고리 표시

### 검증 항목
- [ ] 위자드로 훅 생성 → .sh + Wiring 한번에 완료
- [ ] 생성된 .sh에 한글 주석 포함
- [ ] 옵션 변경 시 코드 반영
- [ ] 커스텀 → 빈 에디터 + 기본 주석
- [ ] [내 템플릿으로 저장] → 카드 등록
- [ ] 다른 프로젝트에서 카드 Apply → 정상 적용
- [ ] .sh 삭제 시 Wiring 연동 삭제
- [ ] rules, agents도 커스텀 카드 등록 가능

### 착수 조건
- 시나리오 8~10 회귀 완료 ✅
- Hooks matcher 체크박스 수정 완료 ✅

---

## [B-6] deny 권한 설정 경고 + 복원 UX (medium)

### 배경
사용자 피드백(2026-04-16): 앱에서 permissions.deny에 Edit/Write/Bash를 설정하면 Claude가 수정 불가 상태가 되는데, 풀 방법을 사용자가 모름. "설정했으면 푸는 것도 편하게 만들어야지"

### 제안
1. deny 설정 시 경고 다이얼로그: "이 권한을 차단하면 Claude가 파일 수정을 할 수 없게 됩니다"
2. Settings 페이지에 "권한 리셋" 버튼
3. 위험한 deny 항목(Edit, Write, Bash) 설정 시 빨간색 경고 표시

### 구현 범위
- `src/components/settings-form.tsx` — deny 설정 경고 UI
- permissions 섹션에 리셋 버튼

### 착수 조건
- 시나리오 회귀 완료

---

## [B-7] 블라인드 리뷰 2차 nit 정리 (low)

### 배경
2026-04-22 블라인드 독립 리뷰 2차 (`f1897eb..a3b4013` 10 commits) 결과: **0 important + 3 nits + 1 pre-existing**. 모두 비차단. 백로그 이월.

### 항목

#### N-D5.1a: rules-sync/diff catch 세분화
- **위치**: `src/app/api/projects/[id]/worktrees/rules-sync/route.ts:97-100`, `rules-diff/route.ts:99-101`
- **이슈**: `execFileSync("git worktree list")` catch가 모든 에러를 통째로 묵살. ENOENT(git 없음), timeout, EACCES(.git 권한)을 구분 못 함. 정상 sibling worktree에서 git 일시 실패 시 silent 400 발생 가능.
- **개선**: `err.code` / `err.message` 로깅 추가 또는 narrow catch (`ENOENT` / `ENOTGIT` 만)
- **출처**: docs/planning/reviews/blind-review-2-findings (inline)

#### N-D5.1b: undo route DB transaction 부재
- **위치**: `src/app/api/templates/applied/[id]/undo/route.ts:87-119`
- **이슈**: `writeDiskWithSnapshot` + `unlinkExtraFiles` + `applied_templates.isActive` 플립이 transaction 밖. apply 라우트(`apply/route.ts:86`)는 transaction으로 감싸있어 비대칭. mid-sequence crash 시 `isActive=1` 인데 settings/files는 이미 제거된 상태 가능 → 다음 click에서 "Already undone" 류 실패.
- **개선**: `getDb().transaction(() => { ... })` 로 DB 쓰기 + isActive flip 묶기 (filesystem 작업은 outside).
- **출처**: 동일

#### N-commit-msg: 백로그 ID vs T-<id>.<n> 형식
- **이슈**: 이번 세션 모든 커밋이 `D-5.1`/`N-5`/`Q-1a`/`S-1` 같은 백로그 ID 사용. CLAUDE.md §"Commit 규율"은 `feat|fix|refactor(<scope>): T-<id>.<n> — <한 줄>` 형식 요구. REVIEW.md §"Always Check #6" 도 SPEC 참조 명시 요구.
- **개선**: 다음 sprint부터 `T-<sprint>-<n>` 형식으로 통일 (예: `T-F2.1` → 그대로 OK, `D-5.1` → `T-D5.1` 같은 prefix). 또는 CLAUDE.md를 현 관례에 맞춰 갱신.
- **결정 필요**: 사용자 선호 — 형식 강제 vs 관례 인정.

### 착수 조건
- 우선순위 낮음. P0/P1 없을 때 해결.

---

## [B-8] T-F2.4b 후속 — apply-to-all Step 2 mid-write rollback (low)

### 배경
T-F2.4b(`936131e`) + D-1(`4e3fc3a`)에서 `agent-header/apply-to-all` 2-pass dry-run + best-effort rollback 구현. EACCES(write permission denied)는 reverse-order rollback 작동 — md5 invariant로 검증 완료.

**남은 케이스**: Step 2 mid-write 중 EIO(I/O 오류) / ENOSPC(디스크 가득) 발생. 현재는 best-effort rollback 시도하지만 에러도 같은 디스크에 발생 가능 → rollback도 실패 → partial state 잔존.

### 제안
1. ENOSPC 감지 시 `rollbackFailed[]` 에 명시 + 대체 로그 위치 기록
2. EIO 발생 시 ALERT 후보 트리거 (관리자 개입 필요)
3. 또는 file lock 도입으로 mid-write 가능성 줄이기

### 구현 범위
- `src/app/api/projects/[id]/agent-header/apply/route.ts` — error.code 분기

### 착수 조건
- 실제 incident 관찰 시 우선순위 상향. 1인 + ssd 환경에서는 발생 가능성 낮음.
- 출처: docs/planning/scopes/approved-D-scope-20260420.md §D-1 후속

---

## [B-9] ESLint set-state-in-effect eslint-disable 23건 (low)

### 배경
prior 세션 worklog 기록(`docs/worklog/session-2026-04-19.md`): React 19 rule 도입으로 ESLint `set-state-in-effect` 위반 23건 발생. 임시로 `eslint-disable-next-line` 주석으로 모두 무시 처리.

### 제안
- 23건 각각 root cause 분석 후 적절한 패턴으로 리팩터:
  1. `useEffect` 안에서 set state → 종속 배열 정리 또는 `useReducer`
  2. 또는 `useSyncExternalStore` 로 이동
  3. 또는 의도된 패턴이면 `// rule-justification:` 주석으로 disable 사유 명시

### 구현 범위
- `src/app/**`, `src/components/**` — 파일별 1-2 hook 수정
- 23건 → 약 10-15 commit (1-2 파일 한도 준수)

### 착수 조건
- React 19 마이그레이션 안정화 후. 우선순위 낮음 (런타임 동작 영향 0).

---

## [B-10] `_probe.md` 등 outbox 흔적 정리 (manual cleanup)

### 배경
2026-04-20 권한 검증 중 생성된 `.claude/pipeline/outbox/_probe.md` (1줄 `probe\n`) 잔존. Implementer 세션에서는 `Bash(rm /Users/min/Documents/claude-agent/.claude/pipeline/outbox/*)` deny rule로 직접 삭제 불가.

### 제안
- 사용자 직접 `rm` 또는 의미 있는 내용으로 덮어쓰기 (문제 없는 stub)

### 착수 조건
- 사용자 직접 처리. Subagent 위임 불가 (deny rule).

---

## [B-11] `.claude/prompts/{implementer,reviewer}.md` deprecation (low)

### 배경
S-2 sprint(2026-04-26)에서 `.claude/agents/*.md` 도입. `.claude/prompts/`의 implementer/reviewer.md (multi-session 전제 prompt 파일)는 새 모델에서 중복.

### 제안
- 단계 1 (이번 sprint S-2): prompts 파일에 `<!-- DEPRECATED — see .claude/agents/<name>.md -->` 헤더 추가 (deny rule이라 사용자 또는 worktree-bypass agent 필요)
- 단계 2 (별 sprint): 실제 삭제

### 착수 조건
- agents/ 5개 정의 안정 검증 후 (S-2 마지막 단계 또는 S-3)

---

## [B-12] D-5.3 nested checklist feature (medium)

### 배경
D-5 investigation(`investigation-D-5-20260420.md`)에서 C-3 "Detail Dialog 체크리스트 regression"이 **regression이 아닌 feature gap**으로 재분류됨. 현 체크리스트는 top-level key per-row만 표시. 사용자가 기대한 nested checkbox(예: `hooks.PreToolUse[i]`, `permissions.allow[i]`) 는 미구현.

### 제안
- Settings tree를 재귀적으로 탐색해서 nested object/array의 각 leaf node를 별도 checkbox로 렌더
- 사용자가 특정 hook이나 특정 permission을 선택적으로 apply / exclude 가능

### 구현 범위
- `src/app/templates/page.tsx` — 체크리스트 컴포넌트 재구성 (3+ 파일 가능 → 분할)
- `src/app/api/templates/[id]/apply/route.ts` — `excludeNestedPaths` 파라미터 추가

### 착수 조건
- SPEC 작성 후 (현재 형식 미정). 사용자 합의 필요.
- 출처: docs/planning/investigations/investigation-D-5-20260420.md §C-3 / E-1

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
