---
task: Q (Quality Sprint — 회귀 테스트 커밋, Q-1 ~ Q-5)
decision: APPROVED
scope_ref: .claude/pipeline/inbox/question-Q-scope-20260420.md
answers:
  Q1_split: "YES with amendment — Q-1/Q-2/Q-3/Q-4 split 채택. 단 Q-1 Implementer 제안 (pure-function 단위)은 source export 변경 (+3rd file) 위험. Route-handler invocation 패턴 OR 최소 export 추가 중 택1 (아래 §3 Q-1 기준)."
  Q2_dev_server_skip: "YES — beforeAll에서 fetch probe (timeout 1500ms) 실패 시 test.skipIf 또는 describe.skip + console.warn. CI(미도입)가 추후 dev server 기동 시 자동 활성화되도록 skip 로직은 condition-based (not hardcoded)."
  Q3_hook_tracking: "NO additional tracker file. e2e-scenarios.sh 자체가 유일 소스. CHANGELOG.md 신설은 scope creep. Q-5 commit 메시지에 추가 시나리오 이름 (S5/S6) 명시로 충분."
  Q4_inmemory_sqlite: "YES — new Database(':memory:') 사용 OK. better-sqlite3가 네이티브 지원하며 WAL mode 생략 가능 (:memory: 무의미). Fixture: 테스트마다 fresh DB instance + custom_templates 스키마 CREATE TABLE 수동 (drizzle migrate 호출 금지 — 이유 §3 Q-2)."
  Q5_refactor_no_test: "YES — D-2 (상수화), D-3a/D-3b (lib 분리) 는 순수 refactor로 behavior 불변. 기존 callers의 회귀 테스트 (Q-1 fs-watcher, Q-2 workflows-validate) 로 간접 커버. 추가 테스트 불필요."
author: Reviewer
created: 2026-04-20
---

[x] APPROVED

# Q Sprint 범위 승인 — Quality Sprint (회귀 테스트, Q-1 ~ Q-5)

## 1. 사전 검증

Reviewer 독립 실행 (read-only):

- `tests/unit/agent-header-inject.test.ts` 존재 (T-F2.4a 에서 커밋됨). `vitest.config.ts:5-11` — `environment: "jsdom"`, `globals: true`, `setupFiles: ["./vitest.setup.ts"]`. Default test pattern은 `**/*.{test,spec}.?(c|m)[jt]s?(x)` 이므로 `tests/unit/**/*.test.ts` 및 `tests/integration/**/*.test.ts` 둘 다 자동 pickup. Q-3/Q-4 신규 디렉토리 생성 시 별도 config 변경 불필요.
- `src/lib/db/index.ts:20` — `new Database(DB_PATH)`. `better-sqlite3` 생성자는 `":memory:"` 리터럴을 네이티브 지원 (Node better-sqlite3 문서 확인). Q-2 fixture 에서 `new Database(':memory:')` 유효.
- `src/lib/fs-watcher/index.ts:80,117` — `classifyProjectPath`, `classifyHomePath` **not exported** (file-local). Q-1 테스트 위해 export 추가 필요 (= fs-watcher/index.ts 수정 → Q-1이 3파일 됨: 신규 2 테스트 + 기존 1 수정).
- `src/app/api/custom-templates/route.ts:41` — `sanitizeSettings` **not exported** (route-file-local). 동일 문제 — Q-1의 sanitize 테스트가 export 변경 동반 시 3파일. Route-handler invocation (POST request with malicious body → 400 expected) 대안 유효.
- `src/lib/workflows/validate.ts:10` — `isValidItem` **export 됨 (D-3a 에서)**. Q-2 workflow 테스트 직접 호출 가능.
- `src/lib/templates/index.ts:2380` — `getAllTemplates` export 됨. Q-2 templates 테스트 직접 호출 가능.
- `.claude/hooks/**` deny rule 유효 — Q-5 는 Implementer 직접 수정 금지. Worktree + `--dangerously-skip-permissions` 에이전트 경유 필수 (이전 HK sprint 패턴 재사용).

