# Claude Code Settings Manager — 프로젝트 규칙

<!-- version: 2.1 | updated: 2026-04-26 | mode: 1 Claude session + named subagents -->
<!-- S-2 sprint 진행 중 — 신규 .claude/agents/*.md 정의 도입 (implementer agent 1/5 완료) -->

@docs/PROJECT.md
@docs/ARCHITECTURE.md
@docs/DEVELOPMENT_PRINCIPLES.md

---

## 이 프로젝트의 역할 구조 (S-2 sprint 이후 단순화)

이 프로젝트(`claude-agent`)는 **메인 Claude 세션 + named subagents** 모델로 동작.

- **메인 세션** = 오케스트레이터 + 사용자 인터페이스
- **Subagents** (`.claude/agents/<name>.md` 정의):
  - `implementer` — 단일 task 코드 변경 (1-2 파일)
  - (S-2.4 후) `reviewer` — diff 검증 + outbox APPROVED 작성
  - (S-2.4 후) `blind-reviewer` — 세션 컨텍스트 0 독립 리뷰
  - (S-2.4 후) `investigator` — 버그 재현 + 원인 분석
  - (S-2.4 후) `worktree-bypass` — deny-ruled 파일 단일 수정

> 과거 v2.0의 "3-Claude (test-project Reviewer / claude-agent Implementer / test-ref-agent Supervisor)" 컨셉은 conceptual fiction이었음. 실제로는 항상 단일 세션 + 서브에이전트 위임이었고, S-2 sprint에서 이를 정직하게 정리.

---

## 세션 시작 필수 순서 (v2.1)

**MEMORY.md는 자동 로드됨**. 첫 줄에 "🔴 다음 세션 시작 시 첫 작업" 있으면 그것 우선.

1. **MEMORY 첫 작업 지시 확인** — 자동 로드된 MEMORY.md 상단 5줄 스캔
2. `docs/worklog/session-<latest-date>.md` Read — 직전 세션 컨텍스트 (MEMORY가 가리키는 파일)
3. `.claude/pipeline/alerts/` 디렉터리 → ALERT-*.md 있으면 정지·보고
4. `.claude/pipeline/state/current-task.md` Read — 현재 task id + 핸드오프 정보
5. `git log --oneline -10` — 최근 커밋 맥락
6. (선택) `.claude/pipeline/outbox/` 최근 diff-review 확인 — 이전 sprint 마무리 여부
7. (선택) `npm run verify:full` — 게이트 baseline 확인 (74 tests 등)
8. 상태 보고 1줄 + 사용자 지시 대기

> **재시작 직후 주의**: outbox write 권한이 deny rule이라 새 세션에서 reviewer subagent 호출 시 `/permissions add Write(.claude/pipeline/outbox/**)` 일시 해제 필요할 수 있음. MEMORY가 알려줌.

---

## Subagent 호출 규약 (S-2 sprint 완료 후 표준)

```ts
// S-2.2 commit 후 가능 (재시작 후)
Agent({ subagent_type: "implementer", prompt: "Task X.Y per SPEC §..." })

// S-2.4 commit 후 가능
Agent({ subagent_type: "reviewer", prompt: "Verify diff request: ..." })
Agent({ subagent_type: "blind-reviewer", prompt: "Range: <SHA>..<SHA>" })
Agent({ subagent_type: "investigator", prompt: "Symptom: ..." })
Agent({ subagent_type: "worktree-bypass", prompt: "File: <path>, anchor: ..." })
```

각 subagent 정의: `.claude/agents/<name>.md` (frontmatter + 본문 시스템 프롬프트). 신규 agent 추가 시 **세션 재시작 필요** (Claude Code hot-reload는 수정만 자동, 신규 정의는 인식 안 됨).

---

## 작업 원칙 (3-Claude 체제)

### 위임 범위
- SPEC/DESIGN/TASKS 직접 작성 금지 (Reviewer 영역)
- Reviewer가 승인한 TASKS를 **한 번에 하나씩** 구현
- 1 task = 1~2 파일 수정. 3+ 파일 필요 시 Reviewer에게 task 쪼개기 요청

### 모호함 처리
- SPEC 해석이 모호하면 → `pipeline/inbox/question-*.md`에 A/B/C 옵션으로 질문 올림
- **추측 금지**. 응답 올 때까지 해당 task 정지.

### Commit 규율
- Reviewer `outbox/diff-review-*.md`에 `APPROVED` 있어야 commit 가능 (hook Guard 0c가 차단)
- 커밋 메시지: `feat|fix|refactor(<scope>): T-<id>.<n> — <한 줄>`
- `--no-verify`, `-n`, hook 우회, `core.hooksPath` 변경 **영구 금지**
- `--amend` 금지. 실패 시 새 커밋.

### 세션 종료
- `pipeline/state/current-task.md` 최신화
- `docs/worklog/session-<YYYY-MM-DD>.md` 작성/append (handoff)
- `pipeline/log/implementer.jsonl` append

---

## 증거 기반 완료

- Reviewer 실행 증거 (curl + 파일 체크) 없이 "완료" 선언 금지
- 커밋 시 hook이 자동 검증 (TSC + dev ping + e2e-scenarios.sh)
- 수동 "동작 확인" 판단 금지 — Reviewer가 유일한 판정자

---

## 금지 행동

- SPEC / DESIGN / TASKS 직접 작성 → Reviewer 영역
- Reviewer outbox 승인 없이 commit → hook이 차단하지만 시도 자체 금지
- `.claude/hooks/**`, `.claude/prompts/**`, `.claude/settings.json` 편집 → deny rule
- `.claude/pipeline/outbox/**`, `.claude/pipeline/alerts/**`, `.claude/pipeline/ROLES.md` 편집 → deny rule
- 3+ 파일 동시 수정 → task 쪼개기 필요
- `--no-verify`, `-n`, force push, `--amend` → 영구 금지
- 다른 Claude에게 직접 명령 → pipeline 경유만

---

## 기술 스택 (참조)

- Next.js 16 App Router + TypeScript
- Drizzle ORM + SQLite WAL (better-sqlite3)
- shadcn/ui (base-ui v1.3.0)
- CodeMirror 6
- chokidar (fs-watcher) + SSE

## Claude Code 버전
- 요구: v2.1.59+ (auto memory, `.claude/rules/` paths frontmatter)
- 현재: 2.1.112 ✓

---

## 정식 게이트 (core §6.1 요구)

작업 완료 판정 근거 = 다음 게이트 전수 통과:
1. `npm run lint` — 에러 0
2. `npm run build` — 성공
3. `npm run test` — 전수 pass
4. `.claude/hooks/e2e-before-commit.sh` — Guard 1/0c/0d/TSC/dev/e2e-scenarios 전부 통과

Reviewer가 별도로 실제 curl 실행으로 재검증.

---

## 변경 이력

- **2026-04-26 v2.1**: 3-Claude conceptual fiction 정리. 실제 모델인 "1 세션 + named subagents"로 표기 변경. 세션 시작 순서 갱신 (MEMORY.md 첫 줄 우선, worklog 참조). subagent 호출 규약 추가. Sprint S-2 ongoing — `.claude/agents/` 정의 도입 중.
- **2026-04-18 v2.0**: 3-Claude 체제 (당시 표기). Reviewer 승인 기반 작업 흐름으로 전환. 기존 "확인 질문 금지 / 바로 전부 구현 / 부분 완성 후 멈추기 금지" 규칙 제거.
- 이전 v1 rules는 `docs/_archive/CLAUDE.md.v1-backup` (필요 시 생성)
