# 파일 관리 이원화 통일 기획서 (Matrix Plan)

*작성일: 2026-04-14 · 상태: **사용자 승인 대기** · 구현 전 필독*

---

## 0. 목적

Claude Code Settings Manager 앱이 "같은 디스크 파일"을 두 가지 방식(DB 테이블 경유 vs 디스크 직접)으로 관리하는 구조를 **디스크 단일 소스 오브 트루스(single source of truth)** 로 통일한다.

이원화가 실제로 만든 증상:
- 사용자가 디스크에 `CLAUDE.md`를 만들어도 **CLAUDE.md 탭**엔 안 보이고 **Rules 탭**엔 pinned 로만 보임
- Settings 탭은 DB에 저장되고, 저장 후에도 "Export to disk" 버튼을 별도로 눌러야 실제 `.claude/settings.json` 에 반영됨
- 반대로 디스크에서 외부 편집기로 바꾼 내용은 "Import from disk" 수동 클릭 없이는 UI 에 안 들어옴
- 이원화를 이해하지 못한 반복 버그 → 반창고 수정 → 재발 → "다시 만들까" 고민까지 왔음

---

## 1. 현재 상태 전수조사 매트릭스

### 1-1. 데이터 계열 (Data Layer)

| 계열 | 저장소 | 책임 테이블/디렉토리 | 사용하는 탭 |
|---|---|---|---|
| **A. DB · files 테이블** | SQLite | `files`, `file_versions` | CLAUDE.md 탭 |
| **B. DB · settings 테이블** | SQLite | `settings` (+ upsert per scope) | Settings 탭, Overview |
| **C. 디스크 직접** | 파일시스템 | `.claude/rules/`, `.claude/agents/`, `.claude/hooks/`, root 메모리 3종 | Rules 탭, Agents 탭, Hooks 탭 |
| **D. Import/Export 브리지** | 양쪽 | A·B 와 C 사이 수동 동기화 | 각 탭의 Import/Export 버튼 |

### 1-2. 파일 × 현재 저장소 매트릭스

| 디스크 파일 | 탭 | 읽기/쓰기 경로 | 저장소 | 실시간 동기화 | 현재 상태 |
|---|---|---|---|---|---|
| `~/.claude/settings.json` | Global Settings | `/api/settings?scope=global` | **B (settings 테이블)** | ❌ | Import/Export 수동 |
| `~/.claude/settings.local.json` | User Settings | `/api/settings?scope=user` | **B** | ❌ | Import/Export 수동 |
| `<proj>/.claude/settings.json` | Settings 탭 (project) | `/api/projects/[id]/settings?scope=project` | **B** | ❌ | Import/Export 수동 |
| `<proj>/.claude/settings.local.json` | Settings 탭 (local) | `/api/projects/[id]/settings?scope=local` | **B** | ❌ | Import/Export 수동 |
| `~/.claude/CLAUDE.md` | CLAUDE.md 탭 (global/user) | `/api/projects/[id]/files?type=claude-md&scope=user` | **A (files 테이블)** | ❌ | Import/Export 수동 |
| `<proj>/CLAUDE.md` | CLAUDE.md 탭 (project) | `/api/projects/[id]/files?type=claude-md&scope=project` | **A** | ❌ | Import/Export 수동 |
| `<proj>/CLAUDE.md` ⚠️ 동일 파일 | **Rules 탭** (pinned root) | `/api/projects/[id]/rules` GET/PUT | **C (디스크)** | ✅ chokidar+SSE | — |
| `<proj>/.claude/CLAUDE.md` | **Rules 탭** (pinned claude-dir) | `/api/projects/[id]/rules` | **C** | ✅ | — |
| `<proj>/CLAUDE.local.md` | CLAUDE.md 탭 (local) | `/api/projects/[id]/files?type=claude-md&scope=local` | **A** | ❌ | Import/Export 수동 |
| `<proj>/CLAUDE.local.md` ⚠️ 동일 파일 | **Rules 탭** (pinned local) | `/api/projects/[id]/rules` | **C** | ✅ | — |
| `<proj>/.claude/rules/*.md` | Rules 탭 | `/api/projects/[id]/rules` | **C** | ✅ | 완료 |
| `<proj>/.claude/agents/*.md` | Agents 탭 | `/api/projects/[id]/agents` | **C** | ✅ | 완료 |
| `<proj>/.claude/hooks/*.sh` | Hooks 탭 (좌) | `/api/projects/[id]/hooks` | **C** | ✅ | 완료 |
| `<proj>/.claude/settings.json` (`hooks` 필드) | Hooks 탭 (우) | `/api/projects/[id]/settings` | **B** | ❌ | Hooks wiring 은 DB 경유 |