**Amendments 필요**: Q-1 source export 처리 (아래 §3 Q-1), Q-5 hook 수정 워크플로 (§6).

## 2. 질문별 판정

### Q1. Q-1~Q-4 2파일 단위 분할 OK?
**YES with amendment on Q-1.**

- Q-2/Q-3/Q-4 제안 그대로 채택.
- **Q-1 문제**: `classifyProjectPath` / `classifyHomePath` / `sanitizeSettings` 가 pure 함수이지만 **export 되지 않음**. Unit test import 하려면 소스 파일 수정 (= Q-1 이 3파일).
- **해결책 택1** (Implementer 선택 허용):
  1. **Route-handler invocation 패턴**: Q-1의 sanitize 테스트는 `POST` 함수 import → `new NextRequest(url, { body: ... })` 로 invoke → response status 검증. fs-watcher classifier 는 여전히 export 필요하므로 Q-1 내 분리.
     - Q-1a: `tests/unit/fs-watcher-classifier.test.ts` (신규) + `src/lib/fs-watcher/index.ts` (export 2줄 추가) = **2 파일**.
     - Q-1b: `tests/unit/sanitize-settings.test.ts` (신규, POST handler invoke) = **1 파일**.
     - 합: Q-1 이 **2 commits** (Q-1a + Q-1b). 4 → 5 커밋.
  2. **순수 export 패턴**: Q-1 sanitize 를 `src/lib/settings-sanitize.ts` 로 먼저 추출 (Q-1-prep: 2파일 — 신규 lib + route.ts import 교체). 그 다음 Q-1a/Q-1b 각각 1파일 테스트. 합 4 커밋 (prep + classifier 테스트 + classifier export, sanitize 테스트).
  - **권장**: **옵션 1 (route-handler invocation)**. 이유: sanitize 는 route 전용 (재사용 0), lib 승격은 dead-abstraction 위험. Classifier 는 export 추가 2줄 — 저위험.
- **확정**: Q-1 을 **Q-1a (classifier 테스트 + export)** + **Q-1b (sanitize 테스트, handler invoke)** 로 **분리 · 2 커밋**. 각 2 / 1 파일.

### Q2. 통합 테스트 dev-server-dependency skip 정책 OK?
**YES — 채택.**

- **구현 요구**:
  ```ts
  let serverUp = false;
  beforeAll(async () => {
    try {
      const r = await fetch("http://localhost:3000/api/projects", {
        signal: AbortSignal.timeout(1500),
      });
      serverUp = r.ok;
    } catch {
      serverUp = false;
    }
    if (!serverUp) {
      console.warn("[SKIP] dev server not running — integration tests skipped");
    }
  });
  // 각 테스트 최상단:
  it.skipIf(!serverUp)("POST /api/... returns 409 for corrupt file", async () => { ... });
  ```
- **Skip condition**: AbortSignal timeout (hang 방지). `SKIP_INTEGRATION=1` 환경 변수 override 허용 (CI 없는 local 에서 일괄 skip).
- **금지**: `xtest` / `test.skip` 하드코딩 — condition-based 만 허용.
- **CI 도입 시**: GitHub Actions 가 dev server 기동 후 vitest 실행하도록 workflow 작성 (Q-sprint 밖, 후속 task).

### Q3. Q-5 hook 수정 별도 tracking?
**NO — tracking 파일 신설 거부.**

- `e2e-scenarios.sh` 자체가 유일 소스 (자기 문서화 shell). `CHANGELOG.md` 추가는 drift 위험 (두 곳 업데이트 누락) + 현재 프로젝트에 CHANGELOG 관례 없음.
- Q-5 commit 메시지에 시나리오 이름 명시로 충분:
  ```
  test(hooks): Q-5 — e2e-scenarios.sh S5 workflows CRUD + S6 custom-template sanitize
  ```
