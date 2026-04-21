---
type: diff-review
task: Q-2
spec: SPEC §Q-2
verdict: APPROVED
created: 2026-04-20
reviewer: Reviewer Claude
---

# Diff Review — Q-2 (unit test coverage: workflows/validate + getAllTemplates resilience)

- [x] APPROVED

## Scope

Two new test files (test-only; zero src changes):

1. `tests/unit/workflows-validate.test.ts` — 14 cases targeting `isValidItem` from `@/lib/workflows/validate` (post-D-3a path).
2. `tests/unit/templates-custom-parse.test.ts` — 4 cases covering `getAllTemplates()` custom-row JSON resilience, backing T-F2.1 regression net.

Test count: **41 → 59** (+18). Test files: 6 passed.

## Checks performed

| # | Check | Result |
|---|-------|--------|
| 1 | `git status --short` exactly 2 untracked test files | PASS (only `tests/unit/templates-custom-parse.test.ts` + `tests/unit/workflows-validate.test.ts`) |
| 2 | `workflows-validate.test.ts`: imports `isValidItem` from `@/lib/workflows/validate` + 14 permutations (templateId type variants, exclude array scalar-vs-array, null/undefined/primitive/array) | PASS |
| 3 | `templates-custom-parse.test.ts`: `vi.hoisted()` holder for mocked `getDb`, `beforeEach` rebuilds `Database(':memory:')` + closes prior handle, manual `CREATE TABLE custom_templates` snake_case, 4 cases incl. mixed valid+corrupt | PASS |
| 4 | Manual CREATE TABLE columns vs `customTemplates` drizzle table in `src/lib/db/schema.ts` (id, name, name_ko, description, description_ko, category, difficulty, scope, tags, settings, extra_files, created_at, updated_at) | PASS — exact match including `DEFAULT ''` on description fields, `DEFAULT 1` difficulty, `DEFAULT 'project'` scope |
| 5 | `npx tsc --noEmit` | exit 0 |
| 6 | `npm run lint` | exit 0 |
| 7 | `npm run test` | 6 files / **59 tests** / all pass (746ms) |
| 8 | `.claude/hooks/e2e-scenarios.sh` | S1/S2/S3/S4 ALL PASS |
| 9 | **T-F2.1 regression catch** — mixed-rows test (line 130) inserts 2 valid + 1 corrupt and asserts `customIds.sort() === ["custom-a","custom-b"]` AND no throw AND broken row absent. A regression where every custom row got skipped (or where one bad row wiped the list) would fail the `toEqual` assertion. | PASS — both (a) no-throw AND (b) other valid rows present are enforced |
| 10 | **Isolation** — `beforeEach` closes prior `sqliteHandle` in try/catch, creates fresh `createTestDb()`, reassigns `holder.db` so mocked `getDb()` points at the new drizzle instance each test. No shared `testDb` leak; tests are order-independent. | PASS |

## Notes / observations

- `vi.hoisted()` pattern is idiomatic and necessary here because `vi.mock()` factory is hoisted above all non-hoisted imports; closing over a plain `let testDb` would read `undefined` at mock-evaluation time.
- Manual CREATE TABLE (vs `drizzle-kit migrate`) is justified: migrate depends on the on-disk `data/` dir and would couple unit tests to FS state.
- T-F2.1 P0 coverage (mixed valid+corrupt rows do not poison the full list) is now guarded by a concrete regression test — a future refactor that catches the outer loop error would fail CI.
- `isValidItem` coverage is exhaustive: templateId absence/empty/wrong-type, each exclude array scalar-vs-array, plus non-object input permutations (null/undefined/number/string/array).

## Verdict

[x] APPROVED — Implementer may commit.