### 1-3. 중복/충돌 지점

🔥 **`CLAUDE.md` 는 CLAUDE.md 탭(DB)과 Rules 탭(디스크)에 동시 존재** — 두 탭이 다른 내용을 보여줄 수 있음. 사용자 보고 증상의 핵심.

🔥 **`CLAUDE.local.md` 도 동일** — CLAUDE.md 탭 Local 스코프(DB) vs Rules 탭 pinned local(디스크).

🔥 **`settings.json` 의 `hooks` 필드 편집이 2곳에서 가능** — Settings 탭의 HookSection(DB) + Hooks 탭의 Wiring 패널(PUT /settings 경유이긴 하지만 동일 DB 레코드). 같은 필드에 대한 두 편집 UI.

---

## 2. API 엔드포인트 계열별 분류

### 계열 A — DB `files` 테이블 직접 CRUD
| Method | Path | 비고 |
|---|---|---|
| GET | `/api/projects/[id]/files?type=...&scope=...` | files 테이블 raw 조회 |
| POST | `/api/projects/[id]/files` | files 레코드 생성 |
| GET | `/api/projects/[id]/files/[fileId]` | 단일 조회 |
| PUT | `/api/projects/[id]/files/[fileId]` | 자동 버전 스냅샷 후 업데이트 |
| DELETE | `/api/projects/[id]/files/[fileId]` | 버전 cascade 삭제 |
| GET | `/api/projects/[id]/files/[fileId]/versions` | 버전 히스토리 |

### 계열 B — DB `settings` 테이블 직접 CRUD
| Method | Path | 비고 |
|---|---|---|
| GET/PUT | `/api/settings?scope=global\|user` | 글로벌/유저 settings |
| GET/PUT | `/api/projects/[id]/settings?scope=project\|local` | 프로젝트 settings |
| GET | `/api/projects/[id]/settings/merged` | 4스코프 병합 (읽기 전용) |

