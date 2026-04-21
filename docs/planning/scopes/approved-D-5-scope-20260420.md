---
task: D-5
type: scope-approval
decision: APPROVED
reviewer: Reviewer
reviewed: 2026-04-20
inbox_refs:
  - question-D-5-scope-20260420.md
  - investigation-D-5-20260420.md
commits: 3
files_per_commit_max: 2
---

# approved-D-5-scope — Undo extraFiles + 렌더 가드 fix sprint

## 판정

[x] APPROVED

3-task 분할, 2파일 한도, Reviewer 영역 범위, 모두 규율 준수. 바로 진행 가능.

## 질문 응답

### Q1 — 3 task 분할 OK?
**YES**. D-5.1 (code fix, P1) / D-5.2 (test, P1) / D-5.3 (UI guard, P2) 책임 경계 명확. 각 독립적으로 review 가능.

### Q2 — `undo-files.ts` helper 분리?
**APPROVED helper 분리**. 근거:
- apply-files.ts 와 symmetric 배치 (readability + discoverability).
- Path guard 로직이 `..` / abs / `~/` expansion 3종 — unit 테스트 격리 필수.
- Route file은 DB/HTTP orchestration 전담 (SRP).
- 2파일 한도 내 유지됨.

### Q3 — 5 테스트 케이스 충분?
**CONDITIONALLY YES**. 제안 5 케이스 커버하되 **1 케이스 추가 요망**:
- (6) `~/`-prefixed path → home root 기준 unlink. `extraFiles` home-scope 경로가 실세계에서 빈번 (user-scope skill 템플릿). guard 로직의 `~/` branch 가 테스트로 고정되어야 regression 방어.

### Q4 — D-5.3 본 sprint 포함?
**본 sprint 포함 유지**. P2지만:
- D-5.1과 사용자 workflow가 연속 (apply check → undo).
- 단일 파일·단순 JSX 재구조화 — 리스크 낮음.
- investigation E-1 findings 상 사용자 이미 인지. 미뤄서 얻는 이득 없음.
- 별 sprint로 뽑을 경우 overhead(scope-approval 1회 + diff-review 1회) > 이득.

### Q5 — 응답 shape 확장?
**APPROVED**. 정확한 shape:
```json
{
  "success": true,
  "config": "...",
  "removedFiles": ["string"],
  "keptSharedFiles": ["string"],
  "errors": [{"path": "string", "error": "string"}]
}
```
- `success: true` 유지 (기존 contract 깨지 않음).
- `errors` 배열은 빈 배열이어도 포함 (client는 `.length` 체크).
- errors 있어도 HTTP 200 유지 (부분 실패 투명 보고).
- settings subtract 실패는 별건 — 400/500 유지.

## Per-task Acceptance Criteria

### D-5.1 — `fix(undo): D-5.1 — extraFiles 언링크 + shared-path 인지`

**Files** (max 2):
- `src/lib/templates/undo-files.ts` (new)
- `src/app/api/templates/applied/[id]/undo/route.ts` (edit)

**Functional AC**:
1. `record.extraFiles` JSON parse (null/malformed → empty array + warn, 실패 아님).
2. Same (scope, projectId) active rows(자기 제외)에서 `extraFiles` 경로 union 집계. `projectId IS NULL` 는 `isNull` 사용.
3. 자기 파일 path ∉ union 만 unlink.
4. Path guard **apply-files.ts 와 동일**: `..` 포함 skip, `path.isAbsolute` skip, `~/` → `os.homedir()` join, 나머지 → `basePath` join.
5. 응답 shape Q5 확정대로.
6. I/O 에러 수집만 (ENOENT 포함 모두 `errors[]` 에 push), HTTP 200.
7. `writeDiskWithSnapshot` symmetry — undo의 unlink도 snapshot 남길 필요 없음 (읽기만 가능한 경우 skip). `fs.unlink` 직접 사용 OK. 단, file_versions 에 pre-unlink snapshot 1회 더 저장 (재-apply 시 복원 가능).

