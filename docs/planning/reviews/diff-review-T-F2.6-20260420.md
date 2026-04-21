---
task: T-F2.6
type: diff-review
date: 2026-04-20
reviewer: Reviewer Claude
subject: PATCH /api/workflows/[id] — isValidItem 재사용 + WorkflowItem export
spec: approved-F2-scope-20260420.md §T-F2.6
verdict: APPROVED
---

# Diff Review — T-F2.6

- [x] APPROVED

## 변경 파일 (diff stat)

| 파일 | +/- |
|------|-----|
| `src/app/api/workflows/route.ts` | +2 / -2 (export 2 심볼) |
| `src/app/api/workflows/[id]/route.ts` | +3 / -2 (import + PATCH 가드 치환) |

총 2 파일. SPEC 한도(≤2) 준수. drive-by 변경 없음 — POST handler 본문 무수정, [id]/route.ts 의 GET·DELETE handler 무수정 확인.

## 코드 검증

| 항목 | 기대 | 실측 |
|------|------|------|
| `export interface WorkflowItem` in route.ts | 추가 | ✅ L9 |
| `export function isValidItem` in route.ts | 추가 | ✅ L15 |
| `isValidItem` 본문 변경 | 없음 (export만) | ✅ 시그니처/본문 동일 |
| `[id]/route.ts` `import { isValidItem } from "../route";` | 추가 | ✅ L5 |
| PATCH ad-hoc 가드 → `if (!isValidItem(it))` | 치환 | ✅ L56 |
| 400 응답 메시지 | `"invalid item shape"` (POST와 통일) | ✅ |
| POST validation 변경 | 없음 | ✅ isValidItem 호출 그대로 |
| GET / DELETE handler | 무수정 | ✅ |

## Drive-by 점검

`git status --short` 결과의 다른 unstaged/untracked 항목 (`docs/ARCHITECTURE.md`, `src/app/projects/[id]/page.tsx`, `src/components/editors/HooksUnifiedEditor.tsx`, `REVIEW.md`, untracked `src/app/api/projects/[id]/worktrees/`, `src/components/bash-matcher-builder/`, `src/components/worktrees/`, `src/lib/bash-matcher-builder.ts`)은 본 task 무관 — SPEC §Q5 합의에 따라 F-2 범위 밖 사전존재 변경.

## HTTP 재증명 (fresh workflow `wf-vvdx5tfR`)

POST create → `id=wf-vvdx5tfR` (non-empty) ✅

| Step | Payload 요지 | Expected | Actual HTTP | Body |
|------|-------------|----------|-------------|------|
| (b) positive arrays | `excludeTopLevelKeys:["hooks"], excludeExtraFiles:["notes.md"]` | 200 | **200** | `{"success":true}` |
| (c) scalar TopLevelKeys | `excludeTopLevelKeys:"hooks"` | 400 + invalid item shape | **400** | `{"error":"invalid item shape"}` |
| (d) scalar ExtraFiles | `excludeExtraFiles:"a"` | 400 | **400** | `{"error":"invalid item shape"}` |
| (e) missing templateId | `{excludeTopLevelKeys:["hooks"]}` | 400 | **400** | `{"error":"invalid item shape"}` |
| (f) empty templateId | `templateId:""` | 400 (length>0) | **400** | `{"error":"invalid item shape"}` |

GET state confirmation (step g):
```json
[
  {
    "templateId": "security-basic",
    "excludeTopLevelKeys": ["hooks"],
    "excludeExtraFiles": ["notes.md"]
  }
]
```
→ (b)의 valid 상태 그대로 보존. (c)~(f) negatives는 mutation 없음 ✅

Cleanup: `DELETE /api/workflows/wf-vvdx5tfR` → 200 ✅

## Gate 결과

| Gate | 결과 |
|------|------|
| `git status --short` (T-F2.6 두 파일만 변경, 외 사전존재) | ✅ |
| `git diff` 일치성 | ✅ SPEC §T-F2.6과 정확 일치 |
| `npx tsc --noEmit` | exit 0 ✅ |
| `npm run lint` | no warnings ✅ |
| `npm run test` | 8 pass / 2 files ✅ |
| `.claude/hooks/e2e-scenarios.sh` | ALL PASS (S1~S4) ✅ |
| HTTP probe 5종 PATCH | 200/400/400/400/400 모두 일치 ✅ |
| GET 상태 보존 | ✅ |

## Concerns

1. **순환 의존 잠재 (low)**: `[id]/route.ts`가 `../route` 에서 import. Next.js App Router에서 route 모듈 간 import는 일반적이며 현 빌드도 성공이므로 blocking 아님. 향후 `isValidItem`/`WorkflowItem`이 더 많은 곳에서 쓰이면 `src/lib/workflows/validate.ts` 분리 권장 (follow-up).
2. **POST와 PATCH 에러 메시지 통일됨**: SPEC acceptance "동일 invalid payload → 동일 400" 충족 — 양쪽 다 `"invalid item shape"`.

## 최종

APPROVED. SPEC §T-F2.6 변경 요지(`isValidItem` export + PATCH 가드 치환) 및 Acceptance(POST/PATCH 동일 400, 정상 payload 200, activate substring 오매칭은 PATCH 단계 차단) 전부 충족. 5종 HTTP probe 기대치 100% 일치. State mutation 회귀 없음.