### 계열 C — 디스크 직접
| Method | Path | 비고 |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/projects/[id]/rules` | `.claude/rules/*.md` + pinned CLAUDE.md 3종 |
| GET/POST/PUT/DELETE | `/api/projects/[id]/agents` | `.claude/agents/*.md` |
| GET/POST/PUT/DELETE | `/api/projects/[id]/hooks` | `.claude/hooks/*.sh` |
| GET (SSE) | `/api/projects/[id]/events` | chokidar 기반 실시간 푸시 |

### 계열 D — 브리지 (Import/Export)
| Method | Path | 비고 |
|---|---|---|
| POST | `/api/settings/import?scope=global\|user` | 디스크 → DB |
| POST | `/api/settings/export?scope=global\|user` | DB → 디스크 |
| POST | `/api/projects/[id]/import-settings?scope=...` | 디스크 → DB |
| POST | `/api/projects/[id]/export?scope=...` | DB → 디스크 |
| POST | `/api/projects/[id]/import-claudemd?scope=...` | 디스크 → DB |
| POST | `/api/projects/[id]/export-claudemd?scope=...` | DB → 디스크 |
| POST | `/api/projects/[id]/import` | 대량 detect + import |

### 계열 C+ (fs-watcher 분류)
`src/lib/fs-watcher/index.ts::classifyPath()` 가 이미 다루는 종류:
- `rules` / `agents` / `hooks` / `settings` — 마지막 항목(`settings`)은 **이벤트는 발행되지만 구독자가 없음** (Settings 탭은 계열 B 라서 SSE 를 듣지 않음). 이번 통일로 연결 가능.

---

## 3. 목표 상태 (To-Be)

### 원칙
1. **디스크가 유일한 소스** — 앱이 관리하는 모든 Claude Code 설정 파일은 디스크에서 읽고 디스크에 쓴다
2. **SQLite 는 파생 데이터 전용** — 버전 히스토리 (`file_versions`), 프로젝트 메타데이터 (`projects`) 외에는 운영 데이터 저장 안 함
3. **Import/Export 개념 제거** — 모든 저장이 곧 디스크 반영. 별도 동기화 버튼 없음
4. **chokidar+SSE 전면 적용** — 모든 탭이 외부 변경을 실시간 반영
5. **병합(merged) 로직은 디스크 읽기 기반** — `GET /settings/merged` 가 DB 4개 레코드 대신 디스크 4개 파일을 읽어 병합

### 목표 파일 × 저장소 매트릭스

| 디스크 파일 | 탭 | 경로 | 저장소 | 실시간 |
|---|---|---|---|---|
| `~/.claude/settings.json` | Global Settings | `/api/settings?scope=global` (디스크 read/write) | 디스크 | ✅ |
| `~/.claude/settings.local.json` | User Settings | `/api/settings?scope=user` | 디스크 | ✅ |
| `<proj>/.claude/settings.json` | Settings 탭 (project) | `/api/projects/[id]/settings?scope=project` | 디스크 | ✅ |
| `<proj>/.claude/settings.local.json` | Settings 탭 (local) | `/api/projects/[id]/settings?scope=local` | 디스크 | ✅ |
| `<proj>/CLAUDE.md` | **CLAUDE.md 탭과 Rules 탭이 같은 내용을 보임** (단일 저장소) | 디스크 | 디스크 | ✅ |
| `<proj>/.claude/CLAUDE.md` | 동일 | 디스크 | ✅ |
| `<proj>/CLAUDE.local.md` | 동일 | 디스크 | ✅ |

**CLAUDE.md 탭의 역할 재정의**: User/Project/Local 3개 스코프에서 각각의 CLAUDE.md 파일을 디스크 직접 편집. Rules 탭의 pinned 영역과 기능 중복되지만, CLAUDE.md 전용 에디터가 버전 히스토리 + 스코프 전환 UX 면에서 Rules 탭보다 낫기 때문에 유지. 두 탭이 같은 파일을 가리키고 한 쪽에서 저장하면 다른 쪽이 SSE 로 즉시 갱신.

*(대안: CLAUDE.md 탭을 제거하고 Rules 탭으로 흡수 — 더 단순하지만 버전 히스토리 UI 손실. 이건 3장 끝 "열린 질문" 에서 다룸)*

### 버전 히스토리 재정의
- `file_versions` 테이블은 유지
- 스냅샷 트리거: 디스크 쓰기 직전에 기존 디스크 내용을 읽어 `file_versions` 에 삽입
- 레코드 키: `projectId + 절대경로` (기존 `fileId` → 경로 기반으로 변경, 또는 `files` 테이블 자체를 "추적 대상 파일 인덱스" 로 재정의)

### 제거/폐기 대상
- `files` 테이블의 **content 컬럼 운영 데이터로서의 역할** (버전 히스토리의 seed 로는 잔존 가능)
- `settings` 테이블 전체 또는 **config 컬럼 운영 데이터로서의 역할**
- `/api/projects/[id]/files` 와 `/api/projects/[id]/files/[fileId]` POST/PUT/DELETE (GET 은 버전 탐색용으로 변형 가능)
- 모든 Import/Export 라우트 및 UI 버튼
- `ImportModal` 컴포넌트

---

## 4. 마이그레이션 단계 (Phase)

### Phase 0 — 기획 승인 (현재 단계)
- [ ] 사용자가 본 문서를 검토하고 "디스크 단일 소스" 방향 승인
- [ ] CLAUDE.md 탭 유지 vs Rules 탭 흡수 결정 (아래 "열린 질문" 참조)
- [ ] 버전 히스토리 구현 상세(fileId vs path 키) 결정

### Phase 1 — 백엔드: Settings 디스크 전환
- `src/lib/file-io/index.ts` 에 `readSettings(scope, projectPath)` / `writeSettings(scope, projectPath, config)` 추가
- `/api/settings` GET/PUT 재작성 — DB 대신 디스크 read/write + JSON 검증
- `/api/projects/[id]/settings` GET/PUT 재작성 — 동일
- `/api/projects/[id]/settings/merged` 재작성 — 디스크 4개 파일 읽어 병합
- `fs-watcher` 의 `settings` 종류 이벤트를 `settings` 탭 쪽 훅에 연결
- `src/hooks/use-project-events.ts` 확장 (global/user 스코프 대응 필요 — 프로젝트 독립 watcher 아닐 수 있음 → 별도 global watcher 필요할 수 있음)
- `curl` + `tsc` 검증

### Phase 2 — 백엔드: CLAUDE.md 디스크 전환
- `/api/projects/[id]/files?type=claude-md&scope=...` 를 디스크 read/write 로 변경 OR 새 라우트 `/api/projects/[id]/claude-md?scope=...` 신설 후 구 라우트는 정리
- global/user CLAUDE.md 경로 확인: `~/.claude/CLAUDE.md`, `~/.claude/CLAUDE.local.md` — 앱이 global/user 스코프 CLAUDE.md 를 어디서 가져올지 통일
- 버전 히스토리: 디스크 write 전 snapshot 을 `file_versions` 에 insert. 키는 `projectId + scope + type` (또는 상대경로)
- Rules 탭 pinned CLAUDE.md 와 CLAUDE.md 탭이 같은 파일을 읽음 — SSE 로 상호 갱신 확인

### Phase 3 — 프론트엔드 통합
- `ClaudeMdEditor` 를 새 API 로 마이그레이션, Import/Export 버튼 제거
- `SettingsPage` / `SettingsForm` 의 Import/Export 버튼 제거, `useProjectEvents` 연결
- `ImportModal` 삭제, Overview 탭의 "Import from disk" 제거 (프로젝트 생성 직후 자동으로 디스크 기준이 됨)

### Phase 4 — DB 정리 & 마이그레이션
- 기존 `files` / `settings` 테이블의 content/config 열은 **그대로 두되 더 이상 읽지 않음** (rollback 여지)
- 새 테이블 `tracked_files` (id, projectId, relativePath, type, createdAt) — 버전 히스토리 FK 앵커
- `file_versions.fileId` → `file_versions.trackedFileId` 로 이관
- drizzle 마이그레이션 스크립트 작성

### Phase 5 — 테스터 검증
- 구조화된 테스트 시나리오(아래 "수락 기준") 전부 통과
- 증거: curl / tsc / 브라우저 실제 클릭 / CLI 실제 파일 생성·삭제 4가지 전부
- 작업내역서(`docs/work-report.md`) 업데이트 — CLAUDE.md 의 15개 항목 체크리스트 전부

---

## 5. 영향 받는 파일 목록

### 수정 (확실)
- `src/lib/file-io/index.ts` — 함수 추가
- `src/lib/fs-watcher/index.ts` — settings 종류 구독 경로 확장 / global watcher
- `src/lib/db/schema.ts` — `tracked_files` 신설, files/settings 컬럼 사용 중단
- `src/app/api/settings/route.ts`
- `src/app/api/projects/[id]/settings/route.ts`
- `src/app/api/projects/[id]/settings/merged/route.ts`
- `src/app/api/projects/[id]/files/route.ts` — GET 만 남기거나 deprecated 처리
- `src/app/api/projects/[id]/files/[fileId]/route.ts` — 동일
- `src/app/api/projects/[id]/files/[fileId]/versions/route.ts` — 키 재정의
- `src/components/editors/ClaudeMdEditor.tsx` — API 마이그레이션
- `src/components/settings-form.tsx` — Import/Export 제거
- `src/components/settings-page.tsx` — 동일
- `src/app/projects/[id]/page.tsx` — Overview Import 제거, 탭 간 동기화 연결
- `src/hooks/use-project-events.ts` — global 스코프 수용 여부

### 신규 (예상)
- `src/app/api/projects/[id]/claude-md/route.ts` (또는 기존 files 경로 재사용)
- drizzle 마이그레이션 파일 1개

### 삭제 (예상)
- `src/app/api/settings/import/route.ts`
- `src/app/api/settings/export/route.ts`
- `src/app/api/projects/[id]/import-settings/route.ts`
- `src/app/api/projects/[id]/export/route.ts`
- `src/app/api/projects/[id]/import-claudemd/route.ts`
- `src/app/api/projects/[id]/export-claudemd/route.ts`
- `src/app/api/projects/[id]/import/route.ts` (대량 import)
- `src/components/project/ImportModal.tsx`

---

## 6. 리스크 & 대응

| 리스크 | 가능성 | 영향 | 대응 |
|---|---|---|---|
| DB 에만 있고 디스크에 없는 기존 사용자 데이터 유실 | 중 | 높음 | Phase 0 마이그레이션 스크립트: 기존 files/settings 레코드를 디스크로 일괄 Export 한 후 전환 시작 |
| global/user 스코프 watcher 가 프로젝트 단위 구조와 안 맞음 | 중 | 중 | 별도 글로벌 watcher 또는 SSE 엔드포인트 추가 (`/api/events/global`) |
| 버전 히스토리 키 변경으로 기존 히스토리 접근 불가 | 낮 | 중 | 마이그레이션에서 `fileId → trackedFileId` 매핑 수행 |
| Hooks 탭 wiring 이 settings.json 에 저장되는 경로가 변경되면 기존 wiring 깨짐 | 낮 | 중 | settings write 경로만 디스크로 바뀌고 JSON 구조는 동일 → 무영향 예상. curl 회귀 테스트로 확인 |
| 브라우저 fetch 캐시 / React state 가 SSE 이벤트와 경합 | 중 | 낮 | 기존 FileDirectoryEditor 의 `hasChanges` 보존 패턴을 새 컴포넌트에도 동일 적용 |
| 본 통일 작업 중 기존 기능 회귀 | 중 | 높음 | 전수 curl 테스트 스위트 먼저 작성 → 전환 → 회귀 없음 확인 |

---

## 7. 수락 기준 (Phase 5 에서 검증)

디스크에서 파일을 만들었을 때 모든 탭이 자동으로 보여줘야 한다:
- [ ] CLI 에서 `<proj>/CLAUDE.md` 생성 → CLAUDE.md 탭(Project) + Rules 탭(pinned root) 동시에 <1초 내 표시
- [ ] CLI 에서 `<proj>/.claude/settings.json` 수정 → Settings 탭(project) 즉시 반영
- [ ] CLI 에서 `<proj>/.claude/rules/foo.md` 생성 → Rules 탭 즉시 표시 (기존 동작 유지 회귀 확인)
- [ ] UI 에서 CLAUDE.md 탭 저장 → 디스크 파일 즉시 반영, Rules 탭 pinned 도 갱신
- [ ] UI 에서 Settings 탭 저장 → 디스크 `.claude/settings.json` 즉시 반영, "Export to disk" 버튼 없음
- [ ] UI 어디에도 Import/Export 버튼 없음
- [ ] 버전 히스토리: CLAUDE.md 탭에서 저장 → 이전 버전이 히스토리에 표시 → 복원 동작
- [ ] Merged settings 미리보기: 디스크 4파일 기준으로 정확히 병합
- [ ] `npx tsc --noEmit` 무출력
- [ ] `curl` 으로 모든 계열 C 엔드포인트 GET/POST/PUT/DELETE 회귀 통과
- [ ] 브라우저 E2E: 6개 탭 모두 저장/삭제/스코프 전환 정상

---

## 8. 열린 질문 (사용자 판단 필요)

1. **CLAUDE.md 탭을 유지할지, Rules 탭으로 흡수할지?**
   - 유지(안 A): 버전 히스토리 UX 와 스코프 전환 UI 유지. 단 Rules 탭과 보여주는 파일이 일부 겹침
   - 흡수(안 B): 단순한 IA. 단 버전 히스토리 기능을 Rules 탭에 이식해야 함

2. **global/user 스코프 CLAUDE.md 를 앱에서 계속 보여줄지?**
   - 현재는 files 테이블에 scope=user 로 저장하는데 실제 파일은 `~/.claude/CLAUDE.md` / `~/.claude/CLAUDE.local.md`. 프로젝트 독립적이므로 Global Settings 페이지 같은 전용 화면이 더 맞을 수 있음

3. **Hooks 탭 wiring 편집이 Settings 탭 HookSection 과 중복** — 이건 이원화와 별개 이슈지만 같은 시즌에 정리할지, 다음 이터레이션으로 미룰지?

4. **마이그레이션 시점에 기존 DB 데이터와 디스크가 불일치할 때 어느 쪽 우선?**
   - 권장: 디스크 우선(디스크가 있으면 디스크, 없으면 DB 내용을 디스크로 export 후 DB 비움)

---

## 9. 승인 이후 실행 프로토콜

1. 사용자가 8장 열린 질문에 답변 → 이 문서 업데이트
2. Phase 1 부터 순차 실행, 각 Phase 완료 시 증거와 함께 보고
3. 전 Phase 완료 후 `docs/work-report.md` 에 이번 작업 구간 전체 추가 (15개 필수 항목)
4. 완료 선언 직전 테스터 단계 → 수락 기준 체크리스트 전부 ✅ 확인 후 커밋

---

*본 기획서는 `project_file_management_duality.md` 메모리 + `feedback_workflow_matrix.md` 메모리 + 직전 세션 실패 원인 분석을 근거로 작성됨.*
