---
task: D-5.1
type: diff-review
decision: APPROVED
reviewer: Reviewer
reviewed: 2026-04-20
commit_intent: "fix(undo): D-5.1 — extraFiles 언링크 + shared-path 인지"
files_changed: 2
scope_ref: approved-D-5-scope-20260420.md
---

# diff-review-D-5.1 — Undo extraFiles unlink + shared-path awareness

## 판정

[x] APPROVED

AC 전수 충족. 2 파일 한도 준수. 라이브 shared-path 시퀀스 정확히 작동.

## Diff stat

| 파일 | +/- | 비고 |
|------|-----|------|
| `src/lib/templates/undo-files.ts` | +124 (new) | apply-files.ts 대칭 helper |
| `src/app/api/templates/applied/[id]/undo/route.ts` | +46 / -4 | extraFiles 블록 + 응답 3 필드 |

합계 2 파일 변경. 범위 내.

## AC 검증

| # | AC | 결과 |
|---|----|------|
| 1 | `extraFiles` JSON parse (null/malformed → empty, 실패 아님) | `parseExtraFilesColumn` try/catch + Array guard, 충족 |
| 2 | Same scope/projectId active 로우 union 집계 (`projectId IS NULL` → `isNull`) | route.ts 46~58 `otherConditions`에 `isNull(projectId)` 유지, `extraFiles` select 추가, `collectSharedResolvedPaths` 에서 union 계산, 충족 |
| 3 | Self path ∉ union 만 unlink | `undoExtraFiles` 97~100 `sharedResolved.has(abs)` → `keptSharedFiles`, 충족 |
| 4 | Path guard apply-files 대칭 (`..` / abs / `~/` / basePath join) | `resolveSafePath` 19~26 — apply-files.ts `resolveExtraFilePath` + 가드 2종과 동일 semantics. 대칭 충족 |
| 5 | 응답 shape `{success, config, removedFiles, keptSharedFiles, errors}` | route.ts 117~122, 충족 (Q5 확정) |
| 6 | I/O 에러 수집 (ENOENT 포함), HTTP 200 | `undoExtraFiles` 115~119 try/catch로 `errors[]` push, throw 없음. 충족 |
| 7 | pre-unlink snapshot → `file_versions` 저장 | route.ts 100~110 callback 으로 `readFileSync` → `db.insert(fileVersions)`. Amendment #2 충족 |

추가 관찰:
- `errors[]` 빈 배열도 항상 포함 — Amendment #3 충족.
- `success: true` 유지 — 기존 contract 보존.
- helper는 순수 함수 3개 + orchestrator 1개로 분해 — D-5.2 단위 테스트에 우호적.

## Gate 결과

| Gate | 결과 |
|------|------|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 (eslint src, 무출력) |
| `npm run test` | 8 files / 65 tests pass (757ms) |
| `.claude/hooks/e2e-scenarios.sh` | ALL PASS (S1~S6) |

## 라이브 HTTP shared-path 시퀀스

Project id: `I77rqshvWTrDtFA6RKGGu` (`/tmp/test-claude-project`).
Template id: `skill-testing` (카탈로그의 `testing-patterns` skill).

### Step a — 초기 상태
`ls /tmp/test-claude-project/.claude/skills/` → `No such file or directory` (cleaned).

### Step b — Apply 2회
```
A1=QQH4GXdHZ1pKjH1tiDbFA
A2=5F3AQxyV2b1lqK2Z2Q09G
```
`ls .../testing-patterns/SKILL.md` → 존재 (29 lines).

### Step c — First undo (A1)
```json
{
  "success": true,
  "removedFiles": [],
  "keptSharedFiles": [".claude/skills/testing-patterns/SKILL.md"],
  "errors": []
}
```
`ls .../testing-patterns/SKILL.md` → 여전히 존재. ✓

### Step d — Second undo (A2)
```json
{
  "success": true,
  "removedFiles": [".claude/skills/testing-patterns/SKILL.md"],
  "keptSharedFiles": [],
  "errors": []
}
```
`ls .../testing-patterns/SKILL.md` → `No such file or directory`. ✓

Shared-path dance 정확히 AC 기대대로 동작. `removedFiles` ↔ `keptSharedFiles` 분기 완전.

## 기타

- Scope: 변경 파일 정확히 2개 — `git status --short`: `M route.ts`, `?? undo-files.ts`.
- 기타 `M`된 파일들 (CLAUDE.md, package*.json, templates/page.tsx, migrate.ts, fs-watcher/index.ts) 은 D-5.1 범위 외 사전 상태 — 이 task가 건드리지 않음.

## 다음 단계

D-5.2 (test-only 파일 1개) 진행 가능. 그 전에 본 커밋 수행 권장 순서:
1. D-5.1 commit (`fix(undo): D-5.1 — ...`).
2. D-5.2 scope 에 맞는 새 inbox 제출 (Implementer).
