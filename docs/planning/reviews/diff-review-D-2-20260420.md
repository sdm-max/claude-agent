---
task: D-2
type: diff-review
decision: APPROVED
scope_ref: .claude/pipeline/outbox/approved-D-scope-20260420.md
file: src/lib/fs-watcher/index.ts
diff_stat: 1 file changed, 10 insertions(+), 4 deletions(-)
author: Reviewer
created: 2026-04-20
---

[x] APPROVED

# D-2 Diff Review — fs-watcher depth constants

## 1. Diff stat

```
 src/lib/fs-watcher/index.ts | 14 ++++++++++----
 1 file changed, 10 insertions(+), 4 deletions(-)
```

`git status --short` shows only `src/lib/fs-watcher/index.ts` modified for this task.

## 2. Acceptance table (SPEC §D-2)

| Criterion | Evidence | Pass |
|-----------|----------|------|
| Two module-level constants `PROJECT_WATCH_DEPTH = 4`, `HOME_WATCH_DEPTH = 3` | L30–31 declarations after `HOME_BUS_KEY` | ✓ |
| Required comment linking `cap = depth + 1` (project) and home note (no base segment) | L27–29: "Classifier cap = chokidar depth + 1 … no base for home since we watch ~/.claude/ directly." | ✓ |
| Project classifier literal replaced — `parts.length <= 5` → `parts.length <= PROJECT_WATCH_DEPTH + 1` | L99 (formerly L93) | ✓ |
| Home classifier literal replaced — `parts.length <= 4` → `parts.length <= HOME_WATCH_DEPTH + 1` | L134 (formerly L128) | ✓ |
| Project chokidar `depth: 4` → `depth: PROJECT_WATCH_DEPTH` | L186 (formerly L180) | ✓ |
| Home chokidar `depth: 3` → `depth: HOME_WATCH_DEPTH` | L242 (formerly L236) | ✓ |
| No behavioral change elsewhere (classifier branches, `leaf` helper, skills/hooks/agents/settings detection) | Unified diff touches only the 4 cited sites + the new constants block; surrounding context in diff hunks is unchanged | ✓ |

## 3. Grep evidence — no stray literals

```
$ grep -nE 'depth:\s*[0-9]|parts\.length\s*<=\s*[0-9]' src/lib/fs-watcher/index.ts
97:  // Rules: nested subdirs allowed up to the watcher depth cap (chokidar depth:4
133:  // (chokidar depth:3 under ~/.claude/ means max 4 parts).
```

Only comment references remain (documentation of the cap). All four executable sites use the constants.

## 4. Gate results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | exit 0 (silent) |
| `npm run lint` | exit 0 (no warnings) |
| `npm run test` | 8 pass / 2 files |
| `.claude/hooks/e2e-scenarios.sh` | ALL PASS (S1 apply+undo, S2 skills, S3 workflows, S4 hook presets) |

## 5. SSE regression probe (independent)

Clean state: `/tmp/test-claude-project/.claude/rules/` absent before probe.

Listener: `curl -sN /api/projects/$TP/events` (PID 24604), captured for ~10s with explicit kill.

Writes:
- `rules/rev-d2nested/x.md` (depth-3 — within cap)
- `rules/rev-d2flat.md` (depth-2 — flat)
- `rules/a/b/c/d.md` (depth-5 — exceeds `PROJECT_WATCH_DEPTH + 1 = 5`? → actually parts=['.claude','rules','a','b','c','d.md'] length=6, over cap 5, must NOT emit)

Log excerpt:

```
data: {"kind":"ready"}
data: {"kind":"rules","relativePath":".claude/rules/rev-d2nested/x.md","op":"add"}
data: {"kind":"rules","relativePath":".claude/rules/rev-d2flat.md","op":"add"}
```

Counts: `rules` events = 2, total data lines = 3. Deep write (depth-5) produced **zero** event, confirming the classifier cap enforcement is preserved after the literal→constant substitution.

Cleanup: test files and nested dirs removed; `/tmp/test-claude-project/.claude/` restored to `settings.local.json` only.

## 6. Verdict

[x] APPROVED — constants introduced exactly at the 4 SPEC-mandated sites, no other behavioral change, all gates pass, SSE regression probe confirms cap semantics intact (flat + nested-within-cap emit, over-cap suppressed). Implementer may commit under the standard commit convention.
