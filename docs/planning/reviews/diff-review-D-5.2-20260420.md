---
task: D-5.2
type: diff-review
decision: APPROVED
reviewer: Reviewer
reviewed: 2026-04-20
commit_intent: "test(undo): D-5.2 — undo-files 유닛 테스트 (6 cases)"
files_changed: 1
scope_ref: approved-D-5-scope-20260420.md
---

# diff-review-D-5.2 — Undo extraFiles 유닛 테스트

## 판정

[x] APPROVED

SPEC §D-5.2 요구 6 케이스 전수 구현 + `parseExtraFilesColumn` 브랜치 커버리지 보강.
테스트 파일 1개만 신규. src/ 변경 없음. 모든 게이트 pass, 잔여물 없음.

## Diff stat

| 파일 | +/- | 비고 |
|------|-----|------|
| `tests/unit/undo-extra-files.test.ts` | +279 (new) | 9 it / 7 describe |

합계 1 파일 신규. 범위 내 (test-only).

## SPEC 6 케이스 검증

| # | SPEC 케이스 | 구현 위치 | 결과 |
|---|------------|----------|------|
| 1 | single apply, no shared | `describe` L67~87 | removedFiles=2, errors=[], 파일 unlink 확인 |
| 2 | overlap preserved → removed | L89~129 (2 it) | 1st: keptSharedFiles, 2nd: removedFiles, 파일 존재/부재 검증 |
| 3 | scope isolation via sharedResolved | L131~168 | 타 scope basePath로 resolve → `has(targetAbs)===false` sanity + 실 unlink |
| 4 | path guard `..` / absolute | L170~196 (2 it) | `resolveSafePath` null + silent skip (errors=[]) |
| 5 | ENOENT 진행 지속 | L198~224 | ghost 파일 errors[0].error `/ENOENT/i`, present 파일은 정상 unlink |
| 6 | `~/` home 경로 | L226~265 | UUID 폴더 + afterAll safety net, resolveSafePath 기대값 + 실 unlink |

추가: `parseExtraFilesColumn` null/undefined/empty/malformed/non-array 5분기 커버리지 (L271~279).

## 테스트 격리 / 안전장치

- `beforeEach` — `fs.mkdtempSync(os.tmpdir(), "undo-test-")` 고유 디렉토리
- `afterEach` — `fs.rmSync(tmpBase, recursive:true, force:true)` best-effort
- Case 6 home path — `randomUUID()` 접미사로 충돌 방지 + 개별 try/finally 클린업 + `afterAll` safety net (`createdHomeDirs[]`)
- Case 3 other scope — try/finally 로 `undo-other-scope-*` rmSync

## Gate 결과

| Gate | 결과 |
|------|------|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 (eslint src, 무출력) |
| `npm run test` | 9 files / 74 tests pass (631ms) — **65 → 74 (+9)** |
| `.claude/hooks/e2e-scenarios.sh` | ALL PASS (S1~S6) |

## 클린업 검증

| 체크 | 명령 | 결과 |
|------|------|------|
| home-dir 잔여물 | `ls ~/.claude/skills/ \| grep -i test-undo \| wc -l` | 0 |
| tmpdir base | `ls /tmp \| grep -i undo-test- \| wc -l` | 0 |
| tmpdir other scope | `ls /tmp \| grep -i undo-other-scope- \| wc -l` | 0 |

테스트 종료 후 사용자 홈/tmp 어디에도 잔여 디렉토리 없음.

## 회귀 탐지 가치

D-5.1 `src/lib/templates/undo-files.ts` 가 unlink 로직을 잃어 구버전으로 회귀한다면:
- Case 1 — `removedFiles` 비게 되어 fail
- Case 2 두 번째 it — `existsSync(sharedAbs)===false` fail
- Case 6 — `existsSync(homeAbs)===false` fail
- Case 5 — `removedFiles` 에서 present.md 누락 fail

`sharedResolved` 가드가 제거된다면:
- Case 2 첫 번째 it — `keptSharedFiles`가 비고 파일이 사라져 fail

경로 가드가 느슨해진다면:
- Case 4 `..` / absolute — `removedFiles` 비어있지 않게 되어 fail

회귀 탐지 커버리지 충분.

## 기타

- `git status --short`: `?? tests/unit/undo-extra-files.test.ts` 만 D-5.2 변경분. 나머지 `M` (CLAUDE.md, package-lock.json, package.json, templates/page.tsx, migrate.ts, fs-watcher/index.ts) 및 `??` (REVIEW.md, docs/worklog/session-2026-04-19.md, eslint.config.mjs) 는 D-5.2 범위 외 사전 상태.
- `src/` 변경 없음. test-only scope 준수.
- 9 test cases = 6 SPEC + 2 (Case 2 split) + 1 (parseExtraFilesColumn) — SPEC 최소 6 초과 달성.

## 다음 단계

1. D-5.2 commit (`test(undo): D-5.2 — ...`)
2. D-5.3 진행 (SPEC 나머지 항목).
