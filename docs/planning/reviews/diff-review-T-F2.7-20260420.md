---
task: T-F2.7
type: diff-review
date: 2026-04-20
reviewer: Reviewer Claude
subject: sanitizeSettings — substring → recursive own-key walker + depth cap
spec: approved-F2-scope-20260420.md §T-F2.7
verdict: APPROVED
---

# Diff Review — T-F2.7

- [x] APPROVED

## 변경 파일 (diff stat)

| 파일 | +/- |
|------|-----|
| `src/app/api/custom-templates/route.ts` | +28 / -4 |

총 1 파일. SPEC 한도(≤2) 준수. drive-by 변경 없음 — GET handler, POST 본문 검증, DELETE, `validateExtraFilePath` 전부 무수정 확인.

## 코드 검증

| 항목 | 기대 | 실측 |
|------|------|------|
| `FORBIDDEN_KEYS = new Set([...])` | 세 리터럴(`__proto__`,`constructor`,`prototype`) | ✅ L17 |
| `MAX_SANITIZE_DEPTH = 32` | 상수 정의 | ✅ L18 |
| `containsForbiddenKey(value, depth)` | 재귀 own-key 워커 | ✅ L20-39 |
| 깊이 초과 시 throw `"depth_exceeded"` | 첫 줄 검사 | ✅ L21-23 |
| 배열 원소 재귀 | 인덱스는 key 취급 X, element만 recurse | ✅ L26-31 |
| plain object `Object.keys` own-key 검사 + 값 재귀 | 그대로 | ✅ L32-38 |
| `sanitizeSettings` top-level guard 보존 | `"settings must be an object"` | ✅ L42-44 |
| `sanitizeSettings` JSON round-trip 보존 | `JSON.parse(JSON.stringify(obj))` | ✅ L49 |
| 에러 문자열 `"settings contains forbidden keys"` 보존 | verbatim | ✅ L46 |
| `"depth_exceeded"` verbatim | 신규 | ✅ L22 |
| substring `json.includes(...)` 패턴 제거 | 치환 | ✅ diff 상 3-line 삭제 확인 |

## Drive-by 점검

`git status --short` 기타 항목 (`docs/ARCHITECTURE.md`, `src/app/projects/[id]/page.tsx`, `src/components/editors/HooksUnifiedEditor.tsx`, untracked `worktrees/`, `bash-matcher-builder/`, `REVIEW.md`)은 본 task 무관 — SPEC §Q5 합의에 따라 F-2 범위 밖 사전존재 변경.

## HTTP 재증명 (6 probes)

| Probe | 설명 | Expected | Actual HTTP | Body |
|-------|------|----------|-------------|------|
| (a) | 값(string)에 "prototype"/"constructor" 포함 — env | 201 | **201** | `{"id":"custom-zqVOmFVy","success":true}` |
| (b) | 배열 원소 값에 "prototype" 문자열 — permissions.allow | 201 | **201** | `{"id":"custom-7Ov5Xqv6","success":true}` |
| (c) | top-level key `__proto__` | 400 + forbidden | **400** | `{"error":"settings contains forbidden keys"}` |
| (d) | nested key `prototype` (deep.nested.prototype) | 400 | **400** | `{"error":"settings contains forbidden keys"}` |
| (e) | array element object key `constructor` (`items:[{constructor:"bad"}]`) | 400 | **400** | `{"error":"settings contains forbidden keys"}` |
| (f) | 40-deep nested `{x:{x:...}}` | 400 + depth_exceeded | **400** | `{"error":"depth_exceeded"}` |

(a)+(b)가 기존 substring 로직 false-positive 시나리오 — 새 walker에서 **값은 검사 안 하므로 201** 통과. (c)(d)(e)는 own-key 검사가 top/nested/array-element-object에서 모두 작동함을 입증. (f)는 32 depth 넘으면 차단.

Cleanup:
- DELETE `/api/custom-templates/custom-zqVOmFVy` → 200 `{"success":true}` ✅
- DELETE `/api/custom-templates/custom-7Ov5Xqv6` → 200 `{"success":true}` ✅

## Gate 결과

| Gate | 결과 |
|------|------|
| `git status --short` (T-F2.7 한 파일만 변경, 외 사전존재) | ✅ |
| `git diff` 일치성 | ✅ SPEC §T-F2.7과 정확 일치 |
| `npx tsc --noEmit` | exit 0 ✅ |
| `npm run lint` | no warnings ✅ |
| `npm run test` | 8 pass / 2 files ✅ |
| `.claude/hooks/e2e-scenarios.sh` | ALL PASS (S1~S4) ✅ |
| HTTP probe 6종 | 201/201/400/400/400/400 모두 일치 ✅ |
| Cleanup DELETE | 2/2 × 200 ✅ |

## Concerns

1. **문자열 값 통과는 의도된 완화 (기능 개선)**: (a)/(b)에서 env value "prototype"/"the constructor pattern"과 permissions.allow `"Bash(prototype something)"`이 201을 받는 것은 과거 substring 매칭의 false-positive 제거이며 SPEC 요구사항. 실제 prototype-pollution 위험은 **키**에서 오므로 own-key 검사로 충분.
2. **Depth 32**: 일반 Claude settings (env/permissions/hooks) 최대 중첩이 4-5 수준이라 현실 페이로드 모두 통과. 32는 malicious stack overflow 방지용이며 타당.
3. **Symbol/getter 키**: `Object.keys`는 enumerable own string keys만. `Object.defineProperty(o, "__proto__", {enumerable:false})` 같은 엣지는 JSON 직렬화 단계에서 자연 소실되어 위협 없음. 현 설계 충분.

## 최종

APPROVED. SPEC §T-F2.7 변경 요지(substring → own-key 재귀 워커, depth cap 32, `"depth_exceeded"` 에러 도입, `"settings contains forbidden keys"` 유지) 및 Acceptance(값 string 통과 / 키 차단 / 깊이 차단) 전부 충족. 6종 HTTP probe 기대치 100% 일치. 다른 handler 회귀 없음. F-2 전 범위(T-F2.1~T-F2.7) 완료.
