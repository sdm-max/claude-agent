---
task: D (F-2 후속 정리 sprint, D-1 ~ D-3b)
decision: APPROVED
scope_ref: .claude/pipeline/inbox/question-D-scope-20260420.md
answers:
  Q1_D1_approach: "YES — best-effort reverse-order rollback. Response shape: {updated, total, files, applied, skipped, mode, rolledBack[], rollbackFailed[]}. writeError field required on skipped entries that triggered rollback."
  Q2_constant_naming: "YES — PROJECT_WATCH_DEPTH / HOME_WATCH_DEPTH accepted verbatim (exported const, module-top, with comment linking chokidar depth ↔ classifier cap relationship)"
  Q3_lib_path: "YES — src/lib/workflows/validate.ts accepted. Export isValidItem + WorkflowItem from lib; route.ts re-export removed (callers import from lib directly)."
  Q4_order: "YES — D-1 → D-2 → D-3a → D-3b confirmed. No cross-dependency, but D-3a-before-D-3b is hard required (consumer cannot compile until lib exists)."
  Q5_defer_D4_D5: "YES — D-4 (policy question, needs user) and D-5 (investigation task, needs repro) out of scope. Raise as separate inbox items."
author: Reviewer
created: 2026-04-20
---

[x] APPROVED

# D Sprint 범위 승인 — D-1 ~ D-3b

## 1. 사전 검증

Reviewer 독립 실행 (read-only):

- `src/app/api/projects/[id]/agent-header/apply/route.ts:47-85` — Plan type `{ name, full, next, changed }` (line 52), `original` 이미 읽힘(line 58-59)이나 폐기됨. Step 2 write loop (line 77-84) 실패 시 `break` + skipped append, 이전 writes는 이미 커밋됨. 개선안의 Plan에 `original` 추가 + 역순 복원은 기존 구조에 최소 침습.
- `src/lib/fs-watcher/index.ts:93` (`parts.length <= 5`), `:128` (`parts.length <= 4`), `:180` (chokidar `depth: 4`), `:236` (chokidar `depth: 3`). 상수화는 module-top 선언 2줄 + 4 지점 참조 교체 — 기계적.
- `src/app/api/workflows/route.ts:9-22` — `WorkflowItem` interface + `isValidItem(x: unknown): x is WorkflowItem`. 순수 TS (NextResponse/NextRequest/db 의존 0). `src/app/api/workflows/[id]/route.ts:5` — `import { isValidItem } from "../route"` (cross-route import 안티패턴 확인). lib 분리 mechanical.

3 proposals 전부 tractable. Amendments 없음.

## 2. 질문별 판정

### Q1. D-1 best-effort rollback + 응답 shape 확장 OK?
**YES.** 아래 조건 이행:

- **롤백 전략**: `plans[]` 각 entry에 `original: string` 저장. Step 2 write 실패 감지 시:
  1. 실패 인덱스를 기록 (`break` 대신 flag).
  2. `applied[]` 의 **역순**으로 `fs.writeFileSync(p.full, p.original)` 시도.
  3. 각 복원 파일은 `rolledBack: string[]` 에 추가, 실패 시 `rollbackFailed: Array<{path, reason}>` 에 추가 (best-effort, throw 금지).
- **응답 shape (확정)**:
  ```ts
  {
    updated: number;        // 최종 성공 write 수 (롤백된 건 제외)
    total: number;          // 전체 대상 .md 파일 수
    files: string[];        // backward-compat alias of applied (유지)
    applied: string[];      // 성공 write + 롤백 안 된 것
    skipped: Array<{path: string; reason: string}>;
    rolledBack: string[];   // 롤백 성공
    rollbackFailed: Array<{path: string; reason: string}>;
    mode: "inject" | "strip";
  }
  ```
  - 정상 경로(모든 write 성공): `rolledBack: []`, `rollbackFailed: []`.
  - Mid-write 실패: `applied` 는 롤백 된 파일 제외, `skipped` 에 write_failed + rollback sentinel.
- **POSIX 한계 명시**: diff-review 설명에 "rollback itself may fail (disk full 등); no transactional guarantee — feature is pure best-effort" 한 줄 포함 필요.
- **기존 contract 보존**: `updated` / `total` / `files` / `mode` 필드 유지 (소비자 호환).

### Q2. 상수명 `PROJECT_WATCH_DEPTH` / `HOME_WATCH_DEPTH` OK?
**YES — 채택 verbatim.**

