---
type: diff-review
task: D-3a
date: 2026-04-20
reviewer: Reviewer
verdict: APPROVED
---

# Diff Review — D-3a

- [x] APPROVED

## Scope
SPEC §D-3a: `WorkflowItem` interface + `isValidItem` type guard를 `src/lib/workflows/validate.ts`로 추출. `src/app/api/workflows/route.ts`는 lib에서 import하고, `[id]/route.ts` (D-3b 전까지) 호환용 re-export shim 유지.

## Files
| File | Change |
|------|--------|
| `src/lib/workflows/validate.ts` | NEW (17 lines) |
| `src/app/api/workflows/route.ts` | Modified (+4 / -15) |

## Diff Stat
```
 src/app/api/workflows/route.ts | 19 ++++---------------
 1 file changed, 4 insertions(+), 15 deletions(-)
 src/lib/workflows/validate.ts  | NEW (17 lines)
```

## Code Review

### `src/lib/workflows/validate.ts` — OK
- 순수 함수 + 타입. external imports 없음.
- `WorkflowItem` 필드: `templateId: string`, `excludeTopLevelKeys?: string[]`, `excludeExtraFiles?: string[]` — 기존 정의와 완전 동일.
- `isValidItem`: 기존 로직 그대로 (null/object/templateId non-empty string/array 체크).
- 주석: D-3 rationale 명시 ("route-to-route import coupling 회피").
- 두 심볼 모두 export.

### `src/app/api/workflows/route.ts` — OK
- `import { isValidItem, type WorkflowItem } from "@/lib/workflows/validate";` 추가.
- 로컬 `interface WorkflowItem` + `function isValidItem` 제거.
- `export { isValidItem, type WorkflowItem };` re-export shim + 설명 주석 ("D-3b 전까지 `[id]/route.ts`의 `../route` import 호환") 추가.
- GET / POST 핸들러 로직 변경 없음 (import 사이트만 변경).
- `[id]/route.ts:5` 여전히 `import { isValidItem } from "../route";` — 의도대로 untouched, shim 경유 해석.

## Gate Results

| Gate | Result |
|------|--------|
| `git status --short` | `M src/app/api/workflows/route.ts` + `?? src/lib/workflows/` (scope 내) |
| `npx tsc --noEmit` | exit 0 (shim 경유 타입 해석 OK) |
| `npm run lint` | exit 0 |
| `npm run test` | 8 pass / 2 files |
| `.claude/hooks/e2e-scenarios.sh` | ALL PASS (S1 Apply+Undo, S2 Skills, S3 Workflows, S4 Hook Presets) |

## HTTP Regression

| # | Request | Expected | Actual |
|---|---------|----------|--------|
| a | POST valid workflow | id non-empty | `wf-TWqsFggh` |
| b | POST scalar `excludeTopLevelKeys:"hooks"` | 400 invalid item shape | `{"error":"invalid item shape"}` HTTP 400 — **lib isValidItem 경유 확인** |
| c | PATCH array `excludeExtraFiles:["x.md"]` | 200 success | `{"success":true}` HTTP 200 — **re-export shim 경유 확인** |
| d | PATCH scalar `excludeExtraFiles:"x"` | 400 invalid item shape | `{"error":"invalid item shape"}` HTTP 400 |
| e | DELETE cleanup | 200 success | `{"success":true}` |

b/d 케이스가 POST와 PATCH 양쪽 path에서 동일한 `isValidItem` 구현을 거치고 있음을 증명 → 추출이 의미·동등.

## Verdict
POST path는 `@/lib/workflows/validate` 직접 import, PATCH path는 shim re-export 경유로 기존 거동 100% 유지. 모든 게이트 통과. D-3b (`[id]/route.ts`를 lib로 직접 전환 후 shim 제거) 진행 승인.

**[x] APPROVED**
