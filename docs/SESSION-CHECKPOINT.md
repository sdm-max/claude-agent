# 최근 세션 체크포인트

> **매 세션 종료 직전 반드시 갱신**. 새 세션 시작 시 이 파일부터 읽고 "다음 액션"부터 재개.

## 마지막 업데이트
2026-04-17 (야간) — S4 전체 완료 (R1 공통 헤더 + R2 Hook 템플릿 변수)

## 현재 진행 Phase
S4 완료 → **S5 대기** (Matcher preset + Bash 화이트리스트 빌더)

## 다음 액션 (새 세션 첫 작업)
### 우선순위 A: 브라우저 검증 (미검증 기능 실동작 확인)
실제 sees 또는 테스트 프로젝트에서 다음 순서로 검증:

1. **Part H (Skills)**: /settings/user + /projects/[id] Skills 탭
   - New 버튼 → 이름 입력 → 생성
   - SKILL.md 내용 편집 + Save
   - 별도 Claude Code 세션에서 `/skill-name` 호출 → 로드 확인
2. **Part I (Workflows)**: /workflows 페이지
   - 새 워크플로 생성 (items JSON 에 기존 템플릿 ID 입력)
   - Activate → settings.json 에 적용 확인
   - Deactivate → 정확히 Undo 확인 (sharedWithOther 보존)
3. **S4-R1 (Agent 공통 헤더)**: /projects/[id] → Agents 탭
   - Header 버튼 → 헤더 내용 저장 → Apply to All → 에이전트 파일들 업데이트 확인
   - Strip from All → 복구 확인
4. **S4-R2 (Hook 템플릿)**: Agents 탭 → Deploy Hooks 버튼
   - .claude/hooks/*.tpl 이 있으면 배포 → 실제 .sh 생성 확인
5. **Part A~G 회귀**: 기존 기능 정상 동작

### 우선순위 B: S5 구현 (검증 후)
- R3: Matcher preset lib + 편집 UI 통합
- R4: Bash 화이트리스트 빌더 (sees block-leader-edit.sh 시각화)

## 알려진 블로커
- 없음

## 미해결 이슈
- S7 에서 처리:
  - docs/backlog.md 재구조화
  - docs/work-report.md 74K 분할
  - ARCHITECTURE.md 죽은 코드 섹션에서 EditorToolbar 제거 (S2-D1 정정)
- S6 에서 처리: sees worktree 스캔 + 동기화

## 브라우저 검증 상태
- Part A: PASS
- Part B: B-3 PASS, 나머지 미검증
- Part C, D, E, F, G: 미검증
- Part H (신규): 미검증 ← **우선**
- Part I (신규): 미검증 ← **우선**
- S4-R1 헤더: 미검증
- S4-R2 deploy: 미검증

## 이번 세션 커밋 전체 (총 19개, 시간순)

### Phase 3 (Custom Templates)
- c99f257 3-1 custom_templates 테이블
- d767175 3-2 하드코딩+DB 로더 통합
- 2960ee0 3-3 Custom Templates CRUD API
- faaa682 3-4 Templates 페이지 커스텀 UI
- 7d6ffe6 3-5 Save as Card

### S1 Context infra
- 85b9c37 CLAUDE.md @imports + docs 5개 + auto memory

### S2 죽은 코드 + Rules + Skills
- 9c25b91 D1 죽은 코드 2파일
- 56dafbb D2 Rules 재귀+frontmatter
- b6b1f4d CS Skills API
- f5b2226 CS-ui SkillEditor + 탭

### S3 Global + Workflows
- 475fe67 G Global managed 배너
- 47132b0 W1 workflows 테이블
- fd0b2ce W2 CRUD + activate/deactivate
- ee252eb W3 /workflows 페이지 + 사이드바

### S4 Agent 공통 헤더 + Hook 템플릿 변수
- 9bb8b9c R1-api lib + API
- 14dd4b6 R1-ui AgentHeaderButton
- 6a021de R2 hook-templating 엔진 + deploy API
- e956803 R2-ui HookTemplatesDeployButton

### Docs
- 4707230 checkpoint 업데이트
- (이번 커밋) 최종 checkpoint 업데이트

## 주요 결정
1. Rules 는 Claude Code 표준 (v2.1.59+). UI 보강.
2. Commands 는 Skills 로 통합. 별도 구현 안 함.
3. EditorToolbar 살아있음 (3곳 사용).
4. fs-watcher depth: project 4, home 3.
5. Workflow: workflow_id FK + 기존 apply/subtract 재사용.
6. Agent 공통 헤더: 파일 기반 (`<proj>/.claude/_agent-header.md`) + 마커 블록.
7. Hook 템플릿 변수: .tpl 파일 → rendered .sh 배포 (실행권한 보존).

## sees 관련 진행 상황
| Pain Point | 상태 |
|-----------|------|
| 공통 헤더 중복 (208줄) | ✅ S4-R1 완료 |
| 에이전트 화이트리스트 hardcoded | ✅ S4-R2 완료 (block-leader-agent-bypass.sh.tpl 사용하면 해결) |
| Matcher 재사용 (Edit|Write|Bash 반복) | ⬜ S5-R3 |
| Bash 화이트리스트 (grep 패턴) | ⬜ S5-R4 |
| Worktree 20+ 규칙 동기화 | ⬜ S6 |
| 근거 테이블 FAIL 수동 | P2 (후순위) |

## 다음 세션 재개 가이드
1. CLAUDE.md + @imports 로드 확인
2. **MEMORY.md + SESSION-CHECKPOINT.md 순으로 읽기**
3. **브라우저 검증 먼저** (위 우선순위 A)
4. 검증 PASS 면 S5 진행, FAIL 이면 회귀 수정 우선