**Verification**:
- `npm run lint` 0 error, `npm run build` pass, `npm run test` pass (D-5.2 포함).
- 라이브 repro: 실제 apply (skill 템플릿 e.g. `testing-patterns`) → `ls .claude/skills/testing-patterns/SKILL.md` → undo → `! -e` 확인 + response body removedFiles 포함.
- Shared-path: 같은 path 2회 apply → 첫 undo 후 파일 잔존, 둘째 undo 후 삭제.

### D-5.2 — `test(undo): D-5.2 — extraFiles 언링크 회귀`

**Files** (max 1):
- `tests/unit/undo-extra-files.test.ts` (new)

**Functional AC**:
Q-2 fixture 패턴 (in-memory SQLite + tmp dir) 재사용. 6 케이스 (Q3 추가 1건 포함):
1. Single apply → undo → 모든 extraFiles unlink 확인.
2. 2 applies overlapping path → 첫 undo keep, 둘째 undo remove.
3. Scope 격리 — 다른 scope 같은 경로는 shared 아님.
4. Path guard — `..` 포함 stored path → unlink 시도 안 함 (errors에도 포함 안 함, 조용히 skip).
5. ENOENT — apply 후 수동 삭제 → undo 시 다른 삭제는 계속, errors[] 에 기록되되 HTTP 200.
6. **[추가]** `~/`-prefixed path (`~/.claude/test.md`) → `os.homedir()` 기준 unlink 확인.

**Verification**:
- `npm run test -- undo-extra-files` all pass.
- Coverage: `undo-files.ts` 모든 branch hit (guard, shared, home, error).

### D-5.3 — `fix(templates-ui): D-5.3 — settings·extraFiles 체크리스트 가드 분리`

**Files** (max 1):
- `src/app/templates/page.tsx` (edit)

**Functional AC**:
1. 955행 `Object.keys(detail.settings).length > 0` 가드 내부에서 extraFiles 블록을 **밖으로** 분리.
2. 결과 3 케이스 모두 올바른 렌더:
   - settings only → settings checklist only.
   - settings + extraFiles → 둘 다.
   - extraFiles only (settings: `{}`) → extraFiles checklist only (이전에는 hidden).
3. settings excluded warn 문구(1037행 `detailExcludedKeys`) 는 settings 가드 안 유지.
4. 외곽 `<div className="space-y-4">` wrapping 유지 — Dialog 레이아웃 보존.

**Verification**:
- E2E: `testing-patterns` 템플릿 (settings `{}` + extraFiles) detail 열어서 체크리스트 렌더 확인.
- 기존 `hooks-rm-protection` 같은 settings-only 템플릿 regression 없음.

## Commit 순서 (엄수)

1. **D-5.1** — code fix 먼저. 테스트 없이 먼저 나가면 regression 증명 불가하지만, test를 먼저 올리면 red commit 금지 규율 위반. 규율상 1→2 순서가 맞음 (코드 + test 동시 변경 금지 + 2파일 한도 동시 준수).
2. **D-5.2** — D-5.1 의 구현을 고정하는 테스트. Red → Green 순서 **불가**. D-5.1 구현이 이미 green 상태여야 함.
3. **D-5.3** — 독립 UI fix. 1,2와 기능적 의존 없음. 마지막 배치가 review 부담 최소.

각 commit 전 `outbox/diff-review-D-5.N-*.md` `[x] APPROVED` 필수 (Guard 0c).

## Amendments

1. **Q3 보강** — 테스트 6 케이스 (home path 케이스 추가).
2. **D-5.1 스펙 명시** — `writeDiskWithSnapshot` 대신 `fs.unlink` + pre-unlink snapshot 1회 저장 (re-apply 시 복원 가능). investigation 에 없던 사항. 재-apply 시나리오 대비.
3. **응답 errors 배열 항상 포함** — 빈 배열이어도. client null-check 부담 제거.

## 참고

- D-2 (기존 P1) 와 D-5.1 은 동일 이슈 — re-classification 아닌 fix sprint. 완료 시 D-2 closed로 backlog 갱신.
- C-3 → backlog C-2 로 통합. 별 sprint 소요.
- E-1 → D-5.3 으로 흡수.