- 네이밍이 의도(chokidar watch depth) 명확.
- **요구 주석**: 각 상수 옆에 classifier cap 수식 주석 필수.
  ```ts
  // chokidar depth:4 under <root>/ means <root>/.claude/rules/sub/foo.md = 4 segments below root,
  // → classifier receives max 5 parts (including ".claude"). Keep PROJECT_WATCH_DEPTH + 1 = cap.
  export const PROJECT_WATCH_DEPTH = 4;
  // chokidar depth:3 under ~/.claude/ → classifier receives max 4 parts.
  export const HOME_WATCH_DEPTH = 3;
  ```
- 4 지점 교체: line 93 (`<= PROJECT_WATCH_DEPTH + 1`), line 128 (`<= HOME_WATCH_DEPTH + 1`), line 180 (`depth: PROJECT_WATCH_DEPTH`), line 236 (`depth: HOME_WATCH_DEPTH`).
- export 여부: 테스트 접근 가능성 위해 export 권장 (no consumer 밖).

### Q3. lib 경로 `src/lib/workflows/validate.ts` OK?
**YES — 채택.**

- `src/lib/` 루트가 이미 도메인별 디렉토리 패턴 (templates/, disk-files/, agent-references/, ...). `workflows/` 신설 자연스러움.
- 파일명 `validate.ts`: 향후 workflow 관련 pure helpers 추가 시 디렉토리 확장 여지 (e.g., `serialize.ts`, `merge.ts`).
- **요구사항**:
  - lib export: `export interface WorkflowItem { ... }` + `export function isValidItem(x: unknown): x is WorkflowItem { ... }`.
  - `src/app/api/workflows/route.ts` 에서 **원본 정의 제거**, lib import 로 교체. re-export 하지 말 것 (cross-route import 경로가 지속되는 것을 막기 위함).
  - `src/app/api/workflows/[id]/route.ts` 는 `import { isValidItem } from "@/lib/workflows/validate"` 로 수정.

### Q4. 순서 D-1 → D-2 → D-3a → D-3b?
**YES — 확정.**

- D-1/D-2/D-3 각 독립 (cross-dep 없음). 어떤 순서든 기술적 무관.
- D-3a → D-3b: **엄격 강제.** D-3b 는 lib 존재 전제. D-3a 미완 상태에서 D-3b 커밋 시 tsc 실패 → hook TSC gate 차단됨 (자동 방어).
- 제안 순서는 "위험도 큰 것부터 (D-1 rollback 로직)" → "단순 refactor" 진행하여 초기 집중력이 필요한 task 를 먼저 처리하는 합리적 ordering. 유지.

### Q5. D-4 / D-5 별건 처리?
**YES.**

- **D-4** `.claude/hooks/**` git 추적 정책: user-facing 결정 사안 (repo에 commit? per-user? submodule?). Reviewer/Implementer 단독 결정 불가 → 사용자에게 question inbox 별도.
- **D-5** Undo 불완전 + Detail Dialog regression: 증상 재현 선행 필요 (MEMORY.md 메모에 "미조사"). Investigation task 로 별 sprint 편성. D sprint 안에 묶으면 scope creep + 시간 예측 불가.
- 두 건 모두 이번 D sprint commit 4건 밖.

## 3. Per-task 수락 기준

### 공통 (모든 D-<n> 커밋)
1. `npm run lint` — 에러 0
2. `npm run test` — 전수 pass
3. `npm run build` — 성공
4. `.claude/hooks/e2e-before-commit.sh` — Guard 1/0c/0d/TSC/dev/e2e-scenarios 전부 PASS
5. **Guard 0c 요구**: `.claude/pipeline/outbox/diff-review-D-<n>-*.md` 에 `[x] APPROVED` — 각 커밋 전 Reviewer 에게 per-task diff review 요청(inbox) 필수.

### D-1 추가 수락 기준
- 응답 JSON shape 에 `rolledBack: string[]` 및 `rollbackFailed: Array<{path,reason}>` 필드 **반드시 포함** (정상 경로에서도 빈 배열).
- 기존 필드 (`updated`, `total`, `files`, `applied`, `skipped`, `mode`) 유지 — consumer 파괴 0.
- Plan type 에 `original: string` 추가, Step 1에서 채움.
- 회귀 증거: 정상 경로 mock (전부 성공) + mid-failure 경로 mock (2번째 write 실패 → 1번째 롤백 success) 최소 2 케이스 테스트.

