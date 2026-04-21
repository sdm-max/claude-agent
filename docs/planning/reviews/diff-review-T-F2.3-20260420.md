---
task: T-F2.3
type: diff-review
reviewer: Reviewer (claude-agent Implementer session acting as diff reviewer)
verdict: APPROVED
created: 2026-04-20
related:
  - approved-F2-scope-20260420.md (§T-F2.3)
  - diff-review-T-F2.2-20260420.md (sibling 409 pattern cleanup for workflow activate)
  - inbox: (this task had no clarification question — SPEC §T-F2.3 was unambiguous)
---

[x] APPROVED

## 1. Diff stat

```
 src/app/api/templates/[id]/apply/route.ts   | 11 +++++++++--
 src/app/api/templates/batch-apply/route.ts  | 13 ++++++++++++-
 2 files changed, 21 insertions(+), 3 deletions(-)
```

Exactly two `src/` files changed — within SPEC ≤2 limit. Other unstaged `src/` entries
(`src/app/projects/[id]/page.tsx`, `src/components/editors/HooksUnifiedEditor.tsx`) and
`docs/ARCHITECTURE.md` are pre-existing housekeeping unrelated to T-F2.3; untracked dirs
(`src/app/api/projects/[id]/worktrees/`, `src/components/bash-matcher-builder/`,
`src/components/worktrees/`, `src/lib/bash-matcher-builder.ts`) belong to future S5/S6
stories. `REVIEW.md` untracked. Per SPEC Q5(C 실질 null), these must NOT be included in
the T-F2.3 commit. No drive-by changes in the two T-F2.3 files.

## 2. Diff content verification (vs SPEC §T-F2.3)

Reviewer ran `git diff src/app/api/templates/[id]/apply/route.ts src/app/api/templates/batch-apply/route.ts` and confirmed:

### 2a. `src/app/api/templates/[id]/apply/route.ts`

| SPEC point | In diff? | Evidence |
|------------|----------|----------|
| parse catch → 409 hard-stop with `{error, path, detail}` | yes | Lines 63-72: `catch (e) { return NextResponse.json({error:'settings_parse_failed', path: target.absolutePath, detail: e instanceof Error ? e.message : String(e)}, {status: 409}); }` |
| Old silent fallthrough (`merged = filteredSettings` on parse fail) removed | yes | Previous `catch { merged = filteredSettings; }` (single-line) replaced with throwing 409 branch |
| H-1 `appliedId` field preserved | yes | L85 `const appliedId = nanoid();` and L107-113 response includes `appliedId: appliedId` (commit 9e953e9 intact) |
| Transaction, `applyExtraFiles`, response shape unchanged | confirmed | L86-99 transaction identical. L101-105 `applyExtraFiles` call identical. Response keys `success, appliedId, scope, config, extraFiles, savedFiles` identical. |
| No drive-by changes | confirmed | Only the catch block differs; 40+ surrounding lines byte-for-byte unchanged. |

### 2b. `src/app/api/templates/batch-apply/route.ts`

| SPEC point | In diff? | Evidence |
|------------|----------|----------|
| parse catch → 409 hard-stop with `{error, path, detail}` | yes | Lines 52-65: same 409 shape |
| `merged = {}` fallback **REMOVED** (N-template zero-accumulation fix) | yes | Old `try { merged = JSON.parse(existingRaw) as ClaudeSettings; } catch { merged = {}; }` one-liner expanded to try/catch-409 — the dangerous `catch { merged = {}; }` fallback is gone |
| 409 returns **before** transaction (so no applied_templates rows on failure) | confirmed | L52-65 (409 return) sits above L78 `getDb().transaction(...)`. Early return ⇒ DB rollback is trivially satisfied (no insert ever attempted). |
| Per-template loop, `applyExtraFiles`, response shape unchanged | confirmed | L67-73 template accumulation loop identical. L96-100 `applyExtraFiles` identical. Response keys `success, scope, applied, config, extraFiles, savedFiles` identical. |
| No drive-by changes | confirmed | Only the catch block differs. |

Minimal, scoped, correct. Anti-pattern eliminated in both sites.

## 3. Gate results

