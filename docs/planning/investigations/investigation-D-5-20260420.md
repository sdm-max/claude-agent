# investigation-D-5 — D-2 / C-3 / E-1 재조사

- **요청자**: Implementer
- **수행자**: 독립 Investigation 에이전트 (백그라운드)
- **생성**: 2026-04-20
- **유형**: investigation

## Summary
D-2 Undo 불완전 = **P1 confirmed** (정적 코드 분석). C-3는 **regression 아님** (feature gap). E-1은 extraFiles-only 템플릿에 한해 **P2**.

## D-2 Findings — P1 confirmed

**재현성**: 코드 정적 확인으로 확인 가능.

**원인**: `src/app/api/templates/applied/[id]/undo/route.ts` 핸들러가 settings delta subtract만 수행. `record.extraFiles` 를 절대 parse하지 않고 unlink 로직이 없음. `src/lib/templates/apply-files.ts`도 삭제 대응 함수 없음. `applied_templates.extra_files` (schema.ts:30) 는 JSON 저장되지만 undo 경로에서 read 안 됨.

**증상**: apply → undo 시 `.claude/hooks/*.sh`, `~/.claude/*.sh`, `.claude/skills/*/SKILL.md` 등 extraFiles가 디스크에 잔존. settings만 복원되고 파일은 남음.

**Fix scope**: `undo/route.ts` 수정 — `record.extraFiles` JSON parse, 같은 scope + projectId의 다른 active row들의 extraFiles 경로 집합 집계, 공유 아닌 경로만 unlink. apply 쪽과 동일한 `~/` expansion + `..`/절대경로 가드 적용. 응답에 `removedFiles: string[]` 추가.

**Files**: `src/app/api/templates/applied/[id]/undo/route.ts` (+ 옵션 `src/lib/templates/undo-files.ts` helper — 2파일).

## C-3 Findings — Regression 아님

**git log** `--follow src/app/templates/page.tsx`: Phase 2-1 per-block Apply 체크리스트(952-1031행)가 `4127a94` commit 이후 수정된 적 없음. 사용자가 기대한 **nested** 체크박스(hooks.PreToolUse[i], permissions.allow[i])는 이전에도 존재하지 않음. `docs/backlog.md` C-2 요청("per-feature checklist") 과 정확히 매치 — feature gap.

**재분류**: P2 feature gap (backlog C-2와 통합).

## E-1 Findings — 조건부 P2

**예상된 동작**: `hooks-rm-protection` (top-level key `hooks` 1개), `models-opus-default` (`model` 1개) 등은 `Object.entries(detail.settings)` iterate로 1행씩 렌더 — 올바름.

**진짜 버그**: `settings:{}` + extraFiles-only skill 템플릿 (`testing-patterns`, `api-design`, `code-review`, `documentation` — `src/lib/templates/index.ts:721/767/815/861`) 은 `src/app/templates/page.tsx:955`의 `Object.keys(detail.settings).length > 0` 가드가 체크리스트 블록 전체를 숨김. extraFiles 체크리스트가 이 가드 안에 있어서 함께 hidden.

**Fix scope**: `src/app/templates/page.tsx` — settings 렌더 가드와 extraFiles 렌더 가드 분리.

## 제안 fix task

| Task | Files | Severity | 요지 |
|------|-------|---------|------|
| **D-5.1** | `src/app/api/templates/applied/[id]/undo/route.ts` (+ optional `src/lib/templates/undo-files.ts`) | **P1** | undo가 extraFiles unlink. shared-path 인지 |
| **D-5.2** | `src/app/templates/page.tsx` | P2 | settings/extraFiles 렌더 가드 분리 |
| D-5.3 (defer) | page + route (2+ files) | P2/feature | nested checklist — SPEC 필요, 범위 밖 |

## 회귀 방어

D-5.1 구현 시 테스트 추가 권장:
- `tests/unit/undo-extra-files.test.ts` — shared-path awareness + unlink 동작
- e2e-scenarios.sh에 S7 (apply → disk verify → undo → disk verify) 추가 고려

현 Q sprint(vitest 65)는 apply/undo cycle을 안 커버. D-5.1 fix와 함께 붙이는 게 규율.

## 실행 불가 항목 (투명성)

- C-3 regression claim 자체 — git 증거 없음. feature gap으로 재분류.
- D-2 shared-path 엣지 케이스 — 두 active apply가 같은 경로를 쓴 경우만 관찰 가능. 수정 로직은 이 경우도 처리 필요.

---

**다음 단계 (Implementer)**: D-5.1 (P1 즉시) + D-5.2 (P2 옵션). 각 별 task로 Reviewer scope approval 필요.
