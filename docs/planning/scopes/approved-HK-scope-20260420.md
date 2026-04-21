---
task: HK (Housekeeping Sprint, HK-1 ~ HK-8)
decision: APPROVED
scope_ref: .claude/pipeline/inbox/question-HK-scope-20260420.md
answers:
  Q1_split_ok: "YES (with minor amendment — see below)"
  Q2_order_ok: "YES — dependency chain verified"
  Q3_docs_merge: "SEPARATE (keep HK-1/HK-2 as-is — clearer audit trail)"
  Q4_recommendation: "ACCEPTED verbatim (no re-ordering, no merging)"
author: Reviewer
created: 2026-04-20
---

[x] APPROVED

# Housekeeping Sprint 범위 승인 — HK-1 ~ HK-8

## 1. 사전 검증

Reviewer 독립 실행 결과:
- `git status --short`: `M docs/ARCHITECTURE.md`, `M src/app/projects/[id]/page.tsx`, `M src/components/editors/HooksUnifiedEditor.tsx`, `?? REVIEW.md`, `?? src/app/api/projects/[id]/worktrees/`, `?? src/components/bash-matcher-builder/`, `?? src/components/worktrees/`, `?? src/lib/bash-matcher-builder.ts`
- `git diff --stat`: ARCHITECTURE.md +15/-3, page.tsx +6, HooksUnifiedEditor.tsx +78
- Implementer 인벤토리와 **정확히 일치** (8개 파일/디렉토리 그룹).

## 2. 의존성 검증 (순서 정당성)

| From → To | 발견된 심볼 | 결론 |
|-----------|-------------|------|
| HK-3 (BashMatcherBuilder.tsx) → HK-4 (HooksUnifiedEditor.tsx) | `import BashMatcherBuilder from "@/components/bash-matcher-builder/BashMatcherBuilder"` (line 25), `<BashMatcherBuilder>` (line 453) | HK-3이 HK-4 선행 필수 |
| HK-5/6 (worktrees API) → HK-7 (WorktreesTab.tsx) | `fetch('/api/projects/${projectId}/worktrees/rules-diff...')` (line 95), `...rules-sync` (line 139) | API 선행 필수 |
| HK-7 (WorktreesTab.tsx) → HK-8 (page.tsx) | `import WorktreesTab from "@/components/worktrees/WorktreesTab"` (line 14), `<WorktreesTab projectId={id}>` (line 396) | HK-7이 HK-8 선행 필수 |

Implementer가 제안한 HK-1 → HK-8 순서는 모든 dependency edge를 위반하지 않는다. **순서 유지**.

## 3. 질문별 판정

### Q1. 분할 OK?
**YES — 2파일 한도 엄수, 그룹핑 합리적.**

- HK-3 (lib+UI 2 파일 페어링): sees 프로젝트 유형 sees의 S4/S5 패턴과 일치. lib 단독 커밋은 동작 불가능한 데드 코드 덩어리가 남아 Guard 0d e2e-scenarios 통과가 모호해질 수 있음. **lib+UI 페어링이 옳다**.
- API 3 routes 번들링 거부: CLAUDE.md "1 task = 1~2 파일" 규칙 엄격. 3 파일 1 커밋은 2-file 초과. HK-5(목록+diff 2 files) + HK-6(sync 1 file) 2분할이 규칙 준수 + 논리 응집도 동시 만족 (목록/diff는 읽기 쌍, sync는 쓰기 단독 — cohesion 기준으로도 적절).
- **Amendment**: 없음.

### Q2. 순서 OK?
**YES — HK-1 → HK-8 확정.**

- docs 2개(HK-1/HK-2) 먼저: diff 덩어리에서 문서 제거 → 이후 기능 커밋의 diff-review가 깔끔해짐.
- S5 (HK-3/4) → S6 (HK-5/6/7/8): 두 feature 독립 (cross-import 없음 확인). S5 먼저든 S6 먼저든 기술적 무관.
- S6 내부 의존성 체인: HK-5/6 (API) → HK-7 (component) → HK-8 (page wire) — **엄격 강제**.

