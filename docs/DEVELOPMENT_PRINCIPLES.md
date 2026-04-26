# 개발 원칙 — Claude 운용 강제 규칙

<!-- version: 1.0 | created: 2026-04-26 | trigger: 사용자 지적 (세션 종료 핸드오프 미흡) -->
<!-- 이 문서는 CLAUDE.md @import로 자동 로드. 매 세션 시작 시 자동 적용 -->

이 문서는 **Claude의 행동 원칙**이다. "권고"가 아니라 **각 행동의 사전 체크리스트**다. 빠뜨리면 사용자가 알아채고 화를 낸다 (실제 사례 누적).

---

## 0. 메타 원칙

1. **체크리스트 먼저, 행동은 그 다음** — 아래 체크리스트를 머릿속으로라도 한 번 따라가지 않은 행동은 시작 금지
2. **"~만 하면 됩니다" 금지** — 사용자에게 행동을 요구하기 전에 가능한 한 다 해놓고 한 가지만 남긴다
3. **묵시적 가정 0** — 사용자가 알아챌 거라고 추측 금지. 명시 또는 자동화

---

## 1. 세션 시작 (Session Onboarding)

매 세션 시작 시 **순서대로 수행**:

```
[ ] 1. MEMORY.md 첫 줄 (자동 로드된 상태) — "🔴 다음 세션 시작 시 첫 작업" 있는지
[ ] 2. CLAUDE.md "세션 시작 필수 순서" 섹션 따라 진행
[ ] 3. docs/worklog/session-<latest-date>.md Read — 직전 컨텍스트
[ ] 4. .claude/pipeline/alerts/ 디렉터리 → ALERT-*.md 있으면 정지·보고
[ ] 5. .claude/pipeline/state/current-task.md — 현재 task + 핸드오프 정보
[ ] 6. git log --oneline -10 — 최근 commit 맥락
[ ] 7. (선택) npm run verify:full — gates baseline (74 tests 등)
[ ] 8. 1줄 상태 보고 + 사용자 지시 대기
```

**금지**: "지난 세션이 어떻게 됐는지 모르겠습니다" — 위 절차로 알 수 있는데 안 한 거.

---

## 2. 작업 시작 (Task Onboarding)

사용자가 작업 지시할 때:

```
[ ] 1. 작업 범위 명확한가? — 모호하면 A/B/C 옵션으로 질문
[ ] 2. 1-2 파일 안에 들어가는가? — 3+ 면 분할 또는 사용자 사전 승인
[ ] 3. 의존 task 있는가? — current-task / backlog / scope 확인
[ ] 4. SPEC ref 있는가? — 없으면 plan 작성 또는 사용자 합의
[ ] 5. 진행 시 어디까지 commit/push할지 사용자가 알고 있는가?
```

---

## 3. 코드 변경 (Implementation)

```
[ ] 1. current-task.md id 갱신 (in-progress)
[ ] 2. 변경 → smoke gates (tsc/lint/test) 실행
[ ] 3. 게이트 실패 시: 1회 재시도 → 여전히 실패면 STOP, 사용자 보고
[ ] 4. Reviewer (subagent or 직접) 검증 → outbox APPROVED
[ ] 5. commit (메시지에 task id 포함) → push
[ ] 6. current-task.md status 갱신 (completed)
[ ] 7. log/jsonl append
```

**금지**:
- 게이트 실패를 "있을 수도 있다"로 진행
- "다음 commit에서 고치겠습니다" — 1 task 1 commit 원칙 위반
- commit 메시지에 hook trigger 패턴 포함 (`--no-verify` 같은 문자열 금지, 우회 시도로 오인됨)

---

## 4. 세션 일시중지 (Session Pause) — 🔴 가장 자주 빠뜨리는 부분

**사용자에게 "재시작 필요" / "다음 세션에 진행" / "여기서 멈춥시다" 같은 말을 하기 전에 반드시**:

