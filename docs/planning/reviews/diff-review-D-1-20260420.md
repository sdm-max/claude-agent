---
task: D-1
type: diff-review
decision: APPROVED
scope_ref: .claude/pipeline/outbox/approved-D-scope-20260420.md
file: src/app/api/projects/[id]/agent-header/apply/route.ts
diff_stat: 1 file changed, 24 insertions(+), 4 deletions(-)
author: Reviewer
created: 2026-04-20
---

[x] APPROVED

# D-1 Diff Review — apply-to-all Step 2 best-effort rollback

## 1. Diff stat

```
 src/app/api/projects/[id]/agent-header/apply/route.ts | 28 ++++++++++++++++++----
 1 file changed, 24 insertions(+), 4 deletions(-)
```

Single-file change. `git status --short` shows only the expected route modified for this task.

## 2. Acceptance table (SPEC §D-1)

| Criterion | Evidence | Pass |
|-----------|----------|------|
| Plan type gains `original: string` | Line 52: `type Plan = { name: string; full: string; original: string; next: string; changed: boolean };` | ✓ |
| Step 1 fills `original` | Line 71: `plans.push({ name, full, original, next, changed: next !== original });` | ✓ |
| Reverse-order rollback on Step 2 write failure | Lines 88-97: `for (let j = applied.length - 1; j >= 0; j--) { ... writeFileSync(rb.full, rb.original, "utf8") ... }` | ✓ |
| Rollback is best-effort (no throw) | Lines 94-96: rollback errors captured into `rollbackFailed`, loop continues | ✓ |
| `applied` cleared after rollback attempt | Line 99: `applied.length = 0;` | ✓ |
| Response includes `rolledBack: string[]` + `rollbackFailed: Array<{path, reason}>` unconditionally | Lines 112-113: both fields always in NextResponse.json payload | ✓ |
| Existing contract fields preserved | Lines 106-111: `updated`, `total`, `files`, `applied`, `skipped`, `mode` all present | ✓ |
| 404 / 400 / header-missing guards untouched | Lines 21, 26, 38-41: no drive-by changes (verified via `git diff`) | ✓ |
| Exactly 1 file modified | `git status --short` shows only apply/route.ts | ✓ |

## 3. Gates (all PASS)

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | exit 0 (no output) |
| `npm run lint` (eslint src) | exit 0 (no errors) |
| `npm run test` | 2 files / 8 tests passed |
| `.claude/hooks/e2e-scenarios.sh` | ALL PASS (S1 apply+undo, S2 skills, S3 workflows, S4 hook presets) |

## 4. Independent EIO repro

### Setup

```
TP=I77rqshvWTrDtFA6RKGGu   # /tmp/test-claude-project
mkdir -p /tmp/test-claude-project/.claude/agents
printf 'REV-D1' > /tmp/test-claude-project/.claude/_agent-header.md
printf -- '---\nname: x1\n---\nBody\n' > .../agents/x1.md
printf -- '---\nname: x2\n---\nBody\n' > .../agents/x2.md
printf -- '---\nname: x3\n---\nBody\n' > .../agents/x3.md
```

### md5 BEFORE (all 3 fresh)

```
MD5 (.../agents/x1.md) = 279c931e10ce20763cf4e9ad4a2260d4
MD5 (.../agents/x2.md) = 8f30bd1a9718900f0f17720dde78a0dd
MD5 (.../agents/x3.md) = 6c93fa27981b6a9e0fb2e13419135a1c
```

### Step 1: chmod 444 x3.md → POST inject (expect rollback)

Verbatim response:

```json
{
  "updated": 0,
  "total": 3,
  "files": [],
  "applied": [],
  "skipped": [
    {
      "path": "x3.md",
      "reason": "write_failed: EACCES: permission denied, open '/tmp/test-claude-project/.claude/agents/x3.md'"
    }
  ],
  "mode": "inject",
  "rolledBack": [
    "x2.md",
    "x1.md"
  ],
  "rollbackFailed": []
}
```

- `applied: []` ✓
- `rolledBack: ["x2.md", "x1.md"]` — exactly reverse order of successful writes (x1 written first, x2 second → rolled back x2 first, x1 second) ✓
- `rollbackFailed: []` ✓
- `skipped[0].reason` starts with `write_failed:` and contains EACCES ✓

### md5 AFTER rollback (must equal BEFORE)

```
MD5 (.../agents/x1.md) = 279c931e10ce20763cf4e9ad4a2260d4   ← UNCHANGED ✓
MD5 (.../agents/x2.md) = 8f30bd1a9718900f0f17720dde78a0dd   ← UNCHANGED ✓
MD5 (.../agents/x3.md) = 6c93fa27981b6a9e0fb2e13419135a1c   ← UNCHANGED (never written) ✓
```

All three md5 digests identical to BEFORE — rollback fully restored on-disk state. Atomic-semantic guarantee (best-effort) validated.

### Step 2: chmod 644 x3.md → POST inject (happy path)

Verbatim response:

```json
{
  "updated": 3,
  "total": 3,
  "files": ["x1.md", "x2.md", "x3.md"],
  "applied": ["x1.md", "x2.md", "x3.md"],
  "skipped": [],
  "mode": "inject",
  "rolledBack": [],
  "rollbackFailed": []
}
```

md5 AFTER (all different from BEFORE — header injected):

```
MD5 x1.md = 232ed47d1889ead9580ee0d315caa7e4   ← CHANGED ✓
MD5 x2.md = 963a057ac3a2bdeb7f1be2b7c314cce7   ← CHANGED ✓
MD5 x3.md = a7538c4572f733e2bd2ba912feaa7aeb   ← CHANGED ✓
```

### Step 3: Happy-path regression (single agent, empty new fields present)

```json
{
  "updated": 1,
  "total": 1,
  "files": ["x1.md"],
  "applied": ["x1.md"],
  "skipped": [],
  "mode": "inject",
  "rolledBack": [],
  "rollbackFailed": []
}
```

Both `rolledBack` and `rollbackFailed` present as empty arrays in happy path — contract guarantee preserved.

### Cleanup

Agents + header removed from `/tmp/test-claude-project/.claude/`.

## 5. Concerns

None blocking. Minor observations (informational, not actionable for this task):

- Inner rollback uses `plans.find((pp) => pp.name === applied[j])` which is O(n²) on very large agent sets. For sees-scale (~16 agents) this is trivially negligible. Future optimization (Map lookup) can be considered if agent counts ever exceed ~1000.
- POSIX best-effort caveat (disk full during rollback etc.) documented in spec §2 Q1; no transactional guarantee claimed. Current implementation correctly captures such failures into `rollbackFailed[]` without throwing.
- `rollbackFailed` entries stringify error via `re instanceof Error ? re.message : String(re)` — consistent with sibling patterns in the same file (read_failed / transform_failed / write_failed). No sentinel prefix, which matches the spec's `{path, reason}` shape exactly.

## 6. Verdict

**APPROVED.** Implementation matches SPEC §D-1 verbatim: Plan type extended with `original`, reverse-order best-effort rollback installed, response shape unconditionally extended with both new fields, no drive-by changes, all 4 gates + independent EIO repro confirm correctness. Implementer may proceed to commit with message `fix(agents): D-1 — apply-to-all Step 2 best-effort rollback`.
