---
task: D-3b
type: diff-review
verdict: APPROVED
date: 2026-04-20
reviewer: Reviewer
---

# Diff Review — D-3b

- [x] APPROVED

## Scope
SPEC §D-3b. Migrate `src/app/api/workflows/[id]/route.ts` import to `@/lib/workflows/validate` and remove the re-export shim from `src/app/api/workflows/route.ts`.

## Diff Stat
```
 src/app/api/workflows/[id]/route.ts | 2 +-
 src/app/api/workflows/route.ts      | 3 ---
 2 files changed, 1 insertion(+), 4 deletions(-)
```

### Change Details
- `src/app/api/workflows/[id]/route.ts`: `import { isValidItem } from "../route";` → `import { isValidItem } from "@/lib/workflows/validate";`
- `src/app/api/workflows/route.ts`: removed the temporary re-export shim (comment + `export { isValidItem, type WorkflowItem };`). Lib import (`import { isValidItem, type WorkflowItem } from "@/lib/workflows/validate";`) retained.
- No drive-by edits.

## Grep Evidence
- `grep -rn 'from "\.\./route"' src/app/api/workflows/` → **empty** (zero route-to-route imports remain).
- `grep -n 'export.*isValidItem\|export.*WorkflowItem' src/app/api/workflows/route.ts` → **empty** (shim removed).

## Gate Results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | exit 0 (no errors) |
| `npm run lint` | exit 0 (clean) |
| `npm run test` | 2 files, 8 tests passed |
| `.claude/hooks/e2e-scenarios.sh` | S1/S2/S3/S4 ALL PASS |

## HTTP Regression

POST seed: `WF=wf-E86sOBTG` (scope=user, items=[{templateId:"security-basic"}]).

| Step | Method | Payload | Expected | Actual |
|------|--------|---------|----------|--------|
| 9b | PATCH `/api/workflows/$WF` | `{"items":[{"templateId":"security-basic","excludeExtraFiles":["y.md"]}]}` | 200 | **200** `{"success":true}` |
| 9c | PATCH `/api/workflows/$WF` | `{"items":[{"templateId":"security-basic","excludeExtraFiles":"y"}]}` | 400 | **400** `{"error":"invalid item shape"}` |
| 9d | POST `/api/workflows` | `{"name":"rev-d3b-neg",...,"excludeExtraFiles":"y"}` | 400 | **400** `{"error":"invalid item shape"}` |
| 9e | DELETE `/api/workflows/$WF` | — | 200 | **200** `{"success":true}` |

POST path still validates via lib (9d confirms). PATCH path now validates via lib directly without going through the route re-export (9b/9c confirm).

## Verdict
All checks pass. D-3b complete. Implementer may commit.
