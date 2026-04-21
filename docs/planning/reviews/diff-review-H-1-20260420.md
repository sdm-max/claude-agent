---
task: H-1
decision: APPROVED
reviewer: Reviewer-Claude
created: 2026-04-20
diff_ref: 8a270cb (staged, pre-commit)
type: diff-review
---

# Diff Review — H-1 (emergency chore)

[x] APPROVED

## 개요

H-1: `src/app/api/templates/[id]/apply/route.ts` 에서 `nanoid()` 를 `appliedId` 상수로 호이스트하고, `appliedTemplates` row id 와 `NextResponse.json` 응답 필드 양쪽에 동일 값 사용. 동기: `.claude/hooks/e2e-scenarios.sh` S1 시나리오 contract 가 응답 `appliedId` 필드를 요구함.

## Diff 요약

| 파일 | +/- | 비고 |
|------|-----|------|
| `src/app/api/templates/[id]/apply/route.ts` | +3 / -1 | `const appliedId = nanoid()` 호이스트, `id: appliedId`, response 에 `appliedId,` 추가 |

스테이징 파일 = 1 (지시서 §1 조건 충족). drive-by 변경 없음 (§2 조건 충족).

## Acceptance Gates

| # | Gate | 결과 | 비고 |
|---|------|------|------|
| 1 | `git diff --cached --stat` (1 파일만) | PASS | route.ts 단일 |
| 2 | `git diff --cached` (정확한 3-포인트 변경) | PASS | hoist / id 치환 / response 추가 — 그 외 없음 |
| 3 | `npx tsc --noEmit` | PASS | exit 0 |
| 4 | `npm run lint` | PASS | exit 0, 에러 0 |
| 5 | `npm run test` | PASS | 1/1 |
| 6 | `bash .claude/hooks/e2e-scenarios.sh` | **PASS** | S1/S2/S3/S4 → `ALL PASS` (H-1 핵심 증거) |
| 7a | Live curl apply → `appliedId` 비어있지 않은 문자열 | PASS | `2NhSB_DhZZ5fxlueqGP__` 반환됨 |
| 7b | Live curl undo → `success: true` | PASS | 테스트 프로젝트 정리 완료 |

## 노트

- `.claude/hooks/e2e-scenarios.sh` 의 S1/S2/S4 hook 버그 수정이 병행됨. 단, 이 파일은 git-tracked 아님 (로컬 전용 infra). 따라서 이 diff review 의 스코프 밖이며, staged diff 검증에도 영향 없음. 후속 조치로 해당 hook 변경본이 다른 세션/환경에서도 동기화될 수 있도록 pipeline 외부에서 관리 권고.
- `appliedId` 를 response 에 노출하는 것은 기존 undo 워크플로 (`/api/templates/applied/[id]/undo`) 와 자연스럽게 맞물리며, 클라이언트가 Apply 후 별도 목록 조회 없이 즉시 Undo 호출 가능 → APPLY-FAIL 조사 중에도 디버깅 편의 증가.

## Concerns

없음. 최소 diff + 전수 게이트 PASS + live contract 증거 확보. 커밋 진행 허용.
