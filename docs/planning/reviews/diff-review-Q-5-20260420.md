---
task: Q-5
decision: APPROVED
author: Reviewer
created: 2026-04-20
scope_ref: approved-Q-scope-20260420.md
type: diff-review
---

# Diff Review — Q-5 (e2e-scenarios S5 + S6 확장)

[x] APPROVED

**Note**: Infra-only — no git commit (hook file `.claude/hooks/e2e-scenarios.sh` is untracked per project convention; Guard 0c does not apply).

## Scope

Implementer extended `.claude/hooks/e2e-scenarios.sh` with two new scenarios per SPEC §Q-5, covering the Q-scope backend routes that previously lacked hook-level e2e coverage.

### S5 — Workflows CRUD

E2E against `/api/workflows*` validating full lifecycle:
1. **Create** — POST `/api/workflows` (name + items[]) returns workflow id
2. **PATCH** — mutate fields (enabled flag / items array)
3. **Scalar-reject** — POST `items[].excludeTopLevelKeys` with a **scalar string** (`"hooks"`) must return **400** (covers D-3a/D-3b unified `validateExcludeTopLevelKeys` — array-only contract)
4. **Delete** — DELETE by id
5. **404** — subsequent GET/DELETE of deleted id returns 404

Coverage mapping: **T-F2.6** (Workflows CRUD) + **D-3a/D-3b** (scalar rejection regression).

### S6 — Custom Templates sanitize (T-F2.7)

E2E against `/api/templates/custom`:
1. **`__proto__` reject** — POST with raw-JSON `{"settings":{"__proto__":{"polluted":true}}}` must return **400** (prototype-pollution guard; raw JSON required because JS literal would drop the key via setter)
2. **Valid create with prototype-as-value** — POST with `settings.env.TOPIC = "prototype"` (the word as a regular value, not a key) must succeed — regression guard so the sanitizer does not false-positive on the string
3. **List** — GET `/api/templates/custom` must NOT include the rejected `__proto__` template (leak check)
4. **Cleanup** — DELETE the valid fixture

Coverage mapping: **T-F2.7** (custom template sanitize + prototype-pollution guard).

## Verification Evidence

### 1) Hook run — `bash .claude/hooks/e2e-scenarios.sh 2>&1 | tail -30`

```
[S1] Apply + Undo
  S1: PASS (apply+spec-match+undo+revert)
[S2] Skills API round-trip
  S2: PASS (write-read-delete)
[S3] Workflows API
  S3: PASS (shallow)
[S4] Hook Presets
  S4: PASS
[S5] Workflows CRUD
  S5: PASS (create+PATCH+scalar-reject+delete+404)
[S6] Custom Templates sanitize
  S6: PASS (sanitize-reject+valid-create+list+cleanup)
ALL PASS
```

### 2) Scenario marker count — `grep -c '\[S[56]\]' .claude/hooks/e2e-scenarios.sh`

```
2
```

Exactly one marker for S5 and one for S6 (matches expectation).

### 3) S5 exercises D-3a/D-3b scalar-reject

```
152:  -d '{"items":[{"templateId":"security-basic","excludeTopLevelKeys":"hooks"}]}') \
154:[[ "$SCALAR_RESP" == "400" ]] || fail "S5: scalar exclude should 400, got $SCALAR_RESP"
```

Scalar `"hooks"` sent as string (not array); 400 assertion enforces the unified validator contract from D-3a/D-3b.

### 4) S6 exercises T-F2.7 prototype-pollution guard + regression

```
169:# 1. __proto__ key (raw JSON required — JS literal would drop it via setter)
173:  --data-raw '{"name":"e2e-q6-proto","category":"custom","settings":{"__proto__":{"polluted":true}}}') \
175:[[ "$PROTO_STATUS" == "400" ]] || fail "S6: __proto__ should 400, got $PROTO_STATUS"
177:# 2. Valid settings with prototype-as-value (regression for T-F2.7)
180:  -d '{"name":"e2e-q6-valid","category":"custom","settings":{"env":{"TOPIC":"prototype"}}}') \
190:  && fail "S6: rejected __proto__ template leaked into list"
```

Both the `__proto__` key-reject case and the `"prototype"` string-as-value regression are present, plus the leak-to-list check.

## Coverage Mapping Summary

| Scenario | Validates |
|----------|-----------|
| S5 | T-F2.6 (Workflows CRUD) + D-3a (validator refactor) + D-3b (unified contract) |
| S6 | T-F2.7 (custom template sanitize + __proto__ guard + prototype-as-value regression) |

## Decision

**APPROVED.** All 6 scenarios (S1–S6) PASS, final `ALL PASS` confirmed. Both new scenarios structurally exercise the claimed coverage (scalar-reject case in S5, raw-JSON `__proto__` in S6, string-as-value regression in S6). No source-code changes — hook-infra only.

No git-commit step required. Proceed to close Q-scope.