### Q3. 2 docs 커밋 합치기 vs 분리?
**분리 유지 (HK-1 + HK-2 별개 커밋).**

- 근거: (a) REVIEW.md는 신규 파일(review 도구 공통 설정), ARCHITECTURE.md는 S5/S6/S7 반영. 관심사 이질적. (b) 2 file 1 커밋은 규칙 내 허용이나 "chore(docs): X + Y" 형태 메시지는 audit 검색/revert 난이도 상승. (c) 별개 scope (`docs` subject 동일해도 content 무관).
- 1 커밋 합치기는 **권장하지 않음**. Implementer 제안(2 커밋 유지) 채택.

### Q4. Implementer 추천 채택?
**채택 (verbatim, 수정 없음).**

## 4. Per-task 수락 기준 (Per-commit Gate)

**각 HK-<n> 커밋 이전** 다음 4 gate 전수 통과 필수:

1. `npm run lint` — 에러 0
2. `npm run test` — 전수 pass
3. `npm run build` — 성공
4. `.claude/hooks/e2e-before-commit.sh` — Guard 1/0c/0d/TSC/dev/e2e-scenarios 전부 PASS

추가: **Guard 0c**가 `.claude/pipeline/outbox/diff-review-HK-<n>-*.md` 파일에 `[x] APPROVED` 라인을 요구한다. Implementer는 각 HK-<n> commit 이전 Reviewer에게 per-task diff-review 요청(inbox) 올리고, Reviewer outbox APPROVED 수령 후에만 커밋 가능.

## 5. 커밋 순서 (확정)

```
HK-1 → HK-2 → HK-3 → HK-4 → HK-5 → HK-6 → HK-7 → HK-8
```

| 순서 | Task | 파일 | 메시지 |
|-----|------|------|-------|
| 1 | HK-1 | `REVIEW.md` | `chore(docs): REVIEW.md 추가 (code-review 공통 설정)` |
| 2 | HK-2 | `docs/ARCHITECTURE.md` | `chore(docs): ARCHITECTURE.md — S5/S6/S7 반영` |
| 3 | HK-3 | `src/lib/bash-matcher-builder.ts` + `src/components/bash-matcher-builder/BashMatcherBuilder.tsx` | `feat(hooks): S5 — Bash 화이트리스트 빌더 (lib + UI)` |
| 4 | HK-4 | `src/components/editors/HooksUnifiedEditor.tsx` | `feat(hooks): S5 — HooksUnifiedEditor에 BashMatcherBuilder 연동` |
| 5 | HK-5 | `src/app/api/projects/[id]/worktrees/route.ts` + `.../rules-diff/route.ts` | `feat(worktrees): S6 — worktrees 목록 + rules-diff API` |
| 6 | HK-6 | `src/app/api/projects/[id]/worktrees/rules-sync/route.ts` | `feat(worktrees): S6 — rules-sync API` |
| 7 | HK-7 | `src/components/worktrees/WorktreesTab.tsx` | `feat(worktrees): S6 — WorktreesTab 컴포넌트` |
| 8 | HK-8 | `src/app/projects/[id]/page.tsx` | `feat(worktrees): S6 — 프로젝트 페이지 7번째 탭 연동` |

## 6. 금지 항목 재확인

- `--no-verify`, `-n`, `--amend`, `core.hooksPath` 변경 — 영구 금지.
- 3+ 파일 동시 수정 금지 (HK-3, HK-5만 2 파일. 나머지 1 파일).
- Reviewer outbox `diff-review-HK-<n>-*.md` APPROVED 없이 commit 시도 금지.

## 7. 세션 종료 의무

8 커밋 완료 후:
- `pipeline/state/current-task.md` 최신화 (HK sprint 완료)
- `docs/worklog/session-2026-04-20.md` append
- `pipeline/log/implementer.jsonl` append

---

**판정 종합**: APPROVED. Implementer 제안 8분할 · HK-1 → HK-8 순서 · docs 분리 2커밋 — **그대로 채택**. 진행 가능.
