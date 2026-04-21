---
task: S-1
type: scope-approval
decision: APPROVED
reviewer: Reviewer (orchestration mode)
created: 2026-04-20
scope_ref: "inline: blind-review findings I-1 (Important #3, security / path injection)"
severity: security (arbitrary read + write branch reachable)
---

[x] APPROVED

## Summary

Emergency security task. Blind independent reviewer confirmed live repros:

- `GET /api/projects/[id]/worktrees/rules-diff?worktree=/etc&includeContent=1` → **200** (arbitrary FS read)
- `POST /api/projects/[id]/worktrees/rules-sync` with `worktree=/tmp/...` → **200** (write branch reachable, escape prevented only by downstream `isSafeRuleName` + path-escape guard — but the worktree root is attacker-controlled)

Root cause: both routes accept any absolute path that is merely `!== project.path`. There is no cross-check that the path is an actual git worktree of the project.

Sibling `src/app/api/projects/[id]/worktrees/route.ts` already performs
`execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: project.path, ... })` and parses via `parseWorktreePorcelain`. Pattern is directly reusable inline.

## Scope (2 files, 1 commit)

### File 1 — `src/app/api/projects/[id]/worktrees/rules-sync/route.ts`
**After** the existing project lookup and the `worktreePath !== project.path` check, **before** any filesystem mutation:

1. Run `execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: project.path, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], timeout: 5000 })`.
2. Parse the output (inline parse or duplicate the `parseWorktreePorcelain` logic — duplication acceptable here; see §Duplication below).
3. Build a normalized set of valid worktree paths: each entry path **and** `project.path`, all with trailing slashes stripped.
4. Compare incoming `worktreePath.replace(/\/+$/, "")` against that set.
5. If not a member → return `NextResponse.json({ error: "worktree_not_recognized", detail: "<context>" }, { status: 400 })`.
6. If `git worktree list` itself fails (non-git project) → return `400` with `{ error: "worktree_not_recognized", detail: "<git stderr snippet>" }`. Do not 500.

### File 2 — `src/app/api/projects/[id]/worktrees/rules-diff/route.ts`
Same validation, same 400 response shape. Must run **before** `listRuleFiles(...)` / any `safeRead` calls (i.e., before any filesystem I/O beyond what the DB lookup already does).

### Duplication policy
Shared helper refactor is **deferred to S-2 (backlogged)**. Inlining the git exec + parse in both routes is explicitly allowed for urgency. Reviewer preference: both routes should use the **same normalization rule** (trailing-slash strip only, no symlink resolution, no `path.resolve`) so future S-2 extraction is mechanical.

## Acceptance Criteria (per file)

### rules-sync
- [ ] `worktreePath` argument must match one of the paths from `git worktree list --porcelain` (normalized: trailing slashes stripped) **OR** match `project.path` (master is counted as a valid worktree). Otherwise return `400 { error: "worktree_not_recognized", detail: ... }`.
- [ ] Validation runs **before** any `writeSafe` / `readSafe` on `worktreeRules`.
- [ ] Existing behaviors unchanged:
  - `path.isAbsolute()` pre-check
  - `!== project.path` master-equality check
  - `isSafeRuleName` per-entry check
  - path-escape guard (`masterAbs.startsWith(masterRules + path.sep)` etc.)
  - Response shape on success: `{ applied, errors }`

### rules-diff
- [ ] Same cross-check. `400 worktree_not_recognized` returned **before any file I/O** (before `listRuleFiles(rulesDir(worktreePath))`).
- [ ] Existing behaviors unchanged:
  - `path.isAbsolute()` pre-check
  - 404 on missing project
  - Response shape on success: `{ masterPath, worktreePath, files }`
  - `includeContent=1` still works on happy path

## Repro Matrix (must all hold post-fix)

| # | Request | Pre-fix | Post-fix (required) |
|---|---------|---------|---------------------|
| 1 | `POST rules-sync` with `worktree=/etc` | 200 | **400 `worktree_not_recognized`** |
| 2 | `GET rules-diff?worktree=/tmp/anything&includeContent=1` | 200 (leaks FS) | **400 `worktree_not_recognized`** |
| 3 | `GET rules-diff?worktree=<actual_git_worktree_of_project>` | 200 | **200** (happy path preserved) |
| 4 | `POST rules-sync` with `worktree=<actual_git_worktree>` and valid `files[]` | normal | **normal** (unchanged behavior) |
| 5 | Project with no extra worktrees (plain git repo, never ran `git worktree add`) — request against `<project.path>` | (would be rejected by master-equality) | **still rejected by master-equality 400** (unchanged); anything else → **400 worktree_not_recognized** |
| 6 | Project path is not a git repo at all (`git worktree list` fails) | 200 on arbitrary paths | **400 `worktree_not_recognized`** (git failure is treated as "no valid worktrees other than master", so any non-master path rejected) |

## Status Code Rationale

- **400 `worktree_not_recognized`** — not 403. The claim is "this input is malformed for this project," not an authorization boundary. Blind reviewer specified "reject" without a specific code; 400 matches the existing malformed-input pattern in both routes (see existing `"worktree (absolute path) is required"` and `"worktree path must differ from the master project path"` — both 400).
- Response shape `{ error: "<snake_case_code>", detail?: "<human string>" }` is consistent with existing 400s in both files.

## Normalization Rule (both files)

```
const norm = (p: string) => p.replace(/\/+$/, "");
```

- Trim trailing slashes on both sides.
- Do **NOT** resolve symlinks (`fs.realpathSync`) — could introduce TOCTOU or surprise behavior on symlinked worktrees.
- Do **NOT** `path.resolve` or normalize `..` segments — `path.isAbsolute()` is already required upstream; any `..` in input simply won't match a real worktree path from git.
- Compare as strings.

## Gates (all must pass)

- [ ] `npm run lint` — 0 errors
- [ ] `npm run build` — success
- [ ] `npm run test` — 8/8 pass (or whatever the current count is; no regressions)
- [ ] `.claude/hooks/e2e-before-commit.sh` — Guard 1/0c/0d/TSC/dev/e2e-scenarios all green

## Commit Policy

- **Single commit** allowed for both files (same security concern, tightly coupled).
- Commit message format: `fix(security): S-1 — reject unrecognized worktree paths in rules-sync/diff`
- No `--no-verify`, no `--amend`, no hook bypass.

## Out of Scope (explicit)

- Helper extraction / DRY refactor → **S-2 (backlogged)**
- Symlink resolution → **NOT** in this fix
- Rate limiting / auth → unrelated, separate review
- UI changes (`/projects/[id]` Worktrees tab) — none required; 400 `worktree_not_recognized` surfaces as normal error toast

## Links

- Blind review: I-1 (Important #3, security / path injection)
- Sibling pattern: `src/app/api/projects/[id]/worktrees/route.ts` lines 69–87, `parseWorktreePorcelain` lines 25–50
- Target files:
  - `src/app/api/projects/[id]/worktrees/rules-sync/route.ts`
  - `src/app/api/projects/[id]/worktrees/rules-diff/route.ts`
