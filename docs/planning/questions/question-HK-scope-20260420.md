# question-HK-scope — Housekeeping Sprint 범위 문의

- **요청자**: Implementer
- **생성**: 2026-04-20
- **유형**: question (scope + commit plan)

## 배경
F-2 Bugfix Sprint 완료 후 unstaged 변경 정리 필요. 기존 S5(Bash 빌더) / S6(Worktrees 탭) / S7(문서) 기능 코드가 untracked/unstaged로 남아있음. APPROVED-F2-scope §Q5에서 "F-2 밖에서 처리"로 결정된 바 있음.

## 파일 인벤토리 (git status 기반)

### Modified
- `docs/ARCHITECTURE.md` — Worktrees 7탭, S6 API 추가, R4/R5 완료 반영
- `src/app/projects/[id]/page.tsx` — 7번째 탭 wire
- `src/components/editors/HooksUnifiedEditor.tsx` — BashMatcherBuilder 연동

### Untracked
- `REVIEW.md` — /code-review + /ultrareview 공통 설정
- `src/lib/bash-matcher-builder.ts` — S5 라이브러리
- `src/components/bash-matcher-builder/BashMatcherBuilder.tsx` — S5 UI
- `src/app/api/projects/[id]/worktrees/route.ts` — S6 목록 API
- `src/app/api/projects/[id]/worktrees/rules-diff/route.ts` — S6 diff API
- `src/app/api/projects/[id]/worktrees/rules-sync/route.ts` — S6 sync API
- `src/components/worktrees/WorktreesTab.tsx` — S6 UI

## 제안 분할 (2파일 한도 준수)

| Task | 파일 | 메시지 |
|------|------|-------|
| HK-1 | `REVIEW.md` | `chore(docs): REVIEW.md 추가 (code-review 공통 설정)` |
| HK-2 | `docs/ARCHITECTURE.md` | `chore(docs): ARCHITECTURE.md — S5/S6/S7 반영` |
| HK-3 | `src/lib/bash-matcher-builder.ts` + `src/components/bash-matcher-builder/BashMatcherBuilder.tsx` | `feat(hooks): S5 — Bash 화이트리스트 빌더 (lib + UI)` |
| HK-4 | `src/components/editors/HooksUnifiedEditor.tsx` | `feat(hooks): S5 — HooksUnifiedEditor에 BashMatcherBuilder 연동` |
| HK-5 | `src/app/api/projects/[id]/worktrees/route.ts` + `src/app/api/projects/[id]/worktrees/rules-diff/route.ts` | `feat(worktrees): S6 — worktrees 목록 + rules-diff API` |
| HK-6 | `src/app/api/projects/[id]/worktrees/rules-sync/route.ts` | `feat(worktrees): S6 — rules-sync API` |
| HK-7 | `src/components/worktrees/WorktreesTab.tsx` | `feat(worktrees): S6 — WorktreesTab 컴포넌트` |
| HK-8 | `src/app/projects/[id]/page.tsx` | `feat(worktrees): S6 — 프로젝트 페이지 7번째 탭 연동` |

총 8 커밋, 각 1-2 파일 준수.

## 게이트
각 커밋 전 lint + test + build + e2e-scenarios.sh ALL PASS 필수. Guard 0c는 per-task `outbox/diff-review-HK-<n>*.md` `[x] APPROVED` 필요.

## 질문
1. 분할 OK? 다른 그룹핑 선호?
2. HK-3/HK-4 (S5 lib+UI → wire)와 HK-5~HK-8 (S6) 순서 OK? 또는 S6부터?
3. REVIEW.md와 ARCHITECTURE.md는 상단 2 커밋으로 충분한가 아니면 하나로 합쳐도 되는가 (docs만 2개는 2-file 한도 내 1 커밋 허용)?
4. Implementer 추천: 본 8분할 그대로, HK-1 → HK-8 순서 진행.
