---
type: diff-review
task: Q-3
spec: SPEC §Q-3
verdict: APPROVED
created: 2026-04-20
reviewer: Reviewer Claude
---

# Diff Review — Q-3 (integration tests: parse-error 409 hard-stop regression lock)

- [x] APPROVED

## Scope

One new integration test file (test-only; zero src changes):

- `tests/integration/parse-error-409.test.ts` — 3 cases regression-locking T-F2.2 (workflow activate) + T-F2.3 (templates apply / batch-apply) 409 hard-stop on corrupt `settings.local.json`.

Test count: **59 → 62** (+3). Test files: 7 passed.

## Checks performed

| # | Check | Result |
|---|-------|--------|
| 1 | `git status --short` — 1 untracked test dir (`tests/integration/`) + pre-existing housekeeping only | PASS |
| 2 | Header: `@vitest-environment node` pragma at top (line 2) — avoids jsdom fetch/CORS issue | PASS |
| 3 | Skip policy: condition-based via `beforeAll` probe + `AbortSignal.timeout(1500)` — no hardcoded `it.skip`/`xtest` | PASS |
| 4 | `SKIP_INTEGRATION=1` env override respected in `beforeAll` early-return | PASS |
| 5 | 3 test cases present: apply, batch-apply, activate | PASS |
| 6 | Each asserts `status === 409` + `body.error === "settings_parse_failed"` + `readSha() === shaCorrupt` (sha256 invariant) | PASS |
| 7 | `afterEach` restore (safety net between tests) + `afterAll` restore (suite end) both guard with `try/catch` | PASS |
| 8 | Activate test cleans up probe workflow via `DELETE /api/workflows/:id` in `finally` | PASS |
| 9 | `npx tsc --noEmit` | exit 0 |
| 10 | `npm run lint` | exit 0 |
| 11 | `npm run test` (dev server up on :3000) | 7 files / **62 tests** / all pass (625ms) |
| 12 | `.claude/hooks/e2e-scenarios.sh` | S1/S2/S3/S4 ALL PASS |
| 13 | **Skip-env verification** — `SKIP_INTEGRATION=1 npm run test` → `59 passed \| 3 skipped (62)`, matches SPEC prediction exactly | PASS |
| 14 | **Restore robustness** — `cat /tmp/test-claude-project/.claude/settings.local.json \| jq` after full suite run → `{"permissions": {}}` (valid JSON, not `{,}`) | PASS |
| 15 | **No stale workflow** — `curl /api/workflows \| jq 'map(select(.name \| startswith("q3-probe"))) \| length'` → 0 | PASS |

## Notes / observations

- `@vitest-environment node` pragma necessary because `vitest.config.ts` defaults to jsdom, and jsdom enforces a synthetic CORS policy that would block `fetch("http://localhost:3000/...")`. Per-file docblock override is the cleanest scope.
- Condition-based skip via dynamic `ctx.skip()` inside each `it` body is required (not `it.skipIf`) because `beforeAll` runs AFTER collection, so a collection-time predicate would read stale `serverUp`. The current pattern is correct.
- Cleanup layers are defense-in-depth: (a) per-test `try/finally restoreSettings()`, (b) `afterEach` restore, (c) `afterAll` restore. Even if any single layer throws, the next one rescues. Verified empirically — `settings.local.json` is `{"permissions": {}}` post-suite (baseline preserved).
- Activate test also reads the workflow id from `POST /api/workflows` response (201) and deletes in `finally` — tolerant of DELETE failure (logged, not fatal), which is appropriate for a probe created under test.
- Probe workflow name is `q3-probe-${Date.now()}` so parallel or flaky repeats don't collide.
- `{,}` as the corrupt payload is a minimal JSON syntax error (trailing comma in an empty object) — guarantees `JSON.parse` throws and the 409 path is exercised.

## Verdict

[x] APPROVED — Implementer may commit.