```
[ ] 1. MEMORY.md 갱신
    [ ] 첫 줄에 "🔴 다음 세션 시작 시 첫 작업" 명시
    [ ] 첫 작업의 정확한 호출 (Agent({...}) 또는 사용자 메시지) 박음
    [ ] 검증 항목 명시 (성공 조건)
    [ ] 이번 세션 commits 요약
    [ ] 보류된 task 목록 + 의존 그래프
[ ] 2. docs/worklog/session-<YYYY-MM-DD>.md 작성/append
    [ ] 시작 상태 / 수행 / 결정 / 보류 / 다음 단계 5 섹션
    [ ] 모든 commit SHA 인용
[ ] 3. .claude/pipeline/state/current-task.md 핸드오프 섹션
    [ ] id, status, 진입 절차 (사용자 입력 + Claude 호출 패턴)
    [ ] 보류 사유 (왜 이번 세션에서 못 끝냈는가)
[ ] 4. CLAUDE.md "세션 시작 필수 순서" 갱신 — 워크플로 변경 있었으면
[ ] 5. .claude/pipeline/log/implementer.jsonl append (sprint_paused 이벤트)
[ ] 6. npm run verify:full 통과 확인 — clean baseline
[ ] 7. git status clean 확인 (working tree)
[ ] 8. git push origin main 완료 확인
[ ] 9. 사용자에게 보고:
    [ ] 이번 세션 결산 (commits 표)
    [ ] 보류 사유 (한 줄)
    [ ] 다음 세션 첫 메시지 예시 (복사 가능)
    [ ] 자동 복원되는 컨텍스트 목록 (사용자 안심)
```

**위반 사례 (이런 경우 사용자가 화남)**:
- 항목 1-5만 하고 9 빠뜨림 → "그래서 뭘 해야 한다는 거?"
- 항목 9만 하고 1-5 빠뜨림 → "아무 정보도 없는데 어떻게 이어가?"
- "재시작 필요" 말만 하고 항목 0건 처리 → "이게 뭔 짓이야"

---

## 5. 사용자에게 행동 요구할 때 (User Action Request)

사용자에게 무언가 해달라고 할 때 (`/permissions`, manual commit, browser test, etc.):

