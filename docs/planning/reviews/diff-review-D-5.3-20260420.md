# Diff Review — D-5.3

- **Task**: D-5.3 — Split checklist render guard so extraFiles-only templates render the Extra Files checkbox block
- **Scope ref**: SPEC §D-5.3
- **Target file**: `src/app/templates/page.tsx`
- **Date**: 2026-04-20
- **Reviewer**: Reviewer Claude

## 판정

- [x] **APPROVED**

## Diff stat

```
 src/app/templates/page.tsx | 128 ++++++++++++++++++++++++---------------------
 1 file changed, 68 insertions(+), 60 deletions(-)
```

(대부분은 `<>` fragment / 중첩 들여쓰기 재구성으로 인한 라인 이동. 실질 로직 변경은 외곽 가드 합성 1건.)

## Fix target 확인

- **기존 버그**: outer guard = `detail.settings && Object.keys(detail.settings).length > 0` 만 체크 → `settings: {}` 템플릿(Extra Files 전용, 예: `skill-testing` / Testing Patterns)은 체크리스트 컨테이너 자체가 렌더되지 않아 Extra Files 체크박스도 나오지 않음.
- **수정**:
  - Outer guard → 합성 조건 `((settings-check) || (extraFiles-check))`
  - Inner settings 블록 → 기존 settings-check 가드 유지 (fragment `<>...</>` 로 래핑)
  - Inner extraFiles 블록 → 기존 `detail.extraFiles && detail.extraFiles.length > 0` 가드 유지
  - 텍스트/카피 변경 없음, 다른 JSX 블록(Settings JSON preview, Warning 등) 미변경
- **Template 확인**: `src/lib/templates/index.ts:714` `skill-testing` (name="Testing Patterns") → `settings: {}, extraFiles: [{ path: ".claude/skills/testing-patterns/SKILL.md", ... }]` ✓

## Checks

| # | Check | Result |
|---|-------|--------|
| 1 | git status --short — only templates/page.tsx modified | ✓ (하우스키핑 파일들은 선행 커밋에서 정리됨) |
| 2 | Outer composite guard `((settings) \|\| (extraFiles))` | ✓ 라인 954~956 |
| 2 | Inner settings block with its own guard | ✓ 라인 958~959 |
| 2 | Inner extraFiles block with its own guard | ✓ (`detail.extraFiles && detail.extraFiles.length > 0`) |
| 2 | No text/copy changes, no other JSX touched | ✓ |
| 3 | grep `Object.keys(detail.settings).length` = 2 occurrences | ✓ (lines 955, 959) |
| 4 | grep `detail.extraFiles` count = pre(3) + 1 = 4 | ✓ |
| 5 | `npx tsc --noEmit` | ✓ exit 0 |
| 6 | `npm run lint` | ✓ clean |
| 7 | `npm run test` | ✓ 74/74 pass (9 files) |
| 8 | `bash .claude/hooks/e2e-scenarios.sh` | ✓ ALL PASS (S1~S6) |
| 9 | Template `skill-testing` has `settings: {}` + `extraFiles: [{...}]` | ✓ index.ts:723-757 |

## 4-combination 렌더 매트릭스 (코드 로직 기반)

| # | settings | extraFiles | 외곽 가드 통과? | 렌더 결과 |
|---|----------|-----------|----------------|----------|
| A | 있음 (keys > 0) | 있음 (len > 0) | ✓ | 체크리스트 컨테이너 + Settings 블록 + Extra Files 블록 (둘 다) |
| B | 있음 (keys > 0) | 없음/빈배열 | ✓ (settings branch) | Settings 블록만 |
| C | 없음/`{}` | 있음 (len > 0) | ✓ (extraFiles branch) | **Extra Files 블록만** (← D-5.3 수정의 핵심) |
| D | 없음/`{}` | 없음/빈배열 | ✗ | 렌더 없음 (의도된 동작) |

조합 C 가 수정 전에는 D 처럼 동작했던 것이 버그. 이제 정상 렌더. B/D 는 기존 동작 유지.

## 다음 단계 권장

D-5 scope 3개 subtask (D-5.1 / D-5.2 / D-5.3) 모두 APPROVED. Implementer 는 커밋 진입 가능 (커밋 메시지: `fix(templates): T-D-5.3 — ...`).

브라우저 검증(Testing Patterns 카드 Detail Dialog 열어 Extra Files 체크박스 노출 확인) 은 D-5 전체 병합 후 TESTING.md §E-1/§C-3 체크리스트로 재검증 권장.
