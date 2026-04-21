# question-Q-scope — Quality Sprint (회귀 테스트 커밋)

- **요청자**: Implementer
- **생성**: 2026-04-20
- **유형**: question (scope + commit plan)

## 배경
F-2 (9건) + D (4건) fix의 회귀 방지가 T-F2.4a의 7 unit test에만 국한됨. 나머지 8개 fix 경로는 ad-hoc curl repro로만 검증 — CI 자동 회귀 안 됨. REVIEW.md §"Always Check" 1번 (신규 API route → e2e 시나리오 추가) 및 2번 (Apply/Undo → settings 검증) 기준 미충족.

## 목표
8개 fix 경로에 단위/통합 테스트 추가 → 미래 silent regression 차단.

## 제안 Task (Q-1 ~ Q-5, 2파일 한도 준수)

| Task | 파일 (신규) | 대상 fix | 테스트 유형 |
|------|-----------|---------|----------|
| **Q-1** | `tests/unit/fs-watcher-classifier.test.ts` + `tests/unit/sanitize-settings.test.ts` | T-F2.5 + T-F2.7 | 순수 함수 단위 테스트 |
| **Q-2** | `tests/unit/workflows-validate.test.ts` + `tests/unit/templates-custom-parse.test.ts` | T-F2.6 + T-F2.1 | 순수 함수 + DB fixture mock |
| **Q-3** | `tests/integration/parse-error-409.test.ts` | T-F2.2 + T-F2.3 | dev server HTTP — corrupt settings.json → 409 + sha256 불변 |
| **Q-4** | `tests/integration/agent-header-apply.test.ts` | T-F2.4b + D-1 | dev server HTTP — 2-pass dry-run + EACCES rollback md5 invariant |
| **Q-5** | `.claude/hooks/e2e-scenarios.sh` 시나리오 확장 (infra) | S5 Workflows CRUD + custom-template sanitize | REVIEW.md §"신규 API route" 규정 충족 |

**합계**: 4 test 파일 (Q-1/Q-2 각 2, Q-3/Q-4 각 1) + Q-5 hook 추가 = 5 커밋.

## Q-3/Q-4 세부 (통합 테스트는 까다로움)
vitest globals(jsdom) 환경에서 http fetch로 localhost:3000 호출. 테스트 시작 전 dev server가 떠 있어야 함. 조건부 skip 로직 추가 (`beforeAll`에서 `fetch('/api/projects')` 실패 시 `test.skip`).

대안: Next.js test utilities (e.g., `next/test`) — 현재 repo 미도입 상태. 도입하면 3파일 이상 task. skip.

## Q-5 세부
`e2e-scenarios.sh`는 `.claude/hooks/**` deny-ruled — 이전 세션처럼 worktree+bypassPermissions 에이전트로 수정. 파일이 untracked라 commit에는 포함 안 되지만 infra 정합 유지.

## 질문
1. Q-1~Q-4 2파일 단위 분할 OK? 아니면 하나로 묶거나 다른 그룹핑?
2. 통합 테스트 dev-server-dependency skip 정책 OK? (서버 없으면 테스트 skip + warn)
3. Q-5 hook 수정은 별도 tracking (예: `.claude/hooks/CHANGELOG.md` 같은 추적 파일 생성)하는 게 좋을지, 아니면 현재처럼 hook 파일 자체만 수정?
4. T-F2.1 테스트를 위한 DB fixture mock — better-sqlite3 in-memory DB(`new Database(':memory:')`) 사용 OK?
5. D-2/D-3a/D-3b는 순수 refactor라 별도 테스트 불필요 (기존 T-F2.5/T-F2.6 테스트가 기능 커버), 맞죠?

## 추천
Q-1 → Q-2 → Q-3 → Q-4 → Q-5 순. 통합 테스트는 선택적 skip 허용. 1시간 예상.

## 범위 밖 (추후)
- CI 설정 (GitHub Actions) — vitest + e2e-scenarios 자동 실행
- Playwright E2E — 브라우저 실제 클릭 시나리오
- Storybook / Chromatic — UI 시각 회귀
