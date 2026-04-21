---
task: Q-1b
type: diff-review
decision: APPROVED
scope_ref: .claude/pipeline/outbox/approved-Q-scope-20260420.md
files:
  - tests/unit/sanitize-settings.test.ts (new)
diff_stat: 0 src files changed; +98 lines new test file
tests_delta: 36 → 41 (+5)
author: Reviewer
created: 2026-04-20
---

[x] APPROVED

# Q-1b Diff Review — sanitizeSettings 회귀 테스트 (prototype pollution + depth guard)

## 1. Diff stat

`git status --short` → only expected new test file for this task:

```
?? tests/unit/sanitize-settings.test.ts
```

(Plus pre-existing unstaged housekeeping — CLAUDE.md / package-lock.json / package.json / src/app/templates/page.tsx / src/lib/db/migrate.ts / src/lib/fs-watcher/index.ts / REVIEW.md / docs/worklog/session-2026-04-19.md / eslint.config.mjs — unchanged by this task.)

No src/ mutation. SPEC §Q-1b compliant (test-only task).

## 2. Test file audit (SPEC §Q-1b acceptance)

| Criterion | Evidence | Pass |
|-----------|----------|------|
| 신규: `tests/unit/sanitize-settings.test.ts` | Untracked, 98 lines | ✓ |
| POST 핸들러 직접 invoke (sanitize route-local → 간접 검증) | Line 3, 41/53/65/82/93 | ✓ |
| Import via `@/app/api/custom-templates/route` alias | Line 3 | ✓ |
| 5 케이스 전부 400 응답 | `expect(res.status).toBe(400)` × 5 (lines 42, 54, 66, 83, 94) | ✓ |
| __proto__ top-level → forbidden keys | Lines 32-45, raw JSON | ✓ |
| constructor nested (depth 2) → forbidden keys | Lines 47-57 | ✓ |
| prototype top-level → forbidden keys | Lines 59-69 | ✓ |
| depth > MAX_SANITIZE_DEPTH (32) → depth_exceeded | Lines 71-86 (40-level nested) | ✓ |
| __proto__ inside array element → forbidden keys (array walker) | Lines 88-97, raw JSON | ✓ |
| Happy path (201) — DB mock 불필요, Q-3 integration으로 이관 | Comment lines 7-10 explicitly defer | ✓ |

## 3. Raw-JSON attack simulation — validated

Implementer claim: `{ __proto__: x }` in JS literal invokes the prototype setter (no own-key); only `JSON.parse('{"__proto__":...}')` materializes `__proto__` as an own-key that `Object.keys` / recursive walker will see.

Empirical confirmation (node REPL):

```
JSON.stringify({__proto__: {x:1}})          → "{}"        (setter consumed, literal produced empty)
Object.keys(JSON.parse('{"__proto__":{"x":1}}')) → ["__proto__"]   (own-key materialized)
```

Therefore cases 1 + 5 (the true `__proto__` attack vectors) **must** use `makeRawRequest(rawJsonBody)` — the `makeRequest(obj)` helper would silently pass an empty object through `JSON.stringify`, making the test a false negative. Implementer's two-helper design (`makeRequest` for ordinary literals, `makeRawRequest` for `__proto__` payloads) is correct and necessary. Cases 2/3/4 use `constructor` / `prototype` / deep nesting which are ordinary keys with no JS literal specialness → plain `makeRequest` is fine.

This is a non-trivial JS-semantics gotcha; the inline comments at lines 20-22 and 33-34/88-89 document it for future readers. Good.

## 4. Regression-catch value (structural)

Case 1 relies on sanitizeSettings detecting `__proto__` in `FORBIDDEN_KEYS`. If a future edit removed `__proto__` from that set, the walker would no longer 400-reject; the request would fall through to the DB path (which would then succeed or fail on schema). Either way, `expect(res.status).toBe(400)` and `expect(json.error).toMatch(/forbidden keys/)` would fail → regression caught. Same mechanism protects `constructor` (case 2) and `prototype` (case 3). Case 4 pins the depth guard boundary — if `MAX_SANITIZE_DEPTH` were raised above 40 or the depth check were removed, the 40-level payload would either pass sanitize or fail with a different error, and `toMatch(/depth_exceeded/)` would fail. Case 5 pins recursive array traversal — removing array-walking from the sanitizer would let the nested `__proto__` slip past.

All 5 cases carry independent regression-catch value; no redundant/filler assertions.

## 5. Gates (all PASS)

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | exit 0 (no output) |
| `npm run lint` (eslint src) | exit 0 (no errors) |
| `npm run test` (vitest run) | 4 files / **41 tests passed** (was 36) — **+5 net** |
| `.claude/hooks/e2e-scenarios.sh` | ALL PASS (S1 apply+undo, S2 skills, S3 workflows, S4 hook presets) |

Test count delta: 36 → 41 exactly matches Implementer claim of +5 new cases.

## 6. Concerns

None blocking. Minor observations (informational):

- `settings: {}` trick on line 38-39 (build literal, then string-replace to inject `__proto__`) is slightly clever but well-commented; an alternative would be hand-written JSON string like case 5 (line 90-91). Both approaches are valid; consistency optional.
- `expect(json.error).toMatch(/forbidden keys/)` uses a lowercase match — if the sanitizer error message capitalization changed ("Forbidden keys" → "FORBIDDEN_KEYS"), tests would fail loudly. Minor coupling to error-message format; acceptable for a 5-case suite.

## 7. Verdict

**APPROVED.** Implementation matches SPEC §Q-1b verbatim: 5 cases, all 400, correct raw-JSON usage for the two `__proto__` vectors (JS-semantics gotcha explicitly documented + empirically validated), ordinary literal for constructor/prototype/depth, `@/app/api/custom-templates/route` alias import, happy path skipped per SPEC (deferred to Q-3). All 4 gates green (tsc / lint / vitest 41-pass / e2e scenarios ALL PASS). Single-file task, zero src mutation — no scope creep. Implementer may proceed to commit with message `test(custom-templates): Q-1b — sanitizeSettings 회귀 테스트 (prototype pollution + depth guard)`.
