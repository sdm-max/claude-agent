# Diff Review — D-4 (Hook Git Tracking Policy, B안)

- **Task**: D-4 — `.claude/hooks/e2e-scenarios.sh` 팀 공유를 위한 `.example` 템플릿 + `.gitignore` 예외 규칙
- **Verdict**: [x] **APPROVED**
- **Reviewed**: 2026-04-22
- **Scope**: `.gitignore` (1 hunk) + `.claude/hooks/e2e-scenarios.sh.example` (new file, via worktree agent)

---

## 1. `.gitignore` Diff Stat

```diff
@@ -44,4 +44,8 @@ next-env.d.ts
 /data/*.db
 /data/*.db-wal
 /data/*.db-shm
-.claude/
+# Ignore all of .claude/ except hook example templates (D-4 B안)
+.claude/*
+!.claude/hooks/
+.claude/hooks/*
+!.claude/hooks/*.example
```

- 단일 rule `.claude/`를 4-line 패턴으로 교체 + 설명 주석 1줄
- 다른 변경 없음 ✓

## 2. Gitignore Rule 검증 (git check-ignore -v)

| Path | Rule Matched | Status | Expected |
|------|--------------|--------|----------|
| `.claude/settings.json` | `.gitignore:48:.claude/*` | IGNORED | ✓ ignored |
| `.claude/hooks/e2e-scenarios.sh` | `.gitignore:50:.claude/hooks/*` | IGNORED | ✓ ignored (실제 hook 보호) |
| `.claude/hooks/e2e-scenarios.sh.example` | `.gitignore:51:!.claude/hooks/*.example` | UN-IGNORED | ✓ trackable |

- `git add -n .claude/hooks/e2e-scenarios.sh.example` → `add '.claude/hooks/e2e-scenarios.sh.example'` ✓
- `git status --short`: `M .gitignore` + `?? .claude/` (예상대로 — `.claude/` 안에 신규 trackable 파일 존재)

## 3. Hook Example 구조

- `bash -n .claude/hooks/e2e-scenarios.sh.example` → syntax OK
- `head -25`: 15-line docstring header 존재
  - "TEMPLATE — Copy to .claude/hooks/e2e-scenarios.sh and customize."
  - "This file is tracked in git; the real hook is ignored."
  - Setup 커맨드 (`cp ... && chmod +x`)
  - Prerequisites (dev server + test project)
  - Dated: 2026-04-22 (D-4 B안)
- `diff e2e-scenarios.sh e2e-scenarios.sh.example` → `.example`가 15-line 헤더 prepend, 나머지 로직 동일 ✓

## 4. Regression Gates (current tree)

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | exit 0 ✓ |
| `npm run test` | 74 pass (9 files) ✓ |
| `bash .claude/hooks/e2e-scenarios.sh` | ALL PASS (S1~S6) ✓ |

실제 hook 여전히 작동 — D-4 변경은 D-5까지 무결성 유지.

---

## 결론

B안 구현 정확. `.gitignore` 4-line 패턴이 의도한 대로 작동:
- 기존 `.claude/` 전역 ignore 유지 (settings.json 등 민감 파일 보호)
- `.claude/hooks/*.example`만 화이트리스트 → 팀이 hook 템플릿 공유 가능
- 실제 hook (`e2e-scenarios.sh`)는 계속 ignore → 로컬 커스터마이즈 안전

Implementer는 본 APPROVED로 D-4 커밋 진행 가능.
