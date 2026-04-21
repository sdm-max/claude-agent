---
task: T-F2.2
type: diff-review
reviewer: Reviewer (claude-agent Implementer session acting as diff reviewer)
verdict: APPROVED
created: 2026-04-20
related:
  - approved-F2-scope-20260420.md (§T-F2.2)
  - inbox: (this task had no clarification question — SPEC §T-F2.2 was unambiguous)
---

[x] APPROVED

## 1. Diff stat

```
 src/app/api/workflows/[id]/activate/route.ts | 30 ++++++++++++++++++----------
 1 file changed, 20 insertions(+), 10 deletions(-)
```

Only one `src/` file modified. Other unstaged `src/` entries (`src/app/projects/[id]/page.tsx`, `src/components/editors/HooksUnifiedEditor.tsx`) are **pre-existing** housekeeping unrelated to T-F2.2 and explicitly permitted by SPEC Q5 (C 실질 null, process them separately). Untracked dirs (`src/app/api/projects/[id]/worktrees/`, `src/components/bash-matcher-builder/`, `src/components/worktrees/`, `src/lib/bash-matcher-builder.ts`) belong to future S5/S6 stories and are not staged. `REVIEW.md` also untracked. No drive-by changes to this PR.

## 2. Diff content verification (vs SPEC §T-F2.2)

Reviewer ran `git diff src/app/api/workflows/[id]/activate/route.ts` and confirmed:

| SPEC point | In diff? | Evidence |
|------------|----------|----------|
| Pre-parse existing settings ONCE before for-loop | yes | Lines 51-67 insert a `readDisk` + `JSON.parse` block **before** `for (const item of items)` at L69 |
| 409 `{error:'settings_parse_failed', path, detail}` on catch | yes | Lines 58-65 return `NextResponse.json({error:'settings_parse_failed', path: target.absolutePath, detail: ...}, {status: 409})` |
| Drop silent catch→`merged = filteredSettings` overwrite | yes | Old block (`let merged; if (existingRaw) { try { merged = deepMergeSettings(...) } catch { merged = filteredSettings } }`) fully removed |
| Per-iteration re-read/re-parse eliminated | yes | Old `readDisk` inside loop removed; L81 now `merged = deepMergeSettings(merged, filteredSettings)` accumulating in memory |
| No changes to transaction / applyExtraFiles / response shape / unrelated status codes | confirmed | L89-104 transaction unchanged. L106-109 applyExtraFiles unchanged. L114 response `{success, appliedCount, appliedTemplateIds}` unchanged. 404/410/400/409-already-active branches untouched. |

Minimal, scoped, correct.

## 3. Gate results

| Gate | Command | Result |
|------|---------|--------|
| TypeScript | `npx tsc --noEmit` | exit 0 |
| Lint | `npm run lint` | exit 0, no output (clean) |
| Tests | `npm run test` | 1/1 passed (vitest, 281ms) |
| e2e scenarios | `bash .claude/hooks/e2e-scenarios.sh` | `ALL PASS` (S1 Apply+Undo, S2 Skills round-trip, S3 Workflows, S4 Hook Presets) |

## 4. Acceptance — SPEC §T-F2.2 criteria

| SPEC acceptance | Status | Evidence |
|-----------------|--------|----------|
| `printf '{,}' > <scope>/settings.json` → activate → 409 + file hash 불변 | PASS | See §5 repro below. sha256 before 409 = sha256 after 409 = `f5254e9d…` |
| 409 body = `{error:'settings_parse_failed', path, detail}` | PASS | Actual body: `{"error":"settings_parse_failed","path":"/Users/min/.claude/settings.json","detail":"Expected property name or '}' in JSON at position 1 (line 1 column 2)"}` |
| 정상 payload activate → 200 유지 (회귀 없음) | PASS | §6 positive repro below |
| Deactivate 가역성 유지 | PASS | sha256 post-deactivate == sha256 pre-activate (`e96a3f64…`) |
| gates 통과 | PASS | §3 table all green |

## 5. Independent 409 repro (verbatim log)