- **Hook 파일 수정 워크플로**: §6 참조. Implementer 가 working copy 에서 직접 수정 **금지**. Worktree 에이전트 경유.

### Q4. T-F2.1 DB fixture mock — in-memory SQLite OK?
**YES — 채택. 조건부.**

- `new Database(':memory:')` 유효. better-sqlite3 가 네이티브 지원.
- **Fixture 구성**:
  ```ts
  import Database from "better-sqlite3";
  import { drizzle } from "drizzle-orm/better-sqlite3";
  function createTestDb() {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    // WAL 불필요 (in-memory).
    // 수동 스키마 — drizzle migrate 사용 금지 (data/ 디렉토리 쓰기 + filesystem 의존).
    sqlite.exec(`
      CREATE TABLE custom_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_ko TEXT,
        description TEXT,
        category TEXT,
        settings TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    return drizzle(sqlite, { schema });
  }
  ```
- **요구사항**:
  - 각 테스트마다 fresh DB (beforeEach). 격리 보장.
  - `runMigrations()` 호출 **금지** (migrate.ts 는 `data/` 경로 가정 + filesystem I/O).
  - 스키마는 `src/lib/db/schema.ts` 의 `customTemplates` 정의와 **수동 sync** 필요 (drizzle schema 변경 시 테스트도 수정). 이 단점은 수락 — 대안 (`getDb` 모킹) 은 더 큰 리팩터 필요.
- **제한**: `getAllTemplates` 내부에서 `getDb()` 를 직접 호출하면 in-memory fixture 주입 불가. 이 경우:
  - `getAllTemplates` 시그니처가 `db` 인자 받지 않음 → `vi.mock('@/lib/db', () => ({ getDb: () => testDb }))` 로 모킹. **Vitest hoisted mock** 사용.
  - 이게 복잡하면 Q-2 templates corruption 테스트를 route handler invocation 으로 전환 (POST 시나리오 없어서 GET /api/templates → corrupt row 주입 → 200 + 해당 row 제외 응답 검증).
- **권장**: Implementer 가 `getAllTemplates` 구현 확인 후 더 간단한 접근 택1. 양쪽 다 허용.

### Q5. D-2/D-3a/D-3b refactor 테스트 불필요?
**YES — 확정.**

- D-2: 상수 4지점 교체 — 동작 불변. Q-1 fs-watcher-classifier 테스트 (신규 unit) 가 depth cap 회귀 커버.
- D-3a/D-3b: `isValidItem` 을 파일 이동만 — 로직 불변. Q-2 workflows-validate 테스트가 isValidItem 회귀 커버.
- **조건**: Q-1 classifier 테스트에 **depth boundary 케이스 필수** (cap 경계 정확히 ±1 — 상수 잘못 바꾸면 catch).

## 3. Per-task 수락 기준

### 공통 (모든 Q-<n> 커밋)
1. `npm run lint` — 에러 0
2. `npm run test` — 전수 pass (신규 테스트 포함)
3. `npm run build` — 성공
4. `.claude/hooks/e2e-before-commit.sh` — Guard 1/0c/0d/TSC/dev/e2e-scenarios 전부 PASS
5. **Guard 0c 요구**: `.claude/pipeline/outbox/diff-review-Q-<n>-*.md` 에 `[x] APPROVED`.
6. 2파일 한도 준수 — 초과 시 split.

### Q-1a (fs-watcher classifier) — **2 파일**
- 신규: `tests/unit/fs-watcher-classifier.test.ts`
- 수정: `src/lib/fs-watcher/index.ts` — `classifyProjectPath`, `classifyHomePath` 를 `export` 로 승격 (로직 변경 0).
- **필수 케이스** (최소 8):
  - `classifyProjectPath`: 정상 `.claude/agents/foo.md` (flat), 정상 `.claude/rules/sub/foo.md` (nested 허용), **cap 경계**: `PROJECT_WATCH_DEPTH + 1` 정확한 parts 수에서 accept, `+2` 에서 reject, agents flat cap (서브디렉토리 reject), null-return 케이스 (매칭 안 됨).
  - `classifyHomePath`: 동일 패턴, `HOME_WATCH_DEPTH + 1` 경계.
- 커밋 메시지: `test(fs-watcher): Q-1a — classifier 단위 테스트 (depth cap 경계 + nested rules)`

### Q-1b (sanitize-settings handler invocation) — **1 파일**
- 신규: `tests/unit/sanitize-settings.test.ts`
- **테스트 전략**: `import { POST } from "@/app/api/custom-templates/route"` → `new Request(...)` or `NextRequest` mock 생성 → malicious body 로 invoke → response status + body 검증.
- **필수 케이스** (최소 5):
  - 정상 settings → 201 (happy path baseline).
  - `{ "__proto__": { polluted: true } }` → 400 + error message "forbidden keys".
  - `{ nested: { constructor: { x: 1 } } }` → 400 (depth 2 에서 발견).
  - `{ prototype: "x" }` → 400.
  - Deep nesting (depth > MAX_SANITIZE_DEPTH, e.g., depth 33) → 400 + "depth_exceeded".
- 커밋 메시지: `test(custom-templates): Q-1b — sanitizeSettings 회귀 (prototype pollution + depth guard)`
- **주의**: POST handler 는 `getDb()` 를 호출하므로 happy path 케이스는 DB mock 필요. 또는 sanitize 실패 경로만 테스트 (DB 도달 전 400) + happy path 생략. **권장**: 실패 경로 4 케이스 + happy path 생략. Happy path 는 Q-3 integration 에서 커버.

### Q-2 (workflows + templates 순수 + DB fixture) — **2 파일**
- 신규 1: `tests/unit/workflows-validate.test.ts`
  - `isValidItem` direct import from `@/lib/workflows/validate`.
  - **필수 케이스** (최소 6): valid item (templateId 존재 + name string), `templateId === ""` → false, `templateId` missing → false, `name` missing → false, non-object → false, array → false.
- 신규 2: `tests/unit/templates-custom-parse.test.ts`
  - in-memory SQLite fixture (§Q4 answer 스니펫 참조).
  - `getAllTemplates` mock via `vi.mock` OR route-handler invocation — Implementer 결정.
  - **필수 케이스** (최소 4): 정상 row → 목록 포함, corrupt settings JSON row → 목록에서 skip (throw 없이 resilience), 빈 DB → built-in templates 만 반환, custom + built-in 공존.
- 커밋 메시지: `test(lib): Q-2 — workflows validate + templates corruption resilience`
- 2 파일 엄수.

### Q-3 (parse-error 409 integration) — **1 파일**
- 신규: `tests/integration/parse-error-409.test.ts`
- **테스트 전략**: dev server 기동 상태에서 HTTP fetch. test fixture 프로젝트의 `settings.json` 을 의도적으로 corrupt → API 호출 → 409 + sha256 불변 검증 → cleanup (원본 복구).
- **필수 케이스** (최소 3):
  1. `POST /api/projects/[id]/settings/apply-template` with corrupt target settings.json → 409 + response body에 parse error + 실제 파일 sha256 변경 없음.
  2. `POST /api/workflows/activate` with corrupt member file → 409 + atomic rollback (이미 적용된 템플릿 역적용).
  3. `POST /api/projects/[id]/settings/batch-apply` with 1 corrupt target → 409 + 0 applied.
- **Skip 로직**: §Q2 answer 그대로 구현.
- **Cleanup**: afterEach 에서 fixture settings 원본 복구 (crypto hash 비교).
- 커밋 메시지: `test(integration): Q-3 — parse-error 409 회귀 (apply-template + activate + batch-apply)`

### Q-4 (agent-header apply 통합) — **1 파일**
- 신규: `tests/integration/agent-header-apply.test.ts`
- **테스트 전략**: dev server + test project 경로. `POST /api/projects/[id]/agent-header/apply` 2-pass 검증 + EACCES 롤백 md5 불변.
- **필수 케이스** (최소 3):
  1. Happy path: 2개 `.md` agent 파일 모두 inject → response `{updated: 2, rolledBack: [], rollbackFailed: []}`.
  2. EACCES rollback: 2번째 파일을 `chmod 0444` → response `{applied: [...], rolledBack: [first file], mode: "inject"}` + 첫 파일 md5 원복 확인.
  3. Dry-run-only (Step 1) 실패 (권한 없음) → 적용된 파일 0 + 아무 변경 없음.
- **Cleanup**: `chmod 0644` 원복 + fixture md 파일 원상 복구.
- **Skip 로직**: §Q2 answer.
- 커밋 메시지: `test(integration): Q-4 — agent-header apply 2-pass 회귀 (happy + EACCES rollback)`

### Q-5 (e2e-scenarios.sh S5 + S6) — **1 파일 (hook — §6 워크플로)**
- 수정: `.claude/hooks/e2e-scenarios.sh` (worktree 에이전트 경유).
- **S5 Workflows CRUD**: 
  - POST `/api/workflows` with 2 items → 201 + id 반환.
  - PATCH `/api/workflows/[id]` with updated items → 200.
  - DELETE `/api/workflows/[id]` → 204.
  - GET `/api/workflows/[id]` → 404 (삭제 확인).
- **S6 custom-template sanitize**:
  - POST `/api/custom-templates` with `__proto__` key → 400 + error message 매치.
  - POST `/api/custom-templates` with 정상 payload → 201.
  - GET `/api/custom-templates` → 목록에 정상만 포함.
- **Exit codes**: 실패 시 `exit 1` (hook gate 가 커밋 차단).
- 커밋 메시지: `test(hooks): Q-5 — e2e-scenarios.sh S5 workflows CRUD + S6 custom-template sanitize`
- **Commit 포함성**: `.claude/hooks/**` 가 git-tracked 여부 확인 — untracked 이면 실제 커밋 파일 수 0 (파이프라인 상 "infra update"). Tracked 이면 정상 커밋.

## 4. 커밋 순서 (확정)

```
Q-1a → Q-1b → Q-2 → Q-3 → Q-4 → Q-5
```

| 순서 | Task | 파일 수 | 파일 |
|-----|------|--------|------|
| 1 | Q-1a | 2 | `tests/unit/fs-watcher-classifier.test.ts` (신규) + `src/lib/fs-watcher/index.ts` (export 추가) |
| 2 | Q-1b | 1 | `tests/unit/sanitize-settings.test.ts` (신규) |
| 3 | Q-2 | 2 | `tests/unit/workflows-validate.test.ts` + `tests/unit/templates-custom-parse.test.ts` (둘 다 신규) |
| 4 | Q-3 | 1 | `tests/integration/parse-error-409.test.ts` (신규) |
| 5 | Q-4 | 1 | `tests/integration/agent-header-apply.test.ts` (신규) |
| 6 | Q-5 | 1 | `.claude/hooks/e2e-scenarios.sh` (worktree 경유 수정) |

**합계**: **6 커밋** (Implementer 제안 5 → Q-1 split 으로 +1). 각 ≤ 2 파일. CLAUDE.md 준수.

## 5. Amendments (요약)

1. **Q-1 split**: Q-1a (fs-watcher classifier + source export 2줄) + Q-1b (sanitize-settings, handler invocation 패턴). 소스 파일 export 변경을 Q-1a 에 흡수 → 2파일 유지.
2. **Q-2 fixture**: in-memory SQLite + 수동 CREATE TABLE (drizzle migrate 호출 금지 — filesystem 의존). `getAllTemplates` 모킹 or route-handler invocation 중 Implementer 결정.
3. **Q-3/Q-4 skip 로직**: AbortSignal timeout 1500ms + `SKIP_INTEGRATION=1` env override + console.warn (hardcoded skip 금지).
4. **Q-5 hook 워크플로**: `.claude/hooks/**` deny-ruled → worktree + `--dangerously-skip-permissions` 에이전트 경유 (§6).
5. **Q1 depth boundary 필수**: classifier 테스트에 `PROJECT_WATCH_DEPTH + 1` / `+2` 경계 명시. D-2 상수화 회귀 자동 catch.
6. **Q3 tracking 파일 거부**: CHANGELOG 신설 금지. 커밋 메시지에 S5/S6 명시로 충분.

## 6. Q-5 Hook 수정 워크플로 (hard constraint)

CLAUDE.md 금지 사항: `.claude/hooks/**` 편집. Implementer 직접 수정 시 deny rule 으로 차단됨.

**유일 허용 경로** (이전 HK sprint 와 동일):
1. Implementer 가 hook diff 를 별도 파일로 작성 (예: `/tmp/Q-5-hook-diff.md`).
2. Reviewer 에게 hook worktree 에이전트 spawn 요청 (inbox).
3. 에이전트가 `--dangerously-skip-permissions` + worktree 에서 파일 수정.
4. 파일이 untracked 이면 이 commit 은 "meta commit" (file change 0, 메시지만 기록) — 허용.
5. `e2e-scenarios.sh` 실행하여 PASS 확인 → Implementer 가 확인 스크립트 로그 제출.

**Guard 0c 예외**: Q-5 는 file commit 이 아닐 수 있음 → `diff-review-Q-5-*.md` 에 hook 실행 로그 (S5 + S6 PASS) 첨부 필요. Reviewer 가 별도 확인.

## 7. 금지 항목 재확인

- `--no-verify`, `-n`, `--amend`, `core.hooksPath` 변경 — 영구 금지.
- `.claude/hooks/**` Implementer 직접 수정 금지 (§6).
- 3+ 파일 동시 수정 금지 (모든 Q-<n> ≤ 2 파일 — 준수).
- Reviewer outbox `diff-review-Q-<n>-*.md` APPROVED 없이 commit 시도 금지.
- Integration test (Q-3/Q-4) 에서 hardcoded `it.skip` 금지 — condition-based 만.
- Q-2 fixture 에서 `runMigrations()` 호출 금지 (data/ 쓰기 → test 격리 깨짐).
- 테스트 cleanup 누락 금지 — afterEach 에서 chmod/file 원복.

## 8. 세션 종료 의무

6 커밋 완료 후:
- `pipeline/state/current-task.md` 최신화 (Q sprint 완료).
- `docs/worklog/session-<YYYY-MM-DD>.md` append.
- `pipeline/log/implementer.jsonl` append.
- **Follow-up inbox 생성**: CI 설정 (GitHub Actions — vitest + dev server + e2e-scenarios 자동 실행) 별 task 로 제안. Q-sprint 범위 밖.

## 9. 범위 밖 (확인)

- CI 설정 (GitHub Actions) — 후속.
- Playwright E2E — 후속.
- Storybook / Chromatic — 후속.
- `src/lib/settings-sanitize.ts` 추출 리팩터 — 현재 불필요 (route 전용, handler invocation 으로 테스트 충분).

---

**판정 종합**: **APPROVED with 1 split amendment (Q-1 → Q-1a + Q-1b)**. Implementer 제안 5 커밋 → 확정 6 커밋. 2파일 한도 엄수. Q-5 hook 수정은 worktree 에이전트 경유 필수. Q-3/Q-4 skip 로직은 condition-based. 진행 가능.