### D-2 추가 수락 기준
- 상수 2개 모듈 상단에 **export** + **주석 포함** (chokidar ↔ classifier cap 관계 명시).
- 4 지점 리터럴 전부 상수 참조로 교체 (5, 4, 4, 3 → PROJECT_WATCH_DEPTH+1, HOME_WATCH_DEPTH+1, PROJECT_WATCH_DEPTH, HOME_WATCH_DEPTH).
- 회귀: 기존 fs-watcher 테스트 pass (동작 불변).

### D-3a 추가 수락 기준
- `src/lib/workflows/validate.ts` 신규 (WorkflowItem interface + isValidItem fn + 관련 타입만, **no framework import**).
- `src/app/api/workflows/route.ts` 에서 정의 제거, lib import 로 교체. **re-export 금지** (cross-route import 경로 완전 차단).
- POST 회귀: `items[0].templateId === ""` → 400 재현.

### D-3b 추가 수락 기준
- `[id]/route.ts:5` 의 `import { isValidItem } from "../route"` 를 `import { isValidItem } from "@/lib/workflows/validate"` 로 교체.
- 다른 수정 금지 (순수 import path 교체).
- PATCH 회귀: `items` 배열에 invalid item → 400 재현.

## 4. 커밋 순서 (확정)

```
D-1 → D-2 → D-3a → D-3b
```

| 순서 | Task | 파일 수 | 파일 | 메시지 |
|-----|------|--------|------|-------|
| 1 | D-1 | 1 | `src/app/api/projects/[id]/agent-header/apply/route.ts` | `fix(agents): D-1 — apply-to-all Step 2 best-effort rollback` |
| 2 | D-2 | 1 | `src/lib/fs-watcher/index.ts` | `refactor(fs-watcher): D-2 — depth cap 상수화` |
| 3 | D-3a | 2 | `src/lib/workflows/validate.ts` (신규) + `src/app/api/workflows/route.ts` | `refactor(workflows): D-3a — isValidItem을 lib로 분리 (POST 이전)` |
| 4 | D-3b | 1 | `src/app/api/workflows/[id]/route.ts` | `refactor(workflows): D-3b — PATCH가 lib isValidItem 사용` |

**합계**: 4 커밋. 최대 2파일 / 커밋. CLAUDE.md "1 task = 1~2 파일" 규칙 준수.

## 5. Amendments

**없음.** Implementer 제안 4분할 · D-1→D-2→D-3a→D-3b 순서 · D-4/D-5 별건 분리 — 그대로 채택. 단 D-1 응답 shape 및 D-2 주석 포맷을 **섹션 3 에 명시한 대로 엄격 적용** (implementation detail 고정).

## 6. 금지 항목 재확인

- `--no-verify`, `-n`, `--amend`, `core.hooksPath` 변경 — 영구 금지.
- 3+ 파일 동시 수정 금지 (모든 D-<n> 2 파일 이하 — 준수).
- Reviewer outbox `diff-review-D-<n>-*.md` APPROVED 없이 commit 시도 금지.
- **D-3a 커밋에 `[id]/route.ts` 포함 금지** (D-3b 로 분리하여 CLAUDE.md 2 파일 규칙 엄수). `[id]/route.ts` 는 여전히 `../route` import 이므로 D-3a 직후 tsc는 통과(re-export 없을 경우 실패 가능성) — 따라서 D-3a 구현 시 `route.ts` 에서 `isValidItem` 를 **임시 re-export** 하는 우회는 허용 (D-3b 에서 제거). 혹은 lib import 를 `[id]/route.ts` 가 먼저 바라보도록 D-3a 에 1 line import 변경 동반 가능. 어느 쪽이든 **2 파일 초과 금지**.
  - 권장 경로: D-3a 에서 route.ts 가 lib을 import 하고 **계속해서 isValidItem 를 re-export** (back-compat shim). D-3b 에서 `[id]/route.ts` 를 lib 직접 import 로 교체하고, 같은 커밋에 route.ts 의 re-export 를 제거 — 이러면 D-3b 가 2 파일 (`[id]/route.ts` + `route.ts`). **여전히 2 파일 한도 내**.

## 7. 세션 종료 의무

4 커밋 완료 후:
- `pipeline/state/current-task.md` 최신화 (D sprint 완료)
- `docs/worklog/session-2026-04-20.md` append (또는 21 로 넘어갔으면 새 파일)
- `pipeline/log/implementer.jsonl` append
- D-4 / D-5 각각 별 inbox question 파일 생성 (선행 정리)

---

**판정 종합**: APPROVED. Implementer 제안 4분할 · 순서 · D-4/D-5 deferral — 그대로 채택. D-1 response shape 및 D-2 상수 주석 요구 사항이 hard constraint. 진행 가능.