```
[ ] 1. 진짜 사용자만 할 수 있는가? — Claude 자동화 가능하면 자동화 우선
[ ] 2. 정확한 명령어/입력 제공 — "permissions 풀어주세요"가 아니라
       "터미널에 `/permissions add Write(.claude/pipeline/outbox/**)` 입력"
[ ] 3. 왜 필요한지 1줄 — 사용자가 신뢰 가능
[ ] 4. 완료 확인 방법 — 사용자가 "했어요" 했을 때 검증할 방법
[ ] 5. 실패 시 fallback — 사용자가 못 하면 어떻게 진행할지
```

**금지**:
- "사용자가 알아서 해주세요" — 모호한 요청
- 여러 행동 한 번에 요구 — 1번에 하나씩
- 비기술 사용자 가정한 설명 부족 — 명확하고 짧게

---

## 6. 권한 / Deny rule

```
[ ] 1. 작업 시작 전 deny rule 확인 (.claude/settings.json)
[ ] 2. 차단 가능성 있는 경로:
    .claude/{hooks,prompts,settings.json}
    .claude/pipeline/{outbox,alerts,ROLES.md}
    package.json (선택적)
[ ] 3. 차단되면 fallback:
    (a) 사용자에게 일시 해제 요청 — /permissions
    (b) worktree-bypass agent 위임 (S-2.4 후 가능)
    (c) 사용자 직접 commit
[ ] 4. 우회 시도 절대 금지: --no-verify, hook 직접 disable, settings 영구 변경
[ ] 5. 우회 패턴 명령 안 침: sed -i, node -e, tee .claude, > .claude
    (Guard 1 차단)
```

---

## 7. 검증 (Verification)

```
[ ] 1. 자체 검증만으로 PASS 선언 금지 — 본인 작업의 맹점 인지
[ ] 2. 비-trivial sprint 종료 시 블라인드 독립 리뷰 권장:
    Agent({
      subagent_type: "blind-reviewer",  // S-2.4 후
      prompt: "Range: <SHA>..<SHA>. REVIEW.md 적용. 컨텍스트 없음."
    })
[ ] 3. 게이트 출력은 인용해서 보고 — "통과" 한 마디 금지
[ ] 4. live HTTP / md5 / sha256 같은 invariant repro 권장
[ ] 5. UI-only 검증은 사용자 영역 — 자동화 시도 금지
```

---

## 8. 문서 / 핸드오프 (Documentation)

```
[ ] 1. 작업 중 worklog 갱신 (끝나고 한 번에 X)
[ ] 2. backlog.md에 발견된 후속 즉시 추가 — 까먹지 않음
[ ] 3. SPEC/scope 변경 시 plan 파일 업데이트
[ ] 4. CLAUDE.md / MEMORY.md 충돌 시 CLAUDE.md 우선 (project-level이라)
[ ] 5. 모든 file:line 참조는 정확하게 — 추측한 라인 번호 금지
```

---

## 9. 커밋 메시지 (Commit Message)

```
[ ] 1. 형식: `<type>(<scope>): <task_id> — <한 줄 요지>`
       type: feat | fix | refactor | chore | docs | test
       task_id: T-X.Y, S-X.Y, B-X (백로그) 등
[ ] 2. 본문에 검증 결과 인용 (gates 통과 횟수)
[ ] 3. Plan / SPEC ref 끝에 명시
[ ] 4. Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
[ ] 5. hook trigger 패턴 포함 금지 (--no-verify, sed -i, node -e 같은
       문자열). Guard 1이 commit message도 검사함
```

---

## 10. 우선순위 충돌 시

여러 원칙이 충돌하면 다음 순서:

1. **데이터 손실 방지** > 그 외 모든 것
2. **사용자 신뢰** > 효율성 (체크리스트 안 따르고 빨리 끝내는 것보다 차라리 1분 더 걸려도 정확한 게 낫다)
3. **체크리스트 준수** > 임의 판단
4. **명시적 합의** > 추측

---

## 안티패턴 (실제 본인 사례 기반)

- ❌ "재시작 하면 됩니다" — 1-9 항목 안 하고 말만
- ❌ "다음 세션에서 ..." — 다음 세션이 어떻게 시작되는지 안 박아두고
- ❌ "있을 거예요 / 될 거예요" — 검증 없이 추정
- ❌ "사용자가 알아서" — 명확한 지시 없이
- ❌ 여러 task 동시 진행 — 1 task = 1 commit 위반
- ❌ "아 그건 deny일 거예요" — 시도해보지도 않고 추정
- ❌ commit 메시지에 hook trigger 패턴 박기 — 본인이 hook 돌릴 거 알면서

---

## 위반 시 사용자 반응 패턴 (실증)

- "ㅡㅡ" / "?" — 가벼운 짜증, 보통 1번 누락
- "그래서?" / "어떻게?" — 항목 9 누락 (사용자에게 명확한 다음 행동 미제공)
- "야 그런데 ..." — 항목 1-5 누락 (상태 보존 미흡)
- "솔직하게" / "너는 그런거 기본도 안 하고" — 안티패턴 다수 누적

---

## 이 문서 자체에 대한 규칙

- 신규 안티패턴 발견 시 §10 "안티패턴" 섹션에 즉시 추가
- 사용자 지적 시 해당 항목 §"위반 시 사용자 반응" 에 기록
- 사용자가 "이런 식으로 또 하지 마" 라고 하면 그 패턴을 §"안티패턴" 에 인용 (자기 학습 강화)

이 원칙 자체를 어기면 사용자가 본 문서를 가리키며 지적할 수 있도록 항상 최신 상태 유지.
