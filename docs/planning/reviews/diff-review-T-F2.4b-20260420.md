---
task: T-F2.4b
type: diff-review
date: 2026-04-20
reviewer: Reviewer Claude
subject: Agent header apply — 2-pass dry-run + commit (atomic / zero-write on error)
spec: approved-F2-scope-20260420.md §T-F2.4 Q3
verdict: APPROVED
---

# Diff Review — T-F2.4b

- [x] APPROVED

## 변경 파일 (diff stat)

| 파일 | +/- |
|------|-----|
| `src/app/api/projects/[id]/agent-header/apply/route.ts` | +30 / -7 |

단일 파일. drive-by 변경 없음. 404(project not found) / 400(invalid mode) / 404(missing header file) 분기 전부 UNCHANGED.

## 2-Pass 동작 검증

| 항목 | 기대 | 실측 |
|------|------|------|
| (a) Step 1 dry-run 루프가 `plans[]` + `skipped[]` 수집 | yes | ✅ read 실패 시 `read_failed`, transform 실패 시 `transform_failed` |
| (b) Step 2 commit 루프가 `skipped.length === 0` 가드 | yes | ✅ if 블록으로 전체 commit 차단 |
| (c) 응답에 `applied`, `skipped`, `updated`, `total`, `files`, `mode` | all present | ✅ 아래 e2e 응답 참고 |
| (d) 에러 분기 (project 404 / invalid mode / header missing 404) 변경 없음 | unchanged | ✅ diff 확인 |
| (e) drive-by | none | ✅ |
| (f) `updated` = `applied.length` backwards compat | 일치 | ✅ |
| (g) write 실패 시 `write_failed` + break (잔여 파일 중단) | 안전 | ✅ (단, 첫 1~N개가 이미 써졌을 수 있음 — 제한 아래 concerns 참고) |

## Zero-Write Contract — 증거

Fixture: `/tmp/test-claude-project/.claude/agents/` 에 alpha/beta (정상) + gamma (chmod 000)

**BEFORE md5**:
- alpha.md: `c9be849483aba804840209c552297833`
- beta.md: `75639c63de9a37bc9036488a88d1c96d`

**inject 호출 (gamma 읽기 불가)**:
```json
{"updated":0,"total":3,"files":[],"applied":[],
 "skipped":[{"path":"gamma.md","reason":"read_failed: EACCES: permission denied, open '/tmp/test-claude-project/.claude/agents/gamma.md'"}],
 "mode":"inject"}
```

**AFTER md5** (한 파일도 쓰이지 않음):
- alpha.md: `c9be849483aba804840209c552297833` ✅ 일치
- beta.md: `75639c63de9a37bc9036488a88d1c96d` ✅ 일치

## 정상 경로 (chmod 644 복구 후)

**inject**:
```json
{"updated":3,"total":3,"files":["alpha.md","beta.md","gamma.md"],
 "applied":["alpha.md","beta.md","gamma.md"],"skipped":[],"mode":"inject"}
```

**strip**:
```json
{"updated":3,"total":3,"files":["alpha.md","beta.md","gamma.md"],
 "applied":["alpha.md","beta.md","gamma.md"],"skipped":[],"mode":"strip"}
```

Strip 후 md5 원본과 일치 → inject/strip 라운드트립 손실 없음.

## Schema Backwards Compat

| 필드 | 이전 | 현재 | 상태 |
|------|------|------|------|
| `updated` | number | number (= applied.length) | ✅ kept |
| `total` | number | number | ✅ kept |
| `files` | string[] | string[] (= applied) | ✅ kept |
| `mode` | string | string | ✅ kept |
| `applied` | — | string[] | ➕ added |
| `skipped` | — | `{path, reason}[]` | ➕ added |

기존 클라이언트 무중단. 신규 필드는 opt-in.

## Gate 결과

| Gate | 결과 |
|------|------|
| `git status --short` | 관련 파일만 (무관 noise 기존 동일) ✅ |
| `npx tsc --noEmit` | exit 0 (no output) ✅ |
| `npm run lint` | no warnings ✅ |
| `npm run test` | 8 pass / 2 files ✅ |
| `e2e-scenarios.sh` | ALL PASS (S1~S4) ✅ |
| Independent e2e (fixture 7a~7f) | 모두 기대치 일치 ✅ |

## Concerns

1. **부분 write 리스크 (low)**: Step 2 루프 안에서 n번째 파일 write가 EIO/ENOSPC 등으로 실패하면 그 이전 n-1개는 이미 디스크에 반영됨. 현 코드는 `break`로 추가 쓰기만 막지만 롤백은 없음. 이는 POSIX fs 원자성 한계이며 별도 "best-effort rollback" 작업으로 follow-up 권장 (T-F2.4c?). 현 스펙은 "pre-flight 검증 후 commit" 만 요구하므로 blocking 아님.
2. 응답의 `updated`/`files`가 `applied`와 완전히 동의어가 된 점은 schema 문서화 시 명시 권장.

## 최종

APPROVED. T-F2.4 Q3 스펙 요건(2-pass, zero-write on any skip, backwards-compatible response)을 모두 충족. 별도 개선은 concerns 1만 follow-up 후보.
