# approved-F2-scope — Bugfix Sprint 범위·방침 회신

- **대상**: Implementer
- **응답자**: Reviewer
- **생성**: 2026-04-20
- **입력**: `inbox/question-F2-scope-20260420.md`
- **판정**: [x] APPROVED
- **근거**: `/ultrareview` 2회 corroborated + Implementer 9파일 코드 대조 검증. 6건 정확. 범위/블라스트 평가 타당.

---

## 1. Q1–Q5 결정

| 질문 | Implementer 추천 | Reviewer 결정 | 비고 |
|------|-----------------|--------------|------|
| Q1. T2/T3 파싱 실패 정책 | A (409 hard-stop) | **A 채택** | 데이터 손실 > UX 중단. 409 body = `{error, path, detail}` 고정. disk/DB 해시 불변이 acceptance의 핵심. |
| Q2. T3 포함 | A (F-2 내 동시 수정) | **A 채택** | 동일 anti-pattern 3곳(apply / batch-apply / activate) 분산 금지. batch-apply 쪽 `merged = {}` fallback 반드시 제거. |
| Q3. T4 Apply-to-all 실패 정책 | A (파일 단위 skip + error 리스트) | **A 채택 (조건부)** | 응답 shape = `{applied: string[], skipped: {path, reason}[]}`. 단일 파일 실패가 나머지를 차단하지 않도록 per-file try/catch. **단, 쓰기는 모든 파일 dry-run 성공 이후 2-pass로 수행** (부분 쓰기로 브릭되는 것 방지). |
| Q4. T7 포함 | A (F-2에 포함) | **A 채택** | 1파일 20줄 예상. 컨텍스트 재개 비용 > 구현 비용. 단, T7은 최후순위. |
| Q5. unstaged 변경 관계 | C (T5/T6 착수 시점에 묶기) | **C 승인 + 정정** | git status 확인 결과 unstaged 3파일(`docs/ARCHITECTURE.md`, `src/app/projects/[id]/page.tsx`, `src/components/editors/HooksUnifiedEditor.tsx`)은 **T1–T7 touch 파일과 전혀 겹치지 않음**. 따라서 "T5/T6 묶기" 이유는 해소됨. 대신 각 unstaged 변경은 **소속 task와 함께 커밋**하거나, **F-2 시작 전 별도 chore 커밋**으로 처리. Implementer가 soucre of truth(어떤 story에 속하는지) 아는 항목만 택1하여 처리. 본 F-2 task count에는 영향 없음. |

**순 영향**: Q5가 (C→실질 null)로 바뀌면서 질문서 암묵의 "T-F2.8 chore" 커밋은 **불필요**. **Task 수 = 7건 (T-F2.1 ~ T-F2.7)**. 오케스트레이터가 전달한 "T-F2.1 ~ T-F2.8" 예상은 Q5=A 시나리오 기준이므로 **여기서는 7건으로 확정**한다.

---

## 2. Task 분해 (T-F2.1 ~ T-F2.7)

각 task 1–2 파일. 커밋 전 per-task `diff-review-F2-<n>-*.md` APPROVED 필요 (Guard 0c).

### T-F2.1 — `getAllTemplates` per-row 복원력 (P0, APPLY-FAIL 가설 우선)
- **파일**: `src/lib/templates/index.ts` (1)
- **변경 요지**: `customRows.map(customRowToTemplate)` → `customRows.flatMap(row => { try { return [{ ...customRowToTemplate(row), isCustom: true }]; } catch (e) { console.warn('[templates] skip corrupt custom row', row.id, e); return []; } })`. `getTemplateById` 기존 per-row try/catch 패턴과 대칭.
- **Acceptance**:
  - [ ] fixture 4건(valid 1 + broken JSON 3: tags/settings/extraFiles) 삽입 → `getAllTemplates()` 정확히 1건 반환, 로그 3회.
  - [ ] `curl /api/templates` 200 유지 (500 아님).
  - [ ] `/templates` 페이지 렌더, card-picker/workflow-picker 블랭크 해소.
  - [ ] gates: lint + build + test + e2e-before-commit.sh.
- **Evidence 요구**: Implementer는 APPLY-FAIL이 T1으로 해소되는지 **실제 재현 → 해결 curl 로그** 동봉.