```
# a) workflow id (probe created — initial list was empty)
$ curl -s -X POST http://localhost:3000/api/workflows -H "Content-Type: application/json" \
    -d '{"name":"reviewer-probe","scope":"user","items":[{"templateId":"security-basic"}]}'
{"id":"wf-ti-sDSLe","success":true}

# b) backup + pre-corrupt sha256
$ cp ~/.claude/settings.json /tmp/reviewer-backup-1776659716.json
$ shasum -a 256 ~/.claude/settings.json
SHA_PRE_CORRUPT = e96a3f64fedfebff665a8fdb1d8349cce07c984aec33239ad704c362956a30d1

# c) corrupt settings
$ printf '{,}' > ~/.claude/settings.json
$ shasum -a 256 ~/.claude/settings.json
SHA_CORRUPT    = f5254e9d79665452f9a5d65a0f2c5472d1126a6898a5db4c5b0d440943fe783e

# d) activate on corrupt settings
$ curl -s -w "\nHTTP %{http_code}" -X POST http://localhost:3000/api/workflows/wf-ti-sDSLe/activate
{"error":"settings_parse_failed","path":"/Users/min/.claude/settings.json",
 "detail":"Expected property name or '}' in JSON at position 1 (line 1 column 2)"}
HTTP 409

# e) sha256 after 409 MUST equal corrupt sha256 (no write occurred)
$ shasum -a 256 ~/.claude/settings.json
SHA_AFTER_409  = f5254e9d79665452f9a5d65a0f2c5472d1126a6898a5db4c5b0d440943fe783e
              == SHA_CORRUPT  ✓ (no disk mutation on parse fail — core SPEC assertion)

# f) restore + hash match
$ cp /tmp/reviewer-backup-1776659716.json ~/.claude/settings.json
$ shasum -a 256 ~/.claude/settings.json
SHA_RESTORED   = e96a3f64fedfebff665a8fdb1d8349cce07c984aec33239ad704c362956a30d1
              == SHA_PRE_CORRUPT  ✓

# g) probe workflow deleted
$ curl -s -X DELETE http://localhost:3000/api/workflows/wf-ti-sDSLe
{"success":true}
$ curl -s http://localhost:3000/api/workflows | jq 'length'
0
$ rm -f /tmp/reviewer-backup-1776659716.json
```

## 6. Independent 200 positive + deactivate repro (verbatim log)

Performed before step (f) cleanup in the same flow (restore → activate → deactivate round-trip):

```
SHA_PRE_ACTIVATE    = e96a3f64fedfebff665a8fdb1d8349cce07c984aec33239ad704c362956a30d1

$ curl -s -w "\nHTTP %{http_code}" -X POST http://localhost:3000/api/workflows/wf-ti-sDSLe/activate
{"success":true,"appliedCount":1,"appliedTemplateIds":["security-basic"]}
HTTP 200

SHA_POST_ACTIVATE   = dc6466275ed49ab9a7350e8ae2785cdd596acfd9ff3689d67069fe9e47f26bbf
                     (changed — expected, deepMerge wrote security-basic delta)

$ curl -s -w "\nHTTP %{http_code}" -X POST http://localhost:3000/api/workflows/wf-ti-sDSLe/deactivate
{"success":true,"undoneCount":1}
HTTP 200

SHA_POST_DEACTIVATE = e96a3f64fedfebff665a8fdb1d8349cce07c984aec33239ad704c362956a30d1
                     == SHA_PRE_ACTIVATE  ✓ (round-trip reversibility preserved)
```

## 7. Concerns

None blocking. Minor observations:

1. **Behavior change (benign)**: Previous code silently overwrote corrupt settings with template settings, so any user who depended on that "auto-heal" behavior will now get 409 instead. This is the intended SPEC change (Q1 = A, 데이터 손실 > UX 중단). Flag for release notes only.
2. **Other unstaged `src/` files**: `src/app/projects/[id]/page.tsx` and `src/components/editors/HooksUnifiedEditor.tsx` remain modified. They are not part of T-F2.2 and SPEC Q5 permits deferring them; Implementer should handle per Q5 plan (soucre-story chore commit or absorb into later F-2 task) and NOT include them in the T-F2.2 commit.
3. **Single-file scope honored**: exactly 1 `src/` file touched (≤2 SPEC limit).

## 8. Verdict

[x] APPROVED — Implementer may proceed to commit T-F2.2.

Commit message guidance (per CLAUDE.md):
`fix(api): T-F2.2 — workflow activate 409 on settings parse fail`

Reminder: Guard 0c will check this outbox file for `[x] APPROVED`. Do not include unrelated unstaged files in the commit (`git add` the single file only).
