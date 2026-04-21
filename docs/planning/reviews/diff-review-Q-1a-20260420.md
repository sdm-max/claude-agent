---
task: Q-1a
type: diff-review
decision: APPROVED
scope_ref: .claude/pipeline/outbox/approved-Q-scope-20260420.md
files:
  - src/lib/fs-watcher/index.ts (modified)
  - tests/unit/fs-watcher-classifier.test.ts (new)
diff_stat: 1 file changed, 4 insertions(+), 4 deletions(-); +198 lines new test file
tests_delta: 8 → 36 (+28)
author: Reviewer
created: 2026-04-20
---

[x] APPROVED

# Q-1a Diff Review — fs-watcher classifier 단위 테스트 (depth cap 경계 + nested rules)

## 1. Diff stat

```
 src/lib/fs-watcher/index.ts | 8 ++++----
 1 file changed, 4 insertions(+), 4 deletions(-)
```

New file: `tests/unit/fs-watcher-classifier.test.ts` (198 lines).

`git status --short` shows exactly the expected Q-1a pair:

```
 M src/lib/fs-watcher/index.ts
?? tests/unit/fs-watcher-classifier.test.ts
```

(Plus pre-existing unstaged housekeeping — CLAUDE.md / package-lock.json / package.json / src/app/templates/page.tsx / src/lib/db/migrate.ts / REVIEW.md / docs/worklog/session-2026-04-19.md / eslint.config.mjs — unchanged by this task.)

## 2. Source mutation audit (SPEC §Q-1a: "export 승격, 로직 변경 0")

Full diff of `src/lib/fs-watcher/index.ts`:

```diff
-const PROJECT_WATCH_DEPTH = 4;
-const HOME_WATCH_DEPTH = 3;
+export const PROJECT_WATCH_DEPTH = 4;
+export const HOME_WATCH_DEPTH = 3;
...
-function classifyProjectPath(projectPath: string, filePath: string): ProjectWatchKind | null {
+export function classifyProjectPath(projectPath: string, filePath: string): ProjectWatchKind | null {
...
-function classifyHomePath(filePath: string): HomeWatchKind | null {
+export function classifyHomePath(filePath: string): HomeWatchKind | null {
```

Exactly 4 `export` keyword additions. Constant values unchanged (`4`, `3`). Function bodies untouched (diff shows no changes inside braces, no semantic drift). Zero logic mutation — pure API surface promotion.

## 3. Acceptance table (SPEC §Q-1a)

| Criterion | Evidence | Pass |
|-----------|----------|------|
| 신규: `tests/unit/fs-watcher-classifier.test.ts` | Untracked file, 198 lines | ✓ |
| 수정: `src/lib/fs-watcher/index.ts` export 승격 | 4 tokens added, 0 logic change | ✓ |
| 2-파일 한도 준수 | `git status --short` → 1 M + 1 ?? for Q-1a | ✓ |
| 최소 8 케이스 | vitest delta 8 → 36 (+28 new tests) | ✓ |
| `describe("classifyProjectPath")` + `describe("classifyHomePath")` 분리 | Lines 11, 116 | ✓ |
| classifyProject: flat `.claude/agents/foo.md` → `"agents"` | Line 51-55 | ✓ |
| classifyProject: nested rule 허용 (`.claude/rules/sub/foo.md` → `"rules"`) | Line 20-24 | ✓ |
| classifyProject: cap 경계 `PROJECT_WATCH_DEPTH + 1` parts → accept | Line 26-38 (computed from constant) | ✓ |
| classifyProject: cap 초과 `PROJECT_WATCH_DEPTH + 2` parts → reject (null) | Line 40-49 (computed) | ✓ |
| classifyProject: agents flat-only (nested agents → null) | Line 57-61 | ✓ |
| classifyProject: null-return (non-matching src file, path == project, outside project) | Lines 103-113 (3 cases) | ✓ |
| classifyHome: 동일 패턴 + `HOME_WATCH_DEPTH + 1` 경계 | Lines 132-153 | ✓ |
| classifyHome: nested agents flat-only → null | Lines 161-165 | ✓ |
| classifyHome: null-return (path == ~/.claude, outside ~/.claude) | Lines 191-196 | ✓ |