| Gate | Command | Result |
|------|---------|--------|
| TypeScript | `npx tsc --noEmit` | exit 0 (clean) |
| Lint | `npm run lint` | exit 0, no output |
| Tests | `npm run test` | 1/1 passed (vitest, 422ms) |
| e2e scenarios | `bash .claude/hooks/e2e-scenarios.sh` | `ALL PASS` (S1 Apply+Undo, S2 Skills, S3 Workflows, S4 Hook Presets) |
| Dev server ping | `curl :3000/api/templates` | 200 |

## 4. Acceptance — SPEC §T-F2.3 criteria

| SPEC acceptance | Status | Evidence |
|-----------------|--------|----------|
| corrupted settings.json + apply → 409 + disk 불변 | PASS | §5a repro. sha before 409 == sha after 409 (`f5254e9d…`). Body has `error, path, detail`. |
| corrupted + batch-apply(N tmpl) → 409 + disk 불변 + applied_templates rollback | PASS | §5b repro. sha unchanged. 409 returned before transaction block → no DB inserts possible. |
| 정상 경로 회귀 없음 | PASS | §5c repro. apply → 200 + `appliedId`, sha changed. undo → sha == SHA_PRE. batch-apply (valid) 2 tmpl → 200, pre-existing keys preserved (§5d). |
| gates 통과 | PASS | §3 all green |

## 5. Independent repro (verbatim log)

### 5a. apply 409 (corrupt settings)

```
$ cp ~/.claude/settings.json /tmp/reviewer-f2-3-1776671074.json
$ shasum -a 256 ~/.claude/settings.json
SHA_PRE     = e96a3f64fedfebff665a8fdb1d8349cce07c984aec33239ad704c362956a30d1

$ printf '{,}' > ~/.claude/settings.json
$ shasum -a 256 ~/.claude/settings.json
SHA_CORRUPT = f5254e9d79665452f9a5d65a0f2c5472d1126a6898a5db4c5b0d440943fe783e

$ curl -s -w "\nHTTP %{http_code}" -X POST \
    http://localhost:3000/api/templates/security-basic/apply \
    -H "Content-Type: application/json" -d '{"scope":"user","mode":"merge"}'
{"error":"settings_parse_failed","path":"/Users/min/.claude/settings.json",
 "detail":"Expected property name or '}' in JSON at position 1 (line 1 column 2)"}
HTTP 409

$ shasum -a 256 ~/.claude/settings.json
SHA_AFTER_APPLY = f5254e9d79665452f9a5d65a0f2c5472d1126a6898a5db4c5b0d440943fe783e
                == SHA_CORRUPT  ✓ (no disk mutation on parse fail)
```

### 5b. batch-apply 409 (still corrupt, multiple templates)

```
$ curl -s -w "\nHTTP %{http_code}" -X POST \
    http://localhost:3000/api/templates/batch-apply \
    -H "Content-Type: application/json" \
    -d '{"templateIds":["security-basic","security-hardened"],"scope":"user","mode":"merge"}'
{"error":"settings_parse_failed","path":"/Users/min/.claude/settings.json",
 "detail":"Expected property name or '}' in JSON at position 1 (line 1 column 2)"}
HTTP 409

$ shasum -a 256 ~/.claude/settings.json
SHA_AFTER_BATCH = f5254e9d79665452f9a5d65a0f2c5472d1126a6898a5db4c5b0d440943fe783e
                == SHA_CORRUPT  ✓ (no disk mutation; 409 returned before transaction,
                                   so no applied_templates rows created either)
```

### 5c. Restore + positive apply + undo (round-trip regression check)

```
$ cp /tmp/reviewer-f2-3-1776671074.json ~/.claude/settings.json
$ shasum -a 256 ~/.claude/settings.json
SHA_RESTORED = e96a3f64fedfebff665a8fdb1d8349cce07c984aec33239ad704c362956a30d1
             == SHA_PRE  ✓

$ curl -s -w "\nHTTP %{http_code}" -X POST \
    http://localhost:3000/api/templates/security-basic/apply \
    -H "Content-Type: application/json" -d '{"scope":"user","mode":"merge"}'
{"success":true,"appliedId":"0F9XUyEPSi5IDjpCraeBN","scope":"user","config":"{...}",
 "extraFiles":[],"savedFiles":[]}
HTTP 200                                ← H-1 appliedId field intact

$ shasum -a 256 ~/.claude/settings.json
SHA_POST_APPLY = dc6466275ed49ab9a7350e8ae2785cdd596acfd9ff3689d67069fe9e47f26bbf
              != SHA_PRE  ✓ (template delta written as expected)

$ curl -s -w "\nHTTP %{http_code}" -X POST \
    http://localhost:3000/api/templates/applied/0F9XUyEPSi5IDjpCraeBN/undo \
    -H "Content-Type: application/json" -d '{}'
{"success":true,"config":"{...}"}
HTTP 200

$ shasum -a 256 ~/.claude/settings.json
SHA_POST_UNDO = e96a3f64fedfebff665a8fdb1d8349cce07c984aec33239ad704c362956a30d1
              == SHA_PRE  ✓ (full round-trip reversibility preserved)
```

