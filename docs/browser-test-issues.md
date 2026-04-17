# 브라우저 검증 이슈 로그 (2026-04-17 세션)

검증 중 발견한 문제는 바로 수정하지 않고 여기에 누적 기록. 추후 기획 → 수정 사이클로 진행.

## 테스트 진행 상황

| Part | 내용 | 상태 |
|------|------|------|
| A    | Settings UX (Phase 0) | ✅ PASS |
| B    | User Settings 5탭 | ⬜ |
| C    | Conflict Detection | ⬜ |
| D    | Applied Templates + Undo | ⬜ |
| E    | Selective Apply + Trace | ⬜ |
| F    | Order Dependency Warning | ⬜ |
| G    | Custom Templates (Phase 3) | ⬜ |

## 이슈 목록

### Part A — Settings UX
(이슈 없음)

### Part B — User Settings 5탭

**B-3 FAIL — Rules 파일이 디스크에 저장되지 않음**
- 재현: /settings/user → Rules 탭 → "+ New" → test-rule.md → 내용 입력 → Save
- 증상: UI상 파일 생성된 것처럼 보이지만 `ls ~/.claude/rules/` 결과 비어있음 (total 0)
- 기대: `~/.claude/rules/test-rule.md` 파일 존재
- 추정 원인 후보:
  - API /api/user/rules POST가 mkdirSync recursive 누락
  - isValidName 검증 실패로 silent drop
  - SSE 이벤트로는 broadcast되지만 fs.writeFileSync 미호출
- 조사 필요 범위: `src/app/api/user/rules/route.ts` + FileDirectoryEditor save 경로

**사용자 질문 정리 (참고)**:
- Rules는 프로젝트 단위도 있음: `/api/projects/[id]/rules` + 프로젝트 페이지 Rules 탭 존재 (projects/[id]/page.tsx:215,366)
- Hooks 등록은 settings.json의 `hooks: { EventName: [{matcher, hooks:[{type, command}]}]}` 구조, Hooks 탭에서 저장 시 자동 직렬화

### Part C — Conflict Detection
_대기_

### Part D — Applied Templates
_대기_

### Part E — Selective Apply + Trace
_대기_

### Part F — Order Dependency Warning
_대기_

### Part G — Custom Templates
_대기_

## 처리 방침
- 이슈는 재현 경로 + 증상 + 기대 결과 순으로 기록
- 섹션별로 PASS/FAIL 표시
- 모든 섹션 완료 후 이슈를 기획 단계로 묶어서 수정 계획 수립


## 세션 2026-04-17 야간 — Test Project 대상 검증

진행자: 사용자 직접 / 프로젝트: **Test Project** (별도 등록)

### Part A: PASS
### Part B: PASS
### Part C-1 (Conflict Detection): PASS (개선 요청)
- 이슈 C-1: 충돌 메시지에서 어떤 부분이 충돌인지 세부 표시 부족
- 요청 C-2: 카드에 다중 기능 있을 때 각 기능별 체크리스트로 선택 적용
- **FAIL C-3 (regression)**: 카드 Detail Dialog 에 다중 체크 풀기 기능 사라짐
  * 조사 필요: templates/page.tsx 의 "Phase 2-1 per-block Apply checklist" 부분
### Part C-2 (카드 간 충돌): PASS

### Part D (Applied + Undo)
- 이슈 D-1: 카드 체크박스 풀면 Apply Bar 하단 scope/project 선택이 사라짐 (UX 불편)
- **FAIL D-2 (심각)**: 다중 체크 → 프로젝트 선택 → 보안카드 충돌 confirm → 적용 후
  실제로 프로젝트 settings.json 에 설정이 남음 (Undo 불완전 또는 의도치 않은 적용)

### Part E (Selective Apply + Trace)
- **FAIL E-1**: 체크박스가 1개만 보임 (top-level 키가 1개인 카드만 테스트했는지 확인 필요)

### Part F (Order Dependency Warning)
- 경고는 정상 동작
- 이슈 F-1: 표시되는 모델명 "Opus 4.6" 하드코딩 (4.7 나왔지만 업데이트 안 됨)
  * 원인: MODEL_SHORT_NAMES 고정 매핑 + MODEL_OPTIONS 미갱신
  * **수정됨 (이 커밋)**: getModelDisplayName fallback 함수 + 4.7 옵션 추가
