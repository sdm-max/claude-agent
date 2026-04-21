# SPEC Revision Request — T-004 (lint) v2 필요

> 상태: NEW
> 유형: spec-revision-request
> 상위: `inbox/spec-T-004-20260418-162933.md` (v1)
> 작성: Implementer (2026-04-19 13:42)
> 요청 대상: Reviewer

---

## 1줄 요약

T-004 v1 SPEC 사전 점검 결과 **2개 가정 위반** 발견. v1 그대로 실행 시 lint 여전히 실패 (`eslint: command not found`). SPEC v2 재작성 요청.

---

## 사전 점검 결과 (filesystem evidence)

| 확인 항목 | SPEC v1 가정 | 실제 상태 |
|----------|-------------|----------|
| eslint 설치 | "next.js 기본 의존성으로 포함" | **미설치** (devDependencies 없음, `node_modules/.bin/eslint` 없음, `node_modules/eslint` 없음) |
| eslint-config-next 설치 | 암묵 가정 | **미설치** (`node_modules/eslint-config-next` 없음) |
| config 파일 | "`eslint.config.*` 또는 `.eslintrc*` 존재" | **없음** (프로젝트 루트 검색 결과 0개, node_modules 내부만 존재) |

### 확인 명령 (재현)
```bash
cat package.json | grep -E "(eslint|next lint)"
# → 결과: "lint": "next lint" (dev deps 에 eslint 없음)

ls node_modules/.bin/eslint 2>&1
# → No such file or directory

ls node_modules/eslint 2>&1
# → No such file or directory

ls node_modules/eslint-config-next 2>&1
# → No such file or directory

find . -maxdepth 2 -name 'eslint.config.*' -not -path './node_modules/*' 2>/dev/null
# → (빈 결과)

find . -maxdepth 2 -name '.eslintrc*' -not -path './node_modules/*' 2>/dev/null
# → (빈 결과)
```

---

## v1 실행 시 예상 결과

v1 변경 (`"lint": "next lint"` → `"lint": "eslint src"`) 만 적용 시:

```bash
npm run lint
# → sh: eslint: command not found (또는 동등)
# → SPEC §"성공 판정": "Invalid project directory" 에러 없음 → 형식 PASS
# → 실질적으로 lint 여전히 불가
```

성공 판정 명령은 통과하지만 lint 복구 목적 달성 **실패**.

---

## SPEC v2 필요 항목 (Reviewer 결정 대상)

### 결정 1: 설치 범위
- **옵션 A**: eslint 만 설치 → Next.js 특화 규칙 (`<img>` 경고 등) 소실
- **옵션 B**: eslint + eslint-config-next 설치 → Next.js 규칙 유지
- **옵션 C**: eslint + @eslint/js + eslint-config-next flat config (ESLint 9 flat config 방식)

권장: **옵션 B** (Next.js 규칙 유지 + 복잡도 최소)

### 결정 2: config 파일 방식
- **옵션 A**: `.eslintrc.json` (레거시 포맷, extends: "next/core-web-vitals")
- **옵션 B**: `eslint.config.mjs` flat config (ESLint 9+ 권장)

권장: **옵션 B** flat config (현재 ESLint 표준)

### 결정 3: lint 범위
- `eslint src` (SPEC v1 primary) vs `eslint .` (차이: `next.config.ts`, `drizzle/**` 포함 여부)

권장: **`eslint src`** (빠름, drizzle/next-config 은 lint 불필요)

### 결정 4: task 분할
- T-004 를 단일 task 로 3+ 파일 수정 (package.json + config + 설치)? → CLAUDE.md "1 task = 1~2 파일" 위반
- 혹은 T-004 를 sub-task 로 분할?
  - T-004.1: devDependencies 추가 (package.json 만)
  - T-004.2: config 파일 생성 (`eslint.config.mjs` 만)
  - T-004.3: scripts.lint 변경 (package.json 만)

권장: **분할** — 1 task = 1 파일 원칙 준수

---

## Implementer 제안 요약

SPEC v2 로 다음 항목 명시 요청:

1. ESLint 설치 범위: eslint + eslint-config-next (devDependencies)
2. Config: `eslint.config.mjs` (flat config) with next/core-web-vitals extends
3. lint 대상: `src/`
4. task 분할: T-004 → T-004.1 (deps 추가) + T-004.2 (config 생성) + T-004.3 (scripts 변경)

본 요청 승인 시 v2 SPEC 3개 (T-004.1/.2/.3) 를 Reviewer 가 새로 inbox 에 올림 → Implementer 가 순차 수행.

---

## 판단 근거 (Implementer 자체 분석)

v1 SPEC 의 Edge Case 3 "ESLint 자체가 config 오류 낼 수 있음 — 이 경우 config 문제는 별도 task" 는 **config 문제만** 언급하며 **binary 미설치** 시나리오는 범위 밖. 따라서 v1 상태로는 판정 기준에 공백 있음.

v1 `성공 판정 명령` (`grep -q "Invalid project directory"`) 이 과도히 느슨: binary 미설치 → 다른 에러 → 여전히 PASS 로 판정됨. 근본 문제 해소 안 됨.

---

## 대안 경로 (참고)

Reviewer 가 v2 대신 아래 선택도 가능:

- **T-004 전체 폐기**: `next lint` 경고를 무시 (게이트에서 제외). 다른 우선순위로 진행.
- **T-004 사소화**: v1 그대로 수행 + 후속 task 로 eslint 설치 분리. 이 경우 lint 게이트는 여전히 실패.

선택은 Reviewer 에게 위임.
