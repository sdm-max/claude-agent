---
type: diff-review
task: T-F2.4a
spec_ref: .claude/pipeline/outbox/approved-F2-scope-20260420.md §T-F2.4 (split)
reviewer: Reviewer (claude-agent session)
created: 2026-04-20
verdict: APPROVED
---

# T-F2.4a Diff Review — `injectAgentHeader` regex detector + unit tests

- [x] APPROVED

## 대상 변경

2 파일 (CLAUDE.md "3+ 파일 금지" 준수):

| 파일 | 변경 유형 | 규모 |
|------|----------|-----|
| `src/lib/agent-header-inject.ts` | modify | +18 / −11 (29 lines touched) |
| `tests/unit/agent-header-inject.test.ts` | NEW | 92 lines, 7 tests |

## Diff 검증

### `src/lib/agent-header-inject.ts`

| 검사 항목 | 결과 |
|----------|------|
| 정규식 감지기 `/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n\|$)/` 로 `startsWith("---\n") + indexOf("\n---\n", 4)` 대체 | PASS |
| Post-condition throw `new Error("frontmatter_lost")` 추가 | PASS |
| `HEADER_START`/`HEADER_END` replace 경로 unchanged | PASS |
| `ensureTrailingNewline` helper unchanged | PASS |
| `stripAgentHeader` unchanged | PASS |
| Drive-by src/ 변경 없음 | PASS |

다른 working-tree modified/untracked 파일들 (ARCHITECTURE.md, page.tsx, HooksUnifiedEditor.tsx, bash-matcher-builder, worktrees) 은 S5/S6 prior work 소속, 본 task 무관 — 이 커밋 staging 대상이 아님을 Implementer 가 분별해야 함 (staging 은 2 파일만).

## Fixture ↔ SPEC Intent 대조 (7 tests)

| # | Fixture (SPEC 요구) | 테스트 이름 | SPEC 정합 |
|---|--------------------|-------------|----------|
| 1 | LF + 끝 `\n` | `inserts block AFTER frontmatter (LF + trailing newline)` | PASS |
| 2 | LF, 끝 `\n` 없음 (EOF-terminated) — **버그 케이스** | `inserts block AFTER frontmatter when closing fence has NO trailing newline (EOF)` | PASS (원 코드 prepend 로 falls-through → frontmatter 파괴되던 케이스 회귀 방지) |
| 3 | CRLF line endings | `handles CRLF line endings` | PASS |
| 4 | No frontmatter | `prepends block when there is NO frontmatter` | PASS |
| 5 | 이미 주입된 경우 replace/idempotent | `REPLACES existing block on second call (idempotent — only one block)` | PASS (발생 횟수 1 확인, 과거 content 제거 확인) |
| 6 | `name:` 값이 `---` 포함 (`my---prefix`) | `does NOT split frontmatter when a value contains '---'` | PASS (inline `---` 대신 진짜 terminating fence 뒤로 block 삽입) |
| 7 | `stripAgentHeader` round-trip | `stripAgentHeader round-trip removes the injected block cleanly` | PASS |

Skipped/todo tests: 0.

## 게이트 결과

| 게이트 | 상태 | 비고 |
|--------|------|------|
| `npx tsc --noEmit` | PASS | exit 0, no output |
| `npm run lint` | PASS | warnings/errors 0 |
| `npm run test` | PASS | 2 파일 / 8 tests (1 smoke + 7 new) |
| `.claude/hooks/e2e-scenarios.sh` | PASS | S1/S2/S3/S4 ALL PASS |

vitest verbose 출력 — 7 new tests 모두 `✓` 통과 확인. 0 skipped/todo.

## 판정

**APPROVED** — T-F2.4a (library + unit tests) 구현이 SPEC §T-F2.4 기술적 요구를 충족하며 (regex detector, post-condition, 6+1 fixtures), 모든 정식 게이트 통과. Staging 은 반드시 2 파일 (`src/lib/agent-header-inject.ts`, `tests/unit/agent-header-inject.test.ts`) 로 한정할 것.

## Carry-forward 우려사항 (T-F2.4b 후속 필수)

1. **SPEC §T-F2.4 Q3 dry-run 2-pass 조항 미구현** — 본 split 에서 의도적으로 T-F2.4b 로 분리됨. 대상: `src/app/api/projects/[id]/agent-header/apply/route.ts` (1차 패스에서 `frontmatter_lost` throw 시 해당 에이전트 스킵 + 오류 수집 → 2차 일괄 적용). T-F2.4b 가 완료되어야 F-2 T4 Apply-to-all blast radius 방어가 완성됨. Route 2-pass 없이 library 만 배포 시 throw 가 HTTP 500 으로 전파되어 UI 가 단일 에이전트 failure 를 전체 실패로 노출할 위험 있음.
2. **다른 호출자 확인 필요 (T-F2.4b 작업 범위)** — `injectAgentHeader` 호출자 중 throw 비대응 경로가 있는지 grep 재확인 권장.
3. **Guard 0c silent bypass 전제** — 이전 세션 (session-2026-04-19.md 참조) hook line 49 pipefail 버그 미패치 상태. 본 review 는 Reviewer APPROVED outbox 파일을 제공하여 정상 경로로 commit 가능하게 함 — 이 bypass 경로 의존 아님.
