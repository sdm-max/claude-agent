# Review Instructions — claude-agent

<!-- version: 1.0 | created: 2026-04-18 -->
<!-- /code-review 플러그인 + /ultrareview 공통 설정. 모든 review agent의 system prompt에 최고 우선순위로 주입됨. -->

---

## Important (🔴) 정의

다음 중 **하나라도** 해당하면 Important:

1. **SPEC 위반** — 승인된 SPEC의 완료 조건을 diff가 실제 이행 안 함
2. **APPLY / Undo 파손** — `/api/templates/*/apply`, `/api/templates/applied/*/undo` 회귀
3. **보안** — auth bypass, SQL/path injection, secrets 하드코딩, 민감정보 로그
4. **데이터 손실** — migration 비가역적 파괴, transaction 누락, race condition
5. **3-Claude pipeline 직접 수정** — `.claude/pipeline/outbox/**`, `.claude/pipeline/alerts/**`, `.claude/pipeline/ROLES.md` 변경 감지
6. **Hook / settings 우회** — `.claude/hooks/**`, `.claude/settings.json`, `.claude/prompts/**` 변경 or `--no-verify` 사용
7. **정식 게이트 우회** — e2e-scenarios.sh 시나리오 삭제/완화 시도
8. **Implementer 영역 초과** — Implementer session이 SPEC/DESIGN/TASKS 직접 작성

## Nit (🟡) vs Important 구분

- 스타일/네이밍/리팩터 제안 = Nit 최대
- 테스트 커버리지 부족 = Nit (차단 아님, 권고)
- 기존 코드 스타일 불일치 = Nit
- CLAUDE.md 규칙 위반 = Nit (Important 수준 아니면)

## Nit 캡

한 review 당 최대 **5개**. 초과 시 요약에 "plus N similar items" 로 요약. 모든 finding이 Nit 면 summary 1줄: "No blocking issues — N nits".

---

## Skip / 제외 경로

다음은 report 안 함:

- `.next/**` — Next.js 빌드 산출물
- `node_modules/**`
- `drizzle/**` — ORM 자동 생성
- `docs/_archive/**` — 아카이브
- `*.lock`, `package-lock.json` — 잠금 파일
- `src/gen/**` — 생성 파일 (있으면)
- `.claude/validation-log.jsonl` — hook 자동 로그

다음은 report 제한 (near-certain + severe 경우만):

- `docs/worklog/**` — 세션 핸드오프 (형식 검증만)
- `.claude/pipeline/log/**` — 실행 로그 (append-only)

---

## CI가 이미 잡는 것은 생략

Code Review에서 skip:
- Lint errors (ESLint/Prettier)
- Format differences
- TypeScript type errors (TSC는 hook이 잡음)
- 단순 import 누락

Hook이 이미 차단하므로 review가 중복 flag 안 함.

---

## Always Check (매 PR 확인)

1. **신규 API route 추가 시** → `e2e-scenarios.sh`에 시나리오 추가되었는가 (없으면 Important)
2. **Apply/Undo 관련 변경 시** → `settings.local.json` 파일 시스템 상태 검증 포함하는가
3. **DB migration** → forward/backward 호환 + 롤백 plan 명시
4. **CLAUDE.md / settings.json 변경** → 변경 이유 commit msg에 명시
5. **Log 출력** → email/userID/request body 포함되지 않음
6. **SPEC 참조 commit** → commit msg에 `T-<id>.<n>` 포함되어 있는가

---

## Verification 강화

- **"동작할 것 같다"** → BLOCKED. 실제 endpoint 호출 결과 + 응답 body 포함 필수
- **동작 주장 시 file:line 인용** — 추론 금지
- **회귀 검증 필수** — 변경 주변 3개 이상 기존 endpoint ping 결과 포함

---

## Re-review Convergence

- 1회 review 후 Nit 이슈는 다음 review 에서 suppress (같은 PR)
- Important 이슈만 새 review에 재보고
- 한 PR에서 review round 3회 초과 → Supervisor 에스컬레이션 신호 (ALERT 생성 고려)

---

## Summary Format

리뷰 본문 첫 줄 양식:
```
<N> important, <M> nits, <K> pre-existing
```

Important = 0 이면:
```
No blocking issues — <M> nits, <K> pre-existing
```

상세 finding은 severity 순서대로: 🔴 → 🟡 → 🟣.

---

## 프로젝트 맥락 (Review 가 알아야 할 것)

- **앱 목적**: Claude Code 설정 통합 관리 UI (sees 스케일 타겟)
- **Known P0 이슈**: APPLY-FAIL (카드 Apply 미동작), D-2 Undo 불완전
- **3-Claude 체제**: Implementer (여기), Reviewer (test-project), Supervisor (test-ref-agent). Implementer는 SPEC 직접 작성 금지.
- **Pipeline**: `.claude/pipeline/` 에 상태·리뷰 요청·판정·ALERT. Implementer는 `outbox/`, `alerts/`, `ROLES.md` 수정 금지.
- **Hook**: `e2e-before-commit.sh` 가 Guard 1/0d/0c/TSC/dev/e2e-scenarios 로 커밋 전 자동 검증.

---

## 참조 문서

- `CLAUDE.md` — 프로젝트 규칙
- `docs/PROJECT.md` — 앱 개요
- `docs/ARCHITECTURE.md` — 기능 매트릭스
- `.claude/pipeline/ROLES.md` — 3-Claude 역할 정의
- `.claude/prompts/` — 각 역할 프롬프트
