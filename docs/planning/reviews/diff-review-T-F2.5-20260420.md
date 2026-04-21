---
task: T-F2.5
type: diff-review
date: 2026-04-20
reviewer: Reviewer Claude
subject: fs-watcher classifier — nested rules 지원 + leaf helper + depth cap
spec: approved-F2-scope-20260420.md §T-F2.5
verdict: APPROVED
---

# Diff Review — T-F2.5

- [x] APPROVED

## 변경 파일 (diff stat)

| 파일 | +/- |
|------|-----|
| `src/lib/fs-watcher/index.ts` | +23 / -6 |

단일 파일. drive-by 변경 없음. `git status --short` 확인 — 다른 unstaged 항목(`docs/ARCHITECTURE.md`, `src/app/projects/[id]/page.tsx`, `src/components/editors/HooksUnifiedEditor.tsx`, untracked REVIEW.md / worktrees / bash-matcher-builder 디렉터리)은 본 task와 무관(사전 존재, SPEC Q5에서 F-2 범위 밖으로 처리 합의).

## 코드 검증 (classifier 의도 일치)

| 항목 | 기대 | 실측 |
|------|------|------|
| `leaf` 헬퍼 | project + home 양쪽에 `const leaf = parts[parts.length - 1] ?? ""` | ✅ 두 함수 모두 도입 |
| 하드코딩 제거 | `parts[2]?.endsWith(".md")` 제거 | ✅ project/home에서 사라짐 |
| Project rules depth | `parts.length >= 3 && <= 5` (chokidar depth:4 + ".claude" prefix) | ✅ |
| Home rules depth | `parts.length >= 2 && <= 4` (chokidar depth:3) | ✅ |
| Project agents flat-only | `parts.length === 3` | ✅ |
| Project hooks flat-only | `parts.length === 3` | ✅ |
| Home agents flat-only | `parts.length === 2` | ✅ |
| Home hooks flat-only | `parts.length === 2` | ✅ |
| Skills subdir behavior | `parts.length >= 3` / `>= 2` 유지 | ✅ |
| claude.md / settings.json / managed-settings.json 인식 | 변경 없음 | ✅ |

## 독립 Live SSE 증거 (neutral fixtures)

Endpoint: `GET /api/projects/$TP/events` (SPEC의 표기 `/api/events/project/:id`는 오기, 실제 경로는 `/api/projects/:id/events`)

Fixture 세트:
- `.claude/rules/flat.md` (flat)
- `.claude/rules/nested/deeper/x.md` (project 4-parts-under-.claude, 총 parts=4, depth cap 5 이내)
- `.claude/agents/q.md` (flat agent)
- `.claude/agents/nested/r.md` (nested agent — NOT allowed)
- `.claude/rules/a/b/c/d.md` (depth breach, parts=6)

SSE log (paced, clean state):
```
data: {"kind":"ready"}
data: {"kind":"rules","relativePath":".claude/rules/flat.md","op":"add"}
data: {"kind":"rules","relativePath":".claude/rules/nested/deeper/x.md","op":"add"}
data: {"kind":"agents","relativePath":".claude/agents/q.md","op":"add"}
```

검증 매트릭스:

| 기대 | 결과 |
|------|------|
| `rules` event ending `/x.md` (nested) | ✅ 라인 3 |
| `rules` event with `/flat.md` | ✅ 라인 2 |
| `agents` event with `/q.md` | ✅ 라인 4 |
| NO `agents` event with `nested/r.md` | ✅ 미등장 |
| NO `rules` event with `a/b/c/d.md` | ✅ 미등장 (depth cap 차단) |

Cleanup 완료: `/tmp/test-claude-project/.claude/` 에 `settings.local.json`만 잔존.

## Gate 결과

| Gate | 결과 |
|------|------|
| `git status --short` | fs-watcher/index.ts 외 모두 사전 unstaged (무관) ✅ |
| `npx tsc --noEmit` | exit 0 ✅ |
| `npm run lint` | no warnings ✅ |
| `npm run test` | 8 pass / 2 files ✅ |
| `.claude/hooks/e2e-scenarios.sh` | ALL PASS (S1~S4) ✅ |
| Independent SSE live probe | 5/5 기대치 일치 ✅ |

## Concerns

1. **Depth cap ↔ chokidar depth 커플링 (low)**: rules의 `parts.length <= 5` (project) / `<= 4` (home)는 chokidar `depth: 4` / `depth: 3` 설정과 암묵 일치. 향후 watcher depth 조정 시 classifier 상수도 함께 업데이트 필요 — 주석으로 인라인 기록되어 있으나 `const PROJECT_WATCH_DEPTH = 4` 류 중앙화를 follow-up으로 권장(blocking 아님).
2. **`relLower` 소문자화 (home)**: `classifyHomePath`의 `toLowerCase()`는 기존 동작 유지. `Rules/Foo.md` 같은 대소문자 변형도 user-rules로 잡히나, macOS HFS+ 기본이 case-insensitive라 실측 영향 없음.

## 최종

APPROVED. SPEC §T-F2.5 요건(하드코딩 제거, leaf 도입, project ≤5 / home ≤4 depth cap, agents/hooks flat-only 유지, skills 보존) 및 Acceptance(flat 회귀 없음 + nested 지원 + depth 초과 무시) 전부 통과. 독립 live SSE 로그로 5/5 기대치 증명.