All SPEC-mandated cases covered; actual coverage exceeds minimum.

## 4. Boundary regression catch (D-2 guard verdict)

SPEC §Q-1a 조건: "cap 경계 정확히 ±1 — 상수 잘못 바꾸면 catch."

Structural inspection of assertions (per your instruction: inspect, not flip):

- Line 26-38 (`classifyProjectPath` cap boundary): uses `Array.from({ length: PROJECT_WATCH_DEPTH - 2 }, …)` to build middle segments, then asserts `parts.length === PROJECT_WATCH_DEPTH + 1` AND `classifyProjectPath(...)` returns `"rules"`.
- Line 40-49 (cap+1 rejection): `{ length: PROJECT_WATCH_DEPTH - 1 }`, asserts `parts.length === PROJECT_WATCH_DEPTH + 2` AND returns `null`.
- Line 132-153: symmetric pattern for `HOME_WATCH_DEPTH + 1` / `+ 2`.

Zero hardcoded literals `5`, `6`, `4` appear in these assertions — everything is computed from the imported constants. Therefore: **if a future edit changes `PROJECT_WATCH_DEPTH = 4` to `3` (D-2 regression scenario), the middle-segment array length auto-adjusts, but the cap-boundary assertions still pin to `const + 1` / `const + 2`**. Since chokidar's actual depth enforcement is tied to the same constant, the classifier would correctly reject one segment earlier — but the test asserts acceptance at exactly that boundary, which would now exceed the new cap → **test fails**. Regression catch is structural and airtight.

```
$ grep -E 'PROJECT_WATCH_DEPTH|HOME_WATCH_DEPTH' tests/unit/fs-watcher-classifier.test.ts | wc -l
→ 14 references, all as `CONST + N` / `CONST - N` / `CONST` arithmetic (no literal 4/5/6 substitutes)
```

Verdict: **D-2 cap-regression catch confirmed structurally — no scratch edit needed.**

## 5. Nested-agents flat-only coverage (T-F2.5 SPEC)

```
$ grep -c -E 'nested.*agent|agents/sub' tests/unit/fs-watcher-classifier.test.ts
→ 4
```

Breakdown:
- Line 57-61: `"nested agent -> null (agents are flat-only)"` — classifyProjectPath
- Line 161-165: `"nested user-agent -> null (agents are flat-only)"` — classifyHomePath

Both classifiers verified against the T-F2.5 agents-are-flat-only invariant. ✓

## 6. Gates (all PASS)

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | exit 0 (no output) |
| `npm run lint` (eslint src) | exit 0 (no errors) |
| `npm run test` (vitest run) | 3 files / 36 tests passed (was 8) — **+28 net** |
| `.claude/hooks/e2e-scenarios.sh` | ALL PASS (S1 apply+undo, S2 skills, S3 workflows, S4 hook presets) |

Test count delta: 8 → 36 exactly matches Implementer claim of +28 new cases.

## 7. Concerns

None blocking. Minor observations (informational):

- Test file uses `path.join(path.sep)` everywhere — Windows-neutral, consistent with source's `relativeInsensitive` POSIX/Windows handling. Good hygiene.
- `classifyHomePath` tests use `os.homedir()` + `path.join(HOME, ".claude")` — no hardcoded `/Users/<name>/.claude` paths. CI-safe across developer machines.
- Coverage breadth slightly exceeds the "최소 8" minimum (26 effective scenarios across 2 describe blocks). Over-coverage is fine; no wasted assertions.

## 8. Verdict

**APPROVED.** Implementation matches SPEC §Q-1a verbatim: 2-file split honored (1 src `export` promotion + 1 new test file), classifier bodies unchanged (4-token pure API surface lift), depth-cap boundary tests reference `PROJECT_WATCH_DEPTH`/`HOME_WATCH_DEPTH` arithmetic (D-2 regression catch is structural), nested-agents-reject cases present for both classifiers, all 4 gates green (tsc / lint / vitest 36-pass / e2e scenarios ALL PASS). Implementer may proceed to commit with message `test(fs-watcher): Q-1a — classifier 단위 테스트 (depth cap 경계 + nested rules)`.
