---
task: N-5
decision: APPROVED
created: 2026-04-20
type: scope-approval
reviewer: Reviewer (orchestration mode)
source: blind-review nit N-5 (sanitize error codes)
---

[x] APPROVED

# N-5 Scope — sanitizeSettings 에러 코드 안정화

## 배경 (blind review N-5)

`src/app/api/custom-templates/route.ts` 의 `sanitizeSettings` 는 두 가지
Error.message 를 throw:
1. `"depth_exceeded"` (depth-cap 초과)
2. `"settings contains forbidden keys"` (prototype pollution)

POST 핸들러는 두 케이스 모두 `{ error: e.message }` 로 400 반환.
클라이언트는 두 케이스를 **문자열 regex 매칭**으로만 구분 가능 →
"fragile to refactor" nit.

## 해결 원칙

**Backwards-compatible**. `error` 필드는 기존 문자열 그대로 유지.
별도로 `code` + `detail` 필드를 추가해 **new clients 는 코드로 분기** 가능.
기존에 `error` regex 에 의존하는 테스트/클라이언트는 무변경.

---

## 범위 (1 파일 수정 + 1 테스트 파일 보강 = 2 files)

### 1. `src/app/api/custom-templates/route.ts` — catch block 재작성

현재 (line 102-107):
```ts
  let settings: ClaudeSettings;
  try {
    settings = sanitizeSettings(body.settings);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "invalid settings" }, { status: 400 });
  }
```

변경:
```ts
  let settings: ClaudeSettings;
  try {
    settings = sanitizeSettings(body.settings);
  } catch (e) {
    const message = e instanceof Error ? e.message : "invalid settings";
    // N-5: stable error code for programmatic distinction (backwards-compatible; error 유지)
    let code: "depth_exceeded" | "forbidden_keys" | "invalid_settings";
    if (message === "depth_exceeded") {
      code = "depth_exceeded";
    } else if (message === "settings contains forbidden keys") {
      code = "forbidden_keys";
    } else {
      code = "invalid_settings";
    }
    return NextResponse.json(
      { error: message, code, detail: message },
      { status: 400 },
    );
  }
```

**제약**:
- `error` 필드 기존 문자열 **완전 동일**하게 유지 (regex 호환)
- 새 필드 `code` / `detail` 만 추가
- `sanitizeSettings` 자체 수정 금지 (스펙/throw 문자열 그대로)
- 다른 400 응답 (`"Invalid JSON"`, `"name is required..."` 등) 건드리지 않음

---

### 2. `tests/unit/sanitize-settings.test.ts` — code 필드 assertion 추가 (5 cases)

기존 5개 테스트에 `body.code` assertion 추가. `body.error` 기존 assertion 그대로 유지 (regression check).

- **Case 1** (`rejects __proto__ at top-level ...`):
  ```ts
  const json = (await res.json()) as { error?: string; code?: string };
  expect(json.error).toMatch(/forbidden keys/);
  expect(json.code).toBe("forbidden_keys");
  ```

- **Case 2** (`rejects constructor key nested at depth 2 ...`):
  ```ts
  const json = (await res.json()) as { error?: string; code?: string };
  expect(json.error).toMatch(/forbidden keys/);
  expect(json.code).toBe("forbidden_keys");
  ```

- **Case 3** (`rejects prototype key at top-level ...`):
  ```ts
  const json = (await res.json()) as { error?: string; code?: string };
  expect(json.error).toMatch(/forbidden keys/);
  expect(json.code).toBe("forbidden_keys");
  ```

- **Case 4** (`rejects deeply nested object (> MAX_SANITIZE_DEPTH=32) ...`):
  ```ts
  const json = (await res.json()) as { error?: string; code?: string };
  expect(json.error).toMatch(/depth_exceeded/);
  expect(json.code).toBe("depth_exceeded");
  ```

- **Case 5** (`rejects __proto__ inside array element object ...`):
  ```ts
  const json = (await res.json()) as { error?: string; code?: string };
  expect(json.error).toMatch(/forbidden keys/);
  expect(json.code).toBe("forbidden_keys");
  ```

**제약**:
- 기존 assertion 5개 모두 유지 (추가만)
- 새 테스트 케이스 **추가 금지** (scope out) — 기존 5 케이스 보강만
- describe/it 이름 변경 금지

---

## 범위 밖 (out of scope)

- `sanitizeSettings` 자체 로직 변경 — NO
- 다른 API 라우트의 400 응답 표준화 — NO (별도 task 필요)
- `"Invalid JSON"`, `"name is required"` 등 다른 400 응답에 code 추가 — NO
- 새 테스트 케이스 추가 (예: happy path에서 code 없음 확인) — NO
- `invalid_settings` 기본값 케이스 테스트 — NO (현재 sanitizeSettings 는 해당 경로 없음)

---

## 게이트 요구사항

Implementer 는 다음 전수 통과 후 diff-review 요청:

1. **TypeScript**: `npm run tsc` → 에러 0
   - 특히 union type `"depth_exceeded" | "forbidden_keys" | "invalid_settings"` narrowing 확인
2. **Lint**: `npm run lint` → 에러 0
3. **Build**: `npm run build` → 성공
4. **Vitest**:
   - 기존 65 test pass (regression 0)
   - `tests/unit/sanitize-settings.test.ts` 5 cases 모두 `code` assertion 추가 후 pass
5. **e2e-before-commit.sh**: Guard 1 / 0c / 0d / TSC / dev / e2e-scenarios 전부 통과

---

## 완료 판정 (Reviewer 검증 항목)

diff 수신 후 Reviewer 확인:
- [ ] `error` 필드 기존 문자열 완전 동일 (regex `/forbidden keys/`, `/depth_exceeded/` 매칭 유지)
- [ ] `code` 필드 세 값만 발생: `"depth_exceeded"` | `"forbidden_keys"` | `"invalid_settings"`
- [ ] `detail` 필드 = `error` 필드 값 (현재는 동일, future-proofing용)
- [ ] 5 테스트 케이스 모두 `expect(json.code).toBe(...)` 추가됨
- [ ] 새 테스트 케이스 추가 없음 (scope out)
- [ ] `sanitizeSettings` 함수 본체 무변경
- [ ] vitest 70개 assertion (기존 10 + 신규 5 code assertion + 기존 55 유지 추정) — 숫자는 대략치, 중요한 건 regression 0

---

## Commit message 규격

```
fix(api): N-5 — sanitize error code (backwards-compat)

catch block 에서 Error.message → stable code 매핑 추가.
기존 `error` 필드 유지, 신규 `code` + `detail` 필드 추가.

- depth_exceeded → code: "depth_exceeded"
- "settings contains forbidden keys" → code: "forbidden_keys"
- 기타 → code: "invalid_settings"

tests/unit/sanitize-settings.test.ts 5 cases 에 code assertion 추가.

Blind review nit N-5 해소. `error` regex 호환성 100% 유지.
```

Scope: 2 files. 범위 내.
