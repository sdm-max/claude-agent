# Planning Archive — 작업 기획서 & 증거

세션 2026-04-18 ~ 2026-04-22 (3-Claude 파이프라인 오케스트레이션)의 **기획서 · 질문 · 조사 · 검증 증거** 아카이브. 원본은 `.claude/pipeline/` (gitignored). 이 디렉터리는 감사 가능한 공유 사본.

## 구조

| 경로 | 내용 | 파일 수 |
|------|------|-------|
| `scopes/` | Reviewer APPROVED sprint 기획서 | 7 |
| `questions/` | Implementer가 Reviewer에 올린 스코프 질문 | 5 |
| `investigations/` | 독립 에이전트 조사 보고 | 2 |
| `reviews/` | 각 task별 diff-review (APPROVED 또는 거부 로그) | 34 |
| `evidence/` | gate 실행 증거, critique, spec 수정 요청 | 10 |

## 주요 Sprint 기획서 (`scopes/`)

| Sprint | 파일 | 요지 |
|--------|------|------|
| **F-2 Bugfix** | `approved-F2-scope-20260420.md` | /ultrareview 6 고유 finding fix. 7 task (T-F2.1 ~ T-F2.7, T-F2.4 split a/b) |
| **HK Housekeeping** | `approved-HK-scope-20260420.md` | S5/S6/S7 unstaged 파일 커밋 정리. 8 task |
| **D Backlog cleanup** | `approved-D-scope-20260420.md` | apply rollback · fs-watcher 상수화 · isValidItem lib 분리. 4 task |
| **S-1 🔴 Security** | `approved-S-1-scope-20260420.md` | 블라인드 리뷰 I-1 (rules-sync/diff 임의 경로) 긴급 fix |
| **Q Quality** | `approved-Q-scope-20260420.md` | F-2/D fix 회귀 방어 테스트. 6 task (unit + integration) |
| **N-5 Nit** | `approved-N-5-scope-20260420.md` | sanitize 에러 code 필드 추가 |
| **D-5 P1** | `approved-D-5-scope-20260420.md` | Undo extraFiles 언링크 + shared-path + UI 가드 분리 |

## 조사 보고 (`investigations/`)

| 파일 | 주제 | 판정 |
|------|------|------|
| `investigation-D-5-20260420.md` | D-2 Undo 불완전 · C-3/E-1 Detail Dialog regression | D-2 **P1 confirmed**, C-3 feature gap, E-1 부분 P2 |
| `investigation-T-001-20260418-103512.md` | (이전 세션) | — |

## 블라인드 독립 리뷰 (2회)

파이프라인 외부 — 세션 컨텍스트 없는 신규 에이전트가 git range만 보고 REVIEW.md 기준 평가.

**1차** `e280eaa..f1897eb` (F-2 + HK + D 28 commits)
- 결과: **2 important + 5 nits**
- Important
  - I-1: rules-sync/diff 임의 경로 취약점 (**S-1 ad3c689로 해소**)
  - I-2: 신규 API routes e2e 커버리지 부족 (**Q sprint로 해소**)
- Nit 5건 (N-5는 fix, 나머지는 backlog)

**2차** `f1897eb..a3b4013` (10 commits 후속)
- 결과: **0 important + 3 nits + 1 pre-existing**
- I-1 closure 확정 (11 공격 벡터 전수 400)
- D-5.1 shared-path live 재현 확인
- Q 테스트 전수 "regression-effective" 판정
- 2차 nits는 `scopes/`/`evidence/` 문서에 반영 (N-D5.1a/b, N-commit-msg pattern)

두 리뷰 결과는 conversation 로그에 inline 기록 (블라인드 에이전트가 `.claude/pipeline/inbox/` 쓰기 deny로 차단됨).

## 최종 원격 반영

- 커밋 범위 (이 아카이브 시점 기준): `e280eaa..c8e584c`
- `origin/main` 동기화
- vitest 74 pass (unit 66 + integration 8)
- e2e-scenarios S1~S6 ALL PASS

## 관련 파일

- 상세 타임라인: `../worklog/session-2026-04-20.md`, `../worklog/session-2026-04-22.md`
- 아키텍처: `../ARCHITECTURE.md`
- 프로젝트 개요: `../PROJECT.md`
- 리뷰 기준: `../../REVIEW.md`
- 프로젝트 규칙: `../../CLAUDE.md`

## 향후 참조

다음 세션에서 sprint 기획 참고:
1. **scope 작성 패턴**: `scopes/approved-F2-scope-*.md` — 질문 → 답변 → per-task 수용 조건 → 커밋 순서
2. **Reviewer 검증 패턴**: `reviews/diff-review-*.md` — 재실행 게이트 + 독립 repro + diff 스코프 확인
3. **Investigation 패턴**: `investigations/investigation-D-5-*.md` — 재현성 / 원인 / fix 범위 / 커버리지 제안

## 주의사항

- 이 디렉터리는 **참고용 아카이브**. 실제 파이프라인 상태는 `.claude/pipeline/` (untracked) 원본 유지.
- 향후 새 스크린트 기획 시 `.claude/pipeline/inbox/question-*.md` 먼저 작성 → Reviewer APPROVED → 여기로 복사 (아카이브 관례).
- `reviews/` 내 diff-review 파일은 `[x] APPROVED` 라인을 Guard 0c hook이 체크 — 복사본은 무효, 원본만 유효.
