# question-F2-scope — Bugfix Sprint 범위·방침 문의

- **요청자**: Implementer
- **생성**: 2026-04-20
- **유형**: question (scope + A/B/C 방침 선택)
- **근거**: `/ultrareview` 2회 실행 결과 (주 프롬프트 대화 내 원문 보관)
- **처리 기대**: Reviewer가 SPEC/DESIGN/TASKS 쪼개기 + 방침 A/B/C 선택 → `outbox/APPROVED-F2-*.md` 회신

---

## 0. 컨텍스트 요약

- 스코프: `main` 브랜치, 최근 S1~S7 구현 직후.
- `/ultrareview` 2회 실행. 1차 5건(normal 4, nit 1) + 2차 3건(normal 3). 중복 제거 후 **고유 6건**.
- 2회 corroborated: **T2/T4 계열** (workflow·template apply silent overwrite / injectAgentHeader frontmatter 감지).
- MEMORY에 기재된 P0 "APPLY-FAIL (카드 Apply 자체 작동 안 함)" 증상의 **유력 원인 후보가 T1** (`/api/templates` 500 → card-picker 블랭크).
- Implementer가 9개 원본 파일을 Read하여 각 finding을 코드와 대조 · 전부 **참**으로 확정.

---

## 1. 진단 매트릭스 (코드 검증 완료)

| ID | 파일:라인 | Sev | 검증 결과 | 블라스트 |
|----|---------|-----|---------|--------|
| **T1** `getAllTemplates` | `src/lib/templates/index.ts:2389-2393` | normal | `try/catch`는 `.all()`만 감싸고 `.map(customRowToTemplate)`는 try 밖. `customRowToTemplate` (L2361-2375) 안의 `JSON.parse(row.tags/settings/extraFiles)` 3건 unguarded. `getTemplateById`(L2345-2358)는 per-row try/catch — **패턴 불일치**. | `/api/templates` 전체 500. Templates 페이지 + workflow picker + card picker 모두 블랭크. **APPLY-FAIL P0 원인 유력.** |
| **T2** workflow activate silent overwrite | `src/app/api/workflows/[id]/activate/route.ts:65-70` | normal | `if (existingRaw) { try {merge} catch {merged = filteredSettings} }` — 정확히 리뷰대로. 응답은 `{success:true}`. 첫 iter 이후 disk는 template-only JSON이 되어 후속 iter는 그 위에 merge. | 사용자 `mcpServers/permissions/env/hooks` 유실. deactivate는 delta를 빼므로 복구 불가 (snapshot은 DB `file_versions`에만). |
| **T3** templates apply + batch-apply | `src/app/api/templates/[id]/apply/route.ts:60-65` · `src/app/api/templates/batch-apply/route.ts:52-53` | normal | apply는 `catch {merged = filteredSettings}`, batch-apply는 `catch {merged = {}}` — 빈 객체부터 N개 template 누적. | T2와 동일. batch-apply는 N 템플릿 누적이라 더 치명. |
| **T4** injectAgentHeader frontmatter 감지 | `src/lib/agent-header-inject.ts:28-39` | normal | L28 `startsWith("---\n")` → CRLF 불통. L29 `indexOf("\n---\n", 4)` → no-trailing-\n 불통. Fallthrough L39는 헤더를 `---` **앞에** prepend → frontmatter 파괴. | Apply-to-all 한 번 클릭으로 `.claude/agents/*.md` 다수 brick. `stripAgentHeader` 복구 불가. |
| **T5** fs-watcher classifier | `src/lib/fs-watcher/index.ts:88, 112` | normal | L88 `parts[2]?.endsWith(".md")` 하드코딩 — `rules/sub/foo.md`에서 `parts[2]="sub"` → null. L157의 depth:4 comment는 nested rules를 명시했으나 classifier 미갱신. | SSE `rules`/`user-rules` 이벤트 drop. 초기 로드만 OK, 이후 edit/add/unlink 놓침 → UI stale. S6 worktree 동기화 기능 가치 훼손. |
| **T6** PATCH workflow 검증 누락 | `src/app/api/workflows/[id]/route.ts:53-60` vs `src/app/api/workflows/route.ts:15-22` | normal | POST는 `isValidItem`으로 `excludeTopLevelKeys`/`excludeExtraFiles` 배열 검증. PATCH는 `templateId: string`만 검증. `isValidItem`은 **export 안 됨**. | activate에서 `for (const key of "hooks")` 문자 iter + `String.prototype.includes` substring 매칭 → disk/DB desync. |
| **T7** sanitizeSettings substring | `src/app/api/custom-templates/route.ts:22` | nit | `JSON.stringify(obj).includes('"prototype"')` — 키와 값 구분 못 함. | `{env:{TOPIC:"prototype"}}` 등 합법 payload 400. body.tags는 영향 없음(sanitize 경유 X). |

