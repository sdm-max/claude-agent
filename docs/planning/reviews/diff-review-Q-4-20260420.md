---
type: diff-review
task: Q-4
spec: SPEC §Q-4
verdict: APPROVED
created: 2026-04-20
reviewer: Reviewer Claude
---

# Diff Review — Q-4 (integration tests: agent-header 2-pass + EACCES rollback regression lock)

- [x] APPROVED

## Scope

One new integration test file (test-only; zero src changes):

- `tests/integration/agent-header-apply.test.ts` — 3 cases regression-locking T-F2.4b (2-pass dry-run, any transform failure → zero writes) + D-1 (best-effort reverse-order rollback on mid-pass write failure).

Test count: **62 → 65** (+3). Test files: 8 passed.

## Checks performed

| # | Check | Result |
|---|-------|--------|
| 1 | `git status --short` — 1 untracked test file (`tests/integration/agent-header-apply.test.ts`) + pre-existing housekeeping only | PASS |
| 2 | Header: `@vitest-environment node` pragma in top docblock — avoids jsdom fetch quirks | PASS |
| 3 | Skip policy: condition-based via `beforeAll` probe + `AbortSignal.timeout(1500)` — no hardcoded `it.skip`/`xtest` | PASS |
| 4 | `SKIP_INTEGRATION=1` env override respected in `beforeAll` early-return | PASS |
| 5 | 3 test cases present: inject happy path / EACCES rollback / strip round-trip | PASS |
| 6 | Root-user guard — `typeof process.getuid === "function" && process.getuid() === 0` → `ctx.skip()` with warning (chmod 0444 not enforced for root) | PASS |
| 7 | Unconditional `cleanupFixtures()` in `beforeAll` (preemptive), `afterEach`, `afterAll`, and every test's `finally` — restores 0o644 before unlink so a 0444 residue cannot wedge future runs | PASS |
| 8 | `npx tsc --noEmit` | exit 0 |
| 9 | `npm run lint` | exit 0 |
| 10 | `npm run test` (dev server up on :3000 — verified `curl /api/projects` returned 200) | 8 files / **65 tests** / all pass (622ms) |
| 11 | `.claude/hooks/e2e-scenarios.sh` | S1/S2/S3/S4 ALL PASS |
| 12 | **Skip-env verification** — `SKIP_INTEGRATION=1 npm run test` → `59 passed \| 6 skipped (65)`, matches SPEC prediction exactly (Q-3 3 + Q-4 3) | PASS |
| 13 | **Cleanup verification (post-live-run)** — `ls /tmp/test-claude-project/.claude/agents/` → `No such file or directory`; `find /tmp/test-claude-project -perm 0444 \| wc -l` → `0`; `_agent-header.md` absent | PASS |

## Test-body correctness

### Happy path (inject, 2 agents)

- Asserts `status === 200`, `body.updated === 2`, `applied.sort() === ["a.md","b.md"]`.
- Explicitly asserts `body.rolledBack ?? [] === []` and `body.rollbackFailed ?? [] === []` — **locks D-1 response-shape preservation on success** (success path must still emit empty arrays, not omit the fields).
- Frontmatter-preservation check: `readFile(...).split("\n", 1)[0] === "---"` for both files.
- Header-content injection check: `contentA/contentB` contain `COMMON-HEADER:START` + `HEADER_BODY`.

### EACCES rollback (3 agents, c.md chmod 0444)

- chmod'd **after** pass-1 read (0444 still allows read) so pass-1 plan succeeds, only pass-2 write on c.md fails → triggers rollback.
- Asserts `body.applied === []` and `body.updated === 0` — locks the "applied must be cleared once rollback is attempted" contract from D-1.
- Asserts `skipped[path==="c.md"].reason.startsWith("write_failed")`.
- Asserts `rolledBack.includes("a.md") && rolledBack.includes("b.md")` (tolerant of either order since reverse-order depends on which got written before the c.md failure).
- Asserts `rollbackFailed === []`.
- **md5 invariant for all 3 files**: `md5File(pathA) === mdBeforeA`, `md5File(pathB) === mdBeforeB`, `md5File(pathC) === mdBeforeC` — cryptographic proof that a.md and b.md were restored byte-exact and c.md never mutated.
- `finally` restores c.md perms before `cleanupFixtures()` so unlink cannot fail.

### Strip round-trip

- Inject then strip; after strip: `stripped` does NOT contain `COMMON-HEADER:START` nor `COMMON-HEADER:END`; frontmatter `---` preserved; `updated === 1`; no rollback arrays populated.

## D-1 regression-catch analysis

If D-1 were reverted (rollback loop removed from `src/app/api/projects/[id]/agent-header/apply/route.ts`):

- With c.md chmod 0444 and a.md+b.md written successfully before c.md write fails, the handler would return with `applied = ["a.md","b.md"]` (partial) and `rolledBack = []` (empty — field either absent or empty array).
- Test assertion `expect(body.applied ?? []).toEqual([])` would FAIL (`["a.md","b.md"] !== []`).
- Test assertion `expect(rolledBack).toContain("a.md")` would also FAIL.
- md5 assertions `md5File(pathA) === mdBeforeA` and `md5File(pathB) === mdBeforeB` would ALSO FAIL (files mutated, not restored).

Triple-layer coverage: response-shape (applied/rolledBack arrays) + filesystem-state (md5 invariant) + contract-flag (updated === 0). Regression would be caught by any one of three independent signals.

## T-F2.4b regression-catch analysis

If T-F2.4b were reverted (2-pass dropped, single-pass transform-and-write interleaved):

- On c.md write failure, a.md and b.md would already be written AND the handler would not even enter the rollback branch (because there's no pass-1 plan to roll back from).
- Same as above — `applied` non-empty and md5 deltas would fail the EACCES test.

## Verdict

All 13 Reviewer checks PASS. Test bodies correctly lock both regressions (T-F2.4b 2-pass + D-1 rollback) via response-shape + filesystem md5 + contract-flag triple coverage. Skip policy is condition-based + env-gated per approved-Q-scope §Q2. Cleanup is exhaustive (try/finally + afterEach + afterAll + preemptive beforeAll) and verified leaving zero residue. Root-user guard prevents false negatives in container/CI environments.

**APPROVED** for commit.