### 5d. Positive batch-apply — N-template zero-accumulation sanity

```
$ jq -r 'keys | sort | join(",")' ~/.claude/settings.json
KEYS_BEFORE = effortLevel,permissions,skipAutoPermissionPrompt
SHA_BEFORE  = e96a3f64fedfebff665a8fdb1d8349cce07c984aec33239ad704c362956a30d1

$ curl -s -w "\nHTTP %{http_code}" -X POST \
    http://localhost:3000/api/templates/batch-apply \
    -H "Content-Type: application/json" \
    -d '{"templateIds":["security-basic","security-hardened"],"scope":"user","mode":"merge"}'
{"success":true,"scope":"user","applied":2,"config":"{...}", ...}
HTTP 200

$ jq -r 'keys | sort | join(",")' ~/.claude/settings.json
KEYS_AFTER  = effortLevel,permissions,skipAutoPermissionPrompt
SHA_AFTER   = 91aadccd5a87f612f208534c8cb61917ee0aa2b0068e4e343c7e3b1482436231
            != SHA_BEFORE  ✓

Pre-existing keys preserved: effortLevel ✓, skipAutoPermissionPrompt ✓, permissions ✓
(None wiped. `merged = {}` fallback removal confirmed — no zero-accumulation.)
```

### 5e. Full SHA transition log (chronological)

| Step | SHA-256 | Notes |
|------|---------|-------|
| Backup capture | `e96a3f64…956a30d1` | SHA_PRE (pristine) |
| Corrupt with `{,}` | `f5254e9d…943fe783e` | SHA_CORRUPT |
| apply 409 | `f5254e9d…943fe783e` | unchanged (== SHA_CORRUPT) |
| batch-apply 409 | `f5254e9d…943fe783e` | unchanged (== SHA_CORRUPT) |
| Restore from backup | `e96a3f64…956a30d1` | == SHA_PRE |
| apply 200 (security-basic) | `dc646627…9e47f26bbf` | changed (delta written) |
| undo 200 | `e96a3f64…956a30d1` | == SHA_PRE (round-trip) |
| batch-apply 200 (basic+hardened) | `91aadccd…482436231` | changed, keys preserved |
| Restore from backup (cleanup) | `e96a3f64…956a30d1` | == SHA_PRE (workspace pristine) |

## 6. Concerns

None blocking. Minor observations:

1. **Applied-templates rows from §5c/§5d probes**: The positive apply in §5c was followed
   by an undo (so the row is marked inactive but remains), and the positive §5d batch-apply
   created two more active rows. These are cosmetic DB entries from reviewer verification;
   recommend Implementer `curl DELETE` them before commit or leave for cleanup later.
   Not a blocker — does not affect gates or SPEC acceptance.
2. **Behavior change (benign, same as T-F2.2)**: Users who depended on the previous
   "silent auto-heal" of corrupt settings will now see 409. Intended per SPEC Q1 = A.
   Surface in release notes.
3. **Unstaged `src/` housekeeping files**: Must NOT be included in this commit. Same
   guidance as T-F2.2 review §7.2.
4. **Error `detail` field**: Surfaces the native JSON parse error message (e.g.
   `"Expected property name or '}' in JSON at position 1 (line 1 column 2)"`). Safe — does
   not leak secrets — but worth noting in case future SPEC wants to redact.

## 7. Verdict

[x] APPROVED — Implementer may proceed to commit T-F2.3.

Commit message guidance (per CLAUDE.md):
`fix(api): T-F2.3 — templates apply/batch-apply 409 on settings parse fail`

Reminder: Guard 0c will check this outbox file for `[x] APPROVED`. `git add` ONLY
`src/app/api/templates/[id]/apply/route.ts` and `src/app/api/templates/batch-apply/route.ts`
— do not include unrelated unstaged files.