---

## 2. 권장 우선순위

- **P0 (데이터 손실·전면 블로킹)**: T1, T2, T3, T4
- **P1 (기능 regression)**: T5, T6
- **P2 (nit)**: T7

## 3. Task → Fix → Verify 매트릭스

| Task | 파일 수정 (1~2) | 패치 요지 | 검증 |
|------|---------------|---------|------|
| T1 | `src/lib/templates/index.ts` | `customs = customRows.flatMap(row => { try { return [{...customRowToTemplate(row), isCustom: true}]; } catch(e){ console.warn('[templates] skip', row.id, e); return []; } })` — `getTemplateById` 패턴과 대칭. | unit: fixture 4 row(1 valid + 3 broken) → 1 valid만 반환. e2e: corrupt row 삽입 후 `/api/templates` 200 유지. |
| T2 | `src/app/api/workflows/[id]/activate/route.ts` | parse 실패 시 **409** `{error, path, detail}`. 루프 진입 전 1회만 parse 시도(iter마다 re-read 제거 권장). | `printf '{,}' > settings.json` → activate = 409 + 파일 해시 불변. |
| T3 | `src/app/api/templates/[id]/apply/route.ts` + `src/app/api/templates/batch-apply/route.ts` | 동일 409 패턴. batch-apply의 `merged = {}`도 제거. | 동상. |
| T4 | `src/lib/agent-header-inject.ts` (+ `tests/unit/agent-header-inject.test.ts` 신규) | detector를 `/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/` 로. post-condition: 결과가 `---`로 시작 검증, 실패 시 throw. | fixtures 6: LF+\n / LF no-\n / CRLF / no-fm / 이미 주입됨 / `name:` 값에 `---` 포함. |
| T5 | `src/lib/fs-watcher/index.ts` | `const leaf = parts[parts.length-1] ?? ""`. project: `parts[0]===".claude" && parts[1]==="rules" && leaf.endsWith(".md") && parts.length <= 5`. home 대칭. | `mkdir -p rules/sub && echo x > rules/sub/foo.md` → SSE `rules` 이벤트 관찰. |
| T6 | `src/app/api/workflows/route.ts` + `src/app/api/workflows/[id]/route.ts` | `isValidItem` export → PATCH의 L54-58 교체. | POST/PATCH 동일 payload 동일 응답. |
| T7 | `src/app/api/custom-templates/route.ts` | 재귀 own-key walker: `__proto__ / constructor / prototype` **키**만 검사. depth cap 32. | value `"prototype"` 포함 payload → 201. key는 reject. |

---

## 4. 방침 선택지 (Reviewer 결정 요청)

### Q1. T2/T3 파싱 실패 시 응답 정책
- **(A) 409 hard-stop + `{error, path, detail}` 반환, disk/DB 불변**
- (B) `{success:true, partial:true, parseError}` 부분 성공
- (C) snapshot에 bad bytes 보관 + 별도 recovery API

### Q2. T3 포함 여부 (pre-existing anti-pattern)
- **(A) 본 F-2에 포함 — 같은 패턴 한 번에**
- (B) F-3 별 스프린트로 분리

### Q3. T4 Apply-to-all 실패 정책
- **(A) 파일 단위 skip + error 리스트 반환**
- (B) 하나라도 실패하면 전체 abort

### Q4. T7 포함 여부
- **(A) 포함** (1파일 20줄, 묶는 비용이 더 싸)
- (B) 백로그

### Q5. 기존 S5/S6/S7 unstaged 변경과 F-2 관계
- (A) F-2 시작 전 먼저 커밋
- (B) 같이 통합
- **(C) T5/T6 착수 시점에 묶기** (같은 파일 touch 방지)

**Implementer 추천**: **모두 (A), Q5만 (C)**. 근거 — 데이터 손실 > UX 중단(Q1), 앤티패턴 분산 금지(Q2), batch 습성(Q3), nit 포함 비용 < 컨텍스트 재개 비용(Q4), 파일 중복 touch 회피(Q5).

---

## 5. 커밋/게이트 규율

- 각 task 단독 커밋, 메시지 `fix(<scope>): T-F2.<n> — <한 줄>`
- 각 task 구현 완료 시 `outbox/diff-review-F2-<n>.md` APPROVED 대기
- 게이트: `npm run lint` + `npm run test` + `e2e-before-commit.sh` 전수 통과
- `--no-verify` / `--amend` / force push **금지**

---

## 6. 질문

1. Q1~Q5 선택을 outbox 회신 바랍니다.
2. T1부터 진입해도 되는지 (APPLY-FAIL 가설 검증 우선) 명시.
3. T4 unit test 신규 파일(`tests/unit/agent-header-inject.test.ts`) 생성 승인 여부 (기존 test 디렉터리 위치 확인 필요 시 지시).
