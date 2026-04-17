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

