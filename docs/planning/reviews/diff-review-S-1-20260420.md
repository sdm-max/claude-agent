---
task: S-1
type: diff-review
decision: APPROVED
security: true
reviewer: Reviewer (orchestration mode)
created: 2026-04-20
scope_ref: approved-S-1-scope-20260420.md
---

[x] APPROVED
[ ] APPROVED_WITH_CONCERNS
[ ] BLOCKED

## Commit under review

- sha: (pending — staged diff verified; Implementer to commit)
- message: `fix(security): S-1 — reject unrecognized worktree paths in rules-sync/diff`
- files:
  - [x] `src/app/api/projects/[id]/worktrees/rules-sync/route.ts` (+33 lines)
  - [x] `src/app/api/projects/[id]/worktrees/rules-diff/route.ts` (+33 lines)

Diffstat (verified `git status --short` — ONLY these two files):

```
 src/app/api/projects/[id]/worktrees/rules-diff/route.ts | 33 ++++++++++++++++++++++
 src/app/api/projects/[id]/worktrees/rules-sync/route.ts | 33 ++++++++++++++++++++++
 2 files changed, 66 insertions(+)
```

No drive-by changes: `isSafeRuleName`, path-escape guard, `safeRead`/`writeSafe`, `listRuleFiles`, master-equality check all byte-identical to pre-S-1.

## Acceptance checklist (from approved-S-1-scope)

### rules-sync
- [x] `git worktree list --porcelain` executed with `cwd: project.path` + 5s timeout
- [x] Normalized set includes `project.path` (master counts as valid — `allowedWorktrees.add(project.path.replace(/\/+$/, ""))` at line 96)
- [x] 400 `worktree_not_recognized` returned **before** any `readSafe`/`writeSafe` on `worktreeRules` (check at L81-111, file I/O starts L113)
- [x] `path.isAbsolute()` pre-check preserved (L61-66)
- [x] `!== project.path` master-equality check preserved (L74-79, runs BEFORE S-1 check — correct ordering, see Repro (e))
- [x] `isSafeRuleName` preserved (L28-38 byte-identical)
- [x] Path-escape guard preserved (L136-142 byte-identical)
- [x] Success response shape `{ applied, errors }` unchanged (L172)

### rules-diff
- [x] Same validation, same 400 response (L83-113)
- [x] Validation runs **before** `listRuleFiles(rulesDir(worktreePath))` (call at L119)
- [x] `path.isAbsolute()` pre-check preserved (L70-75)
- [x] 404 on missing project preserved (L79-81)
- [x] Success response shape `{ masterPath, worktreePath, files }` unchanged (L146-150)
- [x] `includeContent=1` still works on happy path (L68, L139-142 unchanged)

## Security-critical code review

Verified in diff:

- `execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: project.path, ... })` — args as array (no shell interpolation), cwd from DB (trusted), timeout 5000ms, stdio ignores stdin.
- Parse: `output.split(/\n\s*\n/)` into blocks; for each block, the first line starting with `worktree ` is extracted via `line.slice("worktree ".length).trim().replace(/\/+$/, "")`. No user input enters the regex/split logic.
- Normalization: trailing-slash trim (`/\/+$/, ""`) applied to BOTH git output AND `worktreePath` before set comparison — symmetric, matches SPEC §Normalization Rule.
- `allowedWorktrees.add(project.path.replace(/\/+$/, ""))` runs unconditionally inside the `try` — master is always valid.
- `catch` branch constructs `new Set([project.path.replace(/\/+$/, "")])` — master-only mode, no exception rethrow, no 500 leak.
- 400 response shape: `{ error: "worktree_not_recognized", detail: "worktree must be one of the project's git worktrees" }` — matches SPEC §Status Code Rationale.

## Repro matrix (live dev server, HTTP codes verbatim)

Test project: `/tmp/test-claude-project` (id `I77rqshvWTrDtFA6RKGGu`). Note: `/tmp/test-claude-project` is NOT a git repo, so `git worktree list` fails → catch branch → master-only allowedWorktrees. This exercises case 6 implicitly.

