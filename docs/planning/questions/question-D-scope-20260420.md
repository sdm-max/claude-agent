# question-D-scope — F-2 후속 리팩터/정리 sprint

- **요청자**: Implementer
- **생성**: 2026-04-20
- **유형**: question (scope + commit plan)

## 배경
F-2 + HK 완료 (44 커밋 push). 각 task diff-review에 명시된 후속(backlog) 항목을 D sprint로 모아 처리.

## 제안 Task

| Task | 파일 | 메시지 | 근거 |
|------|------|--------|------|
| D-1 | `src/app/api/projects/[id]/agent-header/apply/route.ts` (1) | `fix(agents): D-1 — apply-to-all Step 2 best-effort rollback` | T-F2.4b diff-review concern: mid-write EIO/ENOSPC 시 이미 쓴 파일 롤백 |
| D-2 | `src/lib/fs-watcher/index.ts` (1) | `refactor(fs-watcher): D-2 — depth cap 상수화` | T-F2.5 diff-review concern: 5/4 리터럴을 chokidar depth 상수와 통합 |
| D-3a | `src/lib/workflows/validate.ts` (신규) + `src/app/api/workflows/route.ts` | `refactor(workflows): D-3a — isValidItem을 lib로 분리 (POST 이전)` | T-F2.6 diff-review concern: `[id]/route.ts` → `../route` cross-import 해소 |
| D-3b | `src/app/api/workflows/[id]/route.ts` | `refactor(workflows): D-3b — PATCH가 lib isValidItem 사용` | D-3a 완료 후 소비자 교체 |

**합계**: 4 커밋, 각 1-2파일.

## 별건 처리 (D sprint 밖)
- **D-4** `.claude/hooks/**` git 추적 여부 — 정책 결정. 사용자에게 별도 질문.
- **D-5** D-2 Undo 불완전 · C-3/E-1 Detail Dialog regression — 재조사 필요. 증상 재현부터 시작하는 별 investigation task로 분리.

## 수용 조건 (각 task 공통)
- lint + test(8/8 이상) + build + e2e-scenarios.sh ALL PASS
- Guard 0c per-task `outbox/diff-review-D-<n>*.md` `[x] APPROVED`
- 회귀 검증: 변경 API 직접 curl 또는 기존 테스트 경로 재현

## D-1 세부
- 현 2-pass: Step 2 mid-write 실패 시 skipped에 에러 append하지만 이전 파일들의 write는 이미 완료. 복원 불가.
- 개선안: Step 1 dry-run 시 each file의 `original` 을 Plan에 함께 저장. Step 2 write 실패 감지 시 역순으로 `fs.writeFileSync(full, original)` 시도 (best-effort, 실패해도 에러 리스트에 기록하고 계속). 최종 응답에 `rolledBack`/`rollbackFailed` 필드 추가.
- 위험: rollback 자체도 실패 가능(디스크 full 등) — 그 경우도 기록만. 트랜잭션 보장은 불가능 (POSIX 한계).

## D-2 세부
- 현재: chokidar `depth: 4` (project) / `depth: 3` (home), classifier cap은 리터럴 5/4. 파일 상단에 주석만 있음.
- 개선안: 모듈 상단에 `const PROJECT_WATCH_DEPTH = 4; const HOME_WATCH_DEPTH = 3;` 선언. chokidar config + classifier cap 모두 상수 참조.

## D-3 세부
- 현재: `src/app/api/workflows/route.ts`에 `isValidItem` + `WorkflowItem` 정의, `[id]/route.ts`가 `../route`에서 import (Next route 간 직접 의존, 유지보수 안티패턴).
- 개선안: `src/lib/workflows/validate.ts` 신규 (pure function + interface). 두 route가 동일 lib을 import.
- 3파일 → CLAUDE.md 2파일 규칙 준수 위해 D-3a(lib 신규 + POST consumer 교체) / D-3b(PATCH consumer 교체)로 분할.

## 질문
1. D-1 세부 접근 OK? (best-effort rollback + 응답 shape 확장)
2. D-2 상수명 `PROJECT_WATCH_DEPTH` / `HOME_WATCH_DEPTH` 적절? 다른 네이밍 선호?
3. D-3 lib 경로 `src/lib/workflows/validate.ts`? 다른 위치 선호?
4. 순서 D-1 → D-2 → D-3a → D-3b OK?
5. D-4/D-5는 별 질문으로 분리하는 것 OK?

## 추천
D-1 → D-2 → D-3a → D-3b 4 커밋 그대로. D-4/D-5 별건.
