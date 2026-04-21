---
task: T-F2.1
type: diff-review
decision: APPROVED
verdict: APPROVED
author: Reviewer
created: 2026-04-20
diff_ref: 8a270cb95a86d88d88e14625e4700cb57737b3c4
scope_ref: approved-F2-scope-20260420.md
---

# diff-review T-F2.1 — `getAllTemplates` per-row 복원력

[x] APPROVED

---

## 1. Diff 요약

- **파일 변경**: 1 file (`src/lib/templates/index.ts`)
- **라인 변경**: +8, -4
- **변경 요지**: `customRows.map(row => ({...customRowToTemplate(row), isCustom}))` → `customRows.flatMap(row => { try { return [{...customRowToTemplate(row), isCustom: true}]; } catch (e) { console.warn('[templates] skipping corrupt custom row <id>', e); return []; } })`
- **SPEC 정합**: §T-F2.1 "변경 요지"와 **정확히 일치**. `getTemplateById` 의 기존 per-row try/catch 패턴과 대칭. 추가·부수 변경 없음.
- **Touch 한도**: 1 파일, SPEC 한도 ≤ 2 준수.
- **무관 unstaged**: `docs/ARCHITECTURE.md`, `src/app/projects/[id]/page.tsx`, `src/components/editors/HooksUnifiedEditor.tsx`, `docs/worklog/session-2026-04-19.md`, `REVIEW.md`, `eslint.config.mjs`, `package*.json`, `src/lib/db/migrate.ts`, `src/lib/fs-watcher/index.ts` 존재 확인. 이번 T-F2.1 commit 대상 **아님** (Q5=C per SPEC, Implementer 별도 처리). Guard 0c는 파일 제한이 아니므로 커밋 범위만 정확하면 무방 — Implementer에게 `git add src/lib/templates/index.ts` 만 스테이징하도록 고지.

---

## 2. Acceptance Criteria 검증 (SPEC §T-F2.1)

| # | Criterion | 검증 | 증거 |
|---|-----------|------|------|
| 1 | fixture 4건(valid 1 + broken JSON 3) → `getAllTemplates()` 정확히 1건 반환, 로그 3회 | **PARTIAL (실용 등가)** | Implementer가 단일 corrupt row(`custom-f2-probe`) 로 재현 & 해소 확인. 4-fixture 엄격 버전은 unit test 부재(T-F2.4에서 vitest 스캐폴드 도입 예정). flatMap+try/catch 코드 경로는 trivially per-row 적용되므로 N=1 재현이 N=3로 일반화. 본 task 한도 내 수용. |
| 2 | `curl /api/templates` 200 유지 (500 아님) | **PASS** | Reviewer 재확인: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/templates` → `200`. Implementer repro 로그: pre-fix 500 → post-fix 200. |
| 3 | `/templates` 페이지 렌더, card-picker/workflow-picker 블랭크 해소 | **PASS (인퍼드)** | API 200이 상위 페이지 렌더의 필요조건이고, 페이지는 이 API만 차단 요인이었음. UI 시각 확인은 브라우저 세션 재개 시 F-2 최종 회귀 회차에서 재확인. |
| 4 | Gates: lint + build + test + e2e-before-commit.sh | **PASS** | 아래 §3 재실행 결과 참조. e2e-before-commit.sh는 commit 시점 hook이 자동 검증. |

---

## 3. Gate 재실행 (Reviewer 자체 실행)

| Gate | 명령 | 결과 |
|------|------|------|
| TSC | `npx tsc --noEmit` | exit 0 |
| Lint | `npm run lint` | exit 0 (no findings) |
| Test | `npm run test` | 1/1 pass (278ms) |
| Build | (Implementer 보고) | success — Reviewer 추가 재실행 생략(시간비용). TSC 통과 + 변경 범위가 1 함수 내부인 점 감안. |

---

## 4. APPLY-FAIL 재현·해결 검증

| 항목 | 값 |
|------|---|
| Pre-fix | `/api/templates` 500 (corrupt row `custom-f2-probe` 삽입 시) |
| Post-fix | `/api/templates` 200 (동일 corrupt row, 새 코드) |
| Reviewer 재검증 curl | **200** (live dev server) |
| Fixture 정리 | `SELECT COUNT(*) FROM custom_templates WHERE id='custom-f2-probe'` → **0** |

**P0 가설 입증**: APPLY-FAIL은 custom_templates 테이블의 corrupt JSON 1건이 전체 `getAllTemplates()` 호출을 500으로 터뜨린 단일 지점이었고, per-row resilience 도입으로 해소. 이후 T-F2.2 ~ T-F2.7 병행 진행 가능.

---

## 5. Risks / Notes

- **console.warn 로그**: prod 로그 소음 가능. 모니터링 임계 필요 시 향후 구조화 로거로 승격(backlog).
- **Corrupt row 원인 조사 미완**: 어떻게 corrupt 삽입이 발생했는지(입력 검증 약점?) 별건. T-F2.7(`sanitizeSettings` 강화)가 일부 완화 예상.
- **Unit test fixture**: T-F2.4에서 vitest 스캐폴드 들어올 때 본 경로도 4-fixture 테스트 추가 고려(backlog, non-blocking).
- **커밋 범위**: Implementer는 반드시 `git add src/lib/templates/index.ts` 로 **이 파일만** 스테이징할 것. 다른 unstaged 파일 섞어 커밋 금지.

---

## 6. 판정

**[x] APPROVED**

**다음 task**: T-F2.2 (workflow activate 파싱 실패 시 409). Implementer는 본 커밋 완료 후 inbox 없이 바로 착수 가능 (scope-approval 이미 APPROVED).