### T-F2.2 — workflow activate 파싱 실패 시 409
- **파일**: `src/app/api/workflows/[id]/activate/route.ts` (1)
- **변경 요지**: `if (existingRaw)` 블록의 `try { merge } catch { merged = filteredSettings }` → `try { merge } catch (e) { return 409 { error: 'settings_parse_failed', path, detail: e.message } }`. iter 루프 진입 전 1회만 parse (iter당 re-read 제거 권장).
- **Acceptance**:
  - [ ] repro: `printf '{,}' > <scope>/settings.json` → activate 호출 → 409 응답 + file hash 불변 (sha256 before/after 동일).
  - [ ] 정상 payload activate → 200 유지 (회귀 없음).
  - [ ] gates 통과.

### T-F2.3 — templates apply + batch-apply 409 (anti-pattern 일괄 청소)
- **파일**: `src/app/api/templates/[id]/apply/route.ts` + `src/app/api/templates/batch-apply/route.ts` (2)
- **변경 요지**: 둘 다 parse catch 절을 409 hard-stop 으로. batch-apply의 `merged = {}` fallback **반드시 제거** (N-template 누적 위험).
- **Acceptance**:
  - [ ] corrupted settings.json + apply → 409 + disk 불변.
  - [ ] corrupted + batch-apply(3 template) → 409 + disk 불변 + DB `applied_templates` rollback.
  - [ ] 정상 경로 회귀 없음.
  - [ ] gates 통과.

### T-F2.4 — `injectAgentHeader` frontmatter 감지 정규화 (+ 신규 unit test)
- **파일**: `src/lib/agent-header-inject.ts` + `tests/unit/agent-header-inject.test.ts` (2, 1 신규)
- **변경 요지**: detector = `/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/`. post-condition 검사: 결과가 `---`로 시작하지 않으면 throw (`'frontmatter_lost'`). Fallthrough prepend 경로 제거.
- **신규 테스트 파일 승인**: `tests/unit/agent-header-inject.test.ts` — repo 최초 vitest 테스트. `vitest run` 동작은 package.json에 이미 정의(`"test": "vitest run"`). 디렉터리 미존재 → 최초 생성 허용.
- **Apply-to-all 실패 정책 (Q3)**:
  - Step 1: 대상 파일 전부 dry-run (in-memory 변환 + post-condition 검사).
  - Step 2: 전체 성공 시에만 disk 쓰기 / 하나라도 실패면 쓰기 **0건** + 응답 = `{applied: [], skipped: [{path, reason}, ...]}`.
  - Step 3 (옵션): `force: true` 플래그로 부분 성공 허용 — 단 본 F-2 범위 밖, 백로그.
- **Acceptance**:
  - [ ] unit fixtures 6종: LF+trailing-\n / LF no-trailing-\n / CRLF / no-frontmatter / 이미 주입된 파일 / `name:` 값에 `---` 포함. 전부 기대 결과 일치.
  - [ ] post-condition throw 동작 확인 (의도적 corruption input).
  - [ ] e2e: 5개 agent dir, 1개에 broken frontmatter 심어놓고 apply-to-all → 0건 쓰기 + skipped list에 1건.
  - [ ] `stripAgentHeader` 역연산 손상 없음.
  - [ ] gates 통과.

### T-F2.5 — fs-watcher classifier nested rules 지원
- **파일**: `src/lib/fs-watcher/index.ts` (1)
- **변경 요지**: `parts[2]?.endsWith(".md")` 하드코딩 제거. `const leaf = parts[parts.length - 1] ?? ""`. project classifier = `parts[0] === ".claude" && parts[1] === "rules" && leaf.endsWith(".md") && parts.length <= 5` (depth 4 comment와 정합). home 경로 대칭 수정.
- **Acceptance**:
  - [ ] repro: `mkdir -p <proj>/.claude/rules/sub && echo '# x' > .../sub/foo.md` → SSE stream에서 `rules` 이벤트 관찰 (before: 이벤트 없음, after: 있음).
  - [ ] flat `.claude/rules/foo.md` 회귀 없음.
  - [ ] depth 초과(`rules/a/b/c/d/foo.md`) 무시되는지 경계 테스트.
  - [ ] gates 통과.
- **주의**: 이 파일은 현재 unstaged 변경 없음 (git status 확인). 해당 변경과 충돌 없이 진행 가능.

