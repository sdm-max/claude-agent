---
task: N-5
decision: APPROVED
created: 2026-04-20
type: diff-review
reviewer: Reviewer (orchestration mode)
---

[x] APPROVED

# N-5 Diff Review — sanitize error codes

## 상태

**APPROVED** — SPEC 부합. 모든 게이트 + live HTTP probe 통과. backwards-compat 유지.

---

## 변경 파일

- [x] `src/app/api/custom-templates/route.ts` (catch block, 라인 105-110)
- [x] `tests/unit/sanitize-settings.test.ts` (5 cases, `body.code` assertion 추가)

## Diff stat

```
src/app/api/custom-templates/route.ts |  7 ++++++-
 tests/unit/sanitize-settings.test.ts  | 15 ++++++++++-----
 2 files changed, 16 insertions(+), 6 deletions(-)
```

## 게이트 결과

- [x] `npx tsc --noEmit` → 에러 0
- [x] `npm run lint` → 에러 0
- [x] `npm run test` → **8 test files / 65 tests pass** (regression 0)
- [x] `.claude/hooks/e2e-scenarios.sh` → ALL PASS (S1~S6)

---

## 소스 diff (catch block만 수정, sanitizeSettings 본체 무변경)

```diff
-    return NextResponse.json({ error: e instanceof Error ? e.message : "invalid settings" }, { status: 400 });
+    const message = e instanceof Error ? e.message : "invalid settings";
+    const code =
+      message === "depth_exceeded" ? "depth_exceeded" :
+      message === "settings contains forbidden keys" ? "forbidden_keys" :
+      "invalid_settings";
+    return NextResponse.json({ error: message, code, detail: message }, { status: 400 });
```

---

## Per-case 테스트 assertion 표

| # | 케이스 | error match | `code` assertion | 판정 |
|---|---|---|---|---|
| 1 | `__proto__` top-level (raw JSON) | `/forbidden keys/` | `"forbidden_keys"` | OK |
| 2 | `constructor` depth 2 | `/forbidden keys/` | `"forbidden_keys"` | OK |
| 3 | `prototype` top-level | `/forbidden keys/` | `"forbidden_keys"` | OK |
| 4 | 깊이 > 32 (`depth_exceeded`) | `/depth_exceeded/` | `"depth_exceeded"` | OK |
| 5 | array 원소 안 `__proto__` | `/forbidden keys/` | `"forbidden_keys"` | OK |

5개 전 케이스 `expect(json.code).toBe(...)` 추가 확인. 새 테스트 케이스 0개 (scope 준수).

---

## Live HTTP evidence

### forbidden_keys probe
```
$ curl -s -X POST http://localhost:3000/api/custom-templates \
    -H "Content-Type: application/json" \
    --data-raw '{"name":"n5-probe-proto","category":"custom","settings":{"__proto__":{"x":1}}}' \
  | jq '{error, code, detail}'
{
  "error": "settings contains forbidden keys",
  "code": "forbidden_keys",
  "detail": "settings contains forbidden keys"
}
```

### depth_exceeded probe (nested 40 levels)
```
{
  "error": "depth_exceeded",
  "code": "depth_exceeded",
  "detail": "depth_exceeded"
}
```

두 경우 모두 HTTP 400 + `code` 필드 SPEC 매핑 일치.

---

## Reviewer 검증 체크리스트

- [x] `error` 필드 기존 문자열 완전 동일 (backwards-compat) — forbidden_keys 케이스 `"settings contains forbidden keys"` 그대로, depth 케이스 `"depth_exceeded"` 그대로
- [x] `code` 필드 세 값만 발생: `depth_exceeded` | `forbidden_keys` | `invalid_settings`
- [x] `detail` 필드 존재 (= error 값)
- [x] 5 테스트 케이스 모두 `expect(json.code).toBe(...)` 추가됨
- [x] 새 테스트 케이스 추가 없음 (scope 준수)
- [x] `sanitizeSettings` 함수 본체 무변경 (catch block만 수정)
- [x] union type narrowing (tsc strict) OK
- [x] catch block 외부 변경 없음 (diff가 catch block에 한정)

---

## 판정

- [x] APPROVED
- [ ] APPROVED_WITH_CONCERNS
- [ ] BLOCKED

### concerns / blockers

없음.