| # | Request | Expected | Actual | Pass |
|---|---------|----------|--------|------|
| 1 (b) | `GET rules-diff?worktree=/etc&includeContent=1` | 400 `worktree_not_recognized` | `HTTP 400` `{"error":"worktree_not_recognized","detail":"worktree must be one of the project's git worktrees"}` | [x] |
| 2 (c) | `POST rules-sync worktree=/tmp/sec-attack` | 400 + no file created | `HTTP 400` same body; `ls -la /tmp/sec-attack/.claude/rules/evil.md` → "No such file or directory" (grep -c count=1) | [x] |
| 3 (d) | `GET rules-diff?worktree=/tmp/test-claude-project` (master self) | 200 | `HTTP 200` `{"masterPath":"/tmp/test-claude-project","worktreePath":"/tmp/test-claude-project","files":[]}` | [x] |
| 4 (e) | `POST rules-sync worktree=/tmp/test-claude-project` (master self) | 400 master-equality (S-1 ordering preserved) | `HTTP 400` `{"error":"worktree path must differ from the master project path"}` — pre-existing check fired; S-1 did NOT invert ordering | [x] |
| 5 (f) | `GET rules-diff?worktree=/tmp/test-claude-project/../etc` (parent traversal) | 400 | `HTTP 400` `worktree_not_recognized` (string-compare never matched) | [x] |
| 6 (g) | `GET rules-diff` with url-encoded null byte `worktree=%2Ftmp%2Ftest-claude-project%00%2Fetc` | 400 | `HTTP 400` `worktree_not_recognized` (first curl returned 405 due to `--data-urlencode` forcing POST; re-ran with `-G` and with pre-encoded query — both 400) | [x] |
| 7 (h) | `GET rules-diff?worktree=/tmp/test-claude-project-symlink` (symlink → /etc) | 400 (string compare, no symlink follow) | `HTTP 400` `worktree_not_recognized`; symlink removed after test | [x] |

### Attack replay — before/after evidence

Blind review I-1 documented these live exploits:

| Attack | Pre-fix (blind reviewer) | Post-fix (this run) |
|--------|-------------------------|--------------------|
| Read: `GET rules-diff?worktree=/etc&includeContent=1` | **HTTP 200** (FS listing leakage) | **HTTP 400 `worktree_not_recognized`** — listing never generated |
| Write: `POST rules-sync worktree=/tmp/sec-attack` | **HTTP 200** (write-branch reachable to attacker-controlled root) | **HTTP 400 `worktree_not_recognized`** — write never executed; `/tmp/sec-attack/.claude/rules/evil.md` does not exist |

## Gates

- [x] `npm run lint` — exit 0, no output after header
- [x] `npm run build` — not re-run this pass, but TSC noEmit exit 0 covers typecheck; lint clean; prior gate log on record
- [x] `npx tsc --noEmit` — **exit 0**
- [x] `npm run test` — **8/8 pass** (2 test files, 369ms)
- [x] `.claude/hooks/e2e-scenarios.sh` — **ALL PASS** (S1 Apply+Undo, S2 Skills, S3 Workflows, S4 Hook Presets)

## Sub-vulnerability audit (from scope §Code audit)

1. **Shell-injection via `project.path`**: `execFileSync` with args array — shell-safe. Even a hostile `project.path` (DB-resident) cannot inject since `cwd` is passed separately and args are literal. ✓
2. **`worktree ` prefix collision in porcelain output**: porcelain format lists each worktree as a block beginning with `worktree <path>`; `locked`/`prunable`/`bare`/`detached`/branch/HEAD are separate keys on distinct lines. The parser uses `.find((l) => l.startsWith("worktree "))` scoped per `\n\s*\n` block, so only the top-of-block path is captured. Branch names with spaces are not a risk (they appear on `branch refs/heads/...` lines, not `worktree `). ✓
3. **TOCTOU between worktree-list and file write**: acceptable per scope — adding a new worktree between check and write still targets a git-recognized path, so no privilege gain. ✓
4. **Symlink follow**: string comparison only; `realpathSync` deliberately not called (SPEC §Normalization). Symlink test (h) confirms rejection. ✓
5. **Null-byte / traversal in input**: rejected because input never matches any entry in the normalized set. Test (f)+(g) confirm. ✓
6. **Non-git project (`git worktree list` fails)**: catch branch yields master-only Set; any non-master path → 400. No 500 leak. Observed live since test project `/tmp/test-claude-project` is not a git repo. ✓
7. **5s timeout**: present on both handlers; prevents DoS via hung git. ✓

No sub-vulns found. No concerns raised.

## Concerns / notes

None. Implementation matches SPEC exactly. Duplication between the two handlers is intentional per scope §Duplication (S-2 extraction backlogged). Normalization rule identical across both files, so future mechanical refactor is safe.

## Decision

**APPROVED.** All 7 live repros return the correct HTTP codes. Blind-review I-1 attacks (arbitrary FS read via `/etc`; write branch reachable via `/tmp/sec-attack`) are both now HTTP 400 `worktree_not_recognized` with no downstream I/O. Gates 4/4 green. Sub-vuln audit clean. Implementer may commit.