### T-F2.6 — PATCH `/api/workflows/[id]` 검증 누락
- **파일**: `src/app/api/workflows/route.ts` + `src/app/api/workflows/[id]/route.ts` (2)
- **변경 요지**: `isValidItem`을 `workflows/route.ts` 에서 export. `[id]/route.ts` PATCH L53-60 의 ad-hoc 검증을 `isValidItem` 호출로 교체.
- **Acceptance**:
  - [ ] POST와 PATCH에 동일 invalid payload(`excludeTopLevelKeys: "string-not-array"` 등) → 동일 400.
  - [ ] 동일 valid payload → 동일 성공.
  - [ ] activate에서 `excludeTopLevelKeys` substring 오매칭 재현 → PATCH 검증 강화로 애초에 저장 차단되는지 확인.
  - [ ] gates 통과.
- **주의**: 이 파일군도 unstaged 변경 없음.

### T-F2.7 — `sanitizeSettings` 키 전용 prototype 검사
- **파일**: `src/app/api/custom-templates/route.ts` (1)
- **변경 요지**: `JSON.stringify(obj).includes('"prototype"')` 제거. 재귀 walker: own-key 집합에서 `__proto__` / `constructor` / `prototype` 리터럴만 reject. depth cap 32 (무한 재귀 방지).
- **Acceptance**:
  - [ ] payload `{ env: { TOPIC: "prototype" } }` → 201.
  - [ ] payload `{ __proto__: {...} }` → 400.
  - [ ] depth 33 객체 → 400 `'depth_exceeded'`.
  - [ ] gates 통과.

---

## 3. 커밋 순서 (엄격)

1. **T-F2.1** — P0, APPLY-FAIL 가설 검증이 본 스프린트 최우선. evidence 없으면 후속 진행 불가.
2. **T-F2.2** — workflow activate 데이터 손실 방지.
3. **T-F2.3** — apply/batch-apply 동일 패턴 정리 (T2와 함께 묶어서 메모리 fresh).
4. **T-F2.4** — agent header brick 방지 + repo 최초 unit test 스캐폴드.
5. **T-F2.5** — nested rules SSE 복구 (S6 worktree 기능 기반).
6. **T-F2.6** — PATCH 검증 누락 (T5와 같은 API 레이어, 맥락 재사용).
7. **T-F2.7** — nit, 마지막.

**Unstaged 처리 (Q5=C 실질 적용)**:
- 현재 unstaged 3파일은 T1–T7과 독립. F-2 시작 **직전** 별도 chore 커밋(`chore: pre-F2 housekeeping`) 또는 각 파일의 소속 story로 분류하여 처리. 이 선행 커밋은 **F-2 task 번호에 포함하지 않음**. 선택은 Implementer 재량.

---

## 4. 추가 지시

1. **T1부터 진입**: 승인. APPLY-FAIL P0 가설 검증이 본 스프린트 존재 이유. T-F2.1 evidence에는 "전/후 curl 로그 + APPLY 재현" 필수.
2. **신규 unit test 파일**: `tests/unit/agent-header-inject.test.ts` 생성 승인. repo 최초 test 파일이므로 vitest config가 default 외 조정 필요하면 **별도 inbox 질문**으로 올릴 것 (이때 1파일 추가는 T-F2.4의 2파일 한도 내에서 해결 불가하면 T-F2.4 를 둘로 쪼개는 요청 필요 — 현재 추정: 단순 생성이면 한도 내 수용).
3. **게이트 규율**: 각 task 커밋 전 `npm run lint && npm run test && .claude/hooks/e2e-before-commit.sh` 전수 통과. `--no-verify` / `--amend` / force push 금지 (CLAUDE.md 영구 규칙).
4. **파일 touch 한도**: 각 task ≤ 2 파일. 구현 중 3파일 필요가 드러나면 즉시 정지 + inbox 질문.
5. **Per-task 승인**: 본 스코프 APPROVED는 **구현 진입 허가**. 각 task 코드 diff는 별도 `diff-review-F2-<n>-*.md` APPROVED 필요 (Guard 0c 차단).

---

## 5. 판정

[x] APPROVED

**Scope**: F-2 Bugfix Sprint, 7 tasks (T-F2.1 ~ T-F2.7).
**Condition**: Q1=A, Q2=A, Q3=A(+dry-run 2-pass), Q4=A, Q5=C(실질 null, unstaged는 F-2 밖에서 처리).
**Entry point**: T-F2.1 (APPLY-FAIL 가설 검증 우선).
