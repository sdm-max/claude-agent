# 최근 세션 체크포인트

> **매 세션 종료 직전 반드시 갱신**. 새 세션 시작 시 이 파일부터 읽고 "다음 액션"부터 재개.

## 마지막 업데이트
2026-04-17 (야간) — S4-R1 (Agent 공통 헤더) api+ui 완료

## 현재 진행 Phase
S4 — Agent 공통 헤더(✅ R1 완료) + Hook 템플릿 변수(R2 미시작)

## 다음 액션 (새 세션 첫 작업)
1. **S4-R2 시작**: Hook 템플릿 변수 치환 (sees block-leader-agent-bypass.sh 일반화)
   - 신규: `src/lib/hook-templating.ts` — `{{AGENT_WHITELIST}}`, `{{READONLY_AGENTS}}`, `{{DEV_AGENTS}}` 변수
   - Hook 파일 명명 규칙: `.tpl` 확장자 = 템플릿, 저장 시 앱이 실제 스크립트 rendered 버전으로 배포
   - 에이전트 추가/삭제 이벤트 시 관련 hook 재렌더
2. **또는 브라우저 검증** 먼저:
   - S1 docs 정상 로드되는지 (새 Claude Code 세션에서 CLAUDE.md + @imports 확인)
   - S2 Skills 탭 동작 (User + Project)
   - S3 Workflows 페이지 동작 (create → activate → deactivate 플로우)
   - S4 Agent Header 버튼 동작

## 알려진 블로커
- 없음

## 미해결 이슈 (S7 정리 필요)
- docs/backlog.md 321줄 재구조화
- docs/work-report.md 74K 분할
- ARCHITECTURE.md 의 "죽은 코드" 섹션에서 EditorToolbar 제거 (S2-D1 정정)
- sees worktree 실제 개수 파악 (S6 구현 시)

## 브라우저 검증 상태
- Part A (Settings UX Phase 0): PASS
- Part B (User Settings 5탭): B-3 Rules 저장 PASS (프로젝트 scope), 나머지 미검증
- Part C, D, E, F, G: 미검증
- Part H (Skills): 신규 S2 완료, 미검증 ← **다음 세션 우선 검증**
- Part I (Workflows): 신규 S3 완료, 미검증 ← **다음 세션 우선 검증**

## 이번 세션 커밋 (시간순, 총 16개)
Phase 3 (이전 세션부터 이어서):
- c99f257 Phase 3-1 custom_templates 테이블
- d767175 Phase 3-2 하드코딩+DB 로더 통합
- 2960ee0 Phase 3-3 Custom Templates CRUD API
- faaa682 Phase 3-4 Templates 페이지 커스텀 UI
- 7d6ffe6 Phase 3-5 Save as Card

S1 (context infra):
- 85b9c37 CLAUDE.md @imports + docs 5개 + auto memory 활성화

S2 (죽은 코드 + Rules + Skills):
- 9c25b91 S2-D1 죽은 코드 2파일 삭제
- 56dafbb S2-D2 Rules 재귀+frontmatter
- b6b1f4d S2-CS Skills API (user+project)
- f5b2226 S2-CS-ui SkillEditor + 탭

S3 (Global + Workflows):
- 475fe67 S3-G Global managed 배너
- 47132b0 S3-W1 workflows 테이블+workflow_id
- fd0b2ce S3-W2 Workflows CRUD API + activate/deactivate
- ee252eb S3-W3 /workflows 페이지 + 사이드바

S4 (Agent 공통 헤더):
- 9bb8b9c S4-R1-api lib + API
- 14dd4b6 S4-R1-ui AgentHeaderButton + AgentEditor 통합

## 주요 결정/발견
1. **Rules는 Claude Code 표준** (v2.1.59+). 제거 안 함, UI 보강.
2. **Commands는 Skills로 통합**. 별도 구현 안 함.
3. **EditorToolbar는 살아있음** (3곳 사용). 첫 audit 오류.
4. **Skills 이름 스펙**: lowercase/numbers/hyphens, max 64.
5. **fs-watcher depth**: project 4, home 3 (rules/skills 하위 지원).
6. **Workflow vs Applied Templates**: workflow_id FK 추가, activate/deactivate 는 batch apply + subtract 재사용.
7. **Agent 공통 헤더**: 파일 기반 (`<proj>/.claude/_agent-header.md`) + 마커 `<!-- COMMON-HEADER:START/END -->` 블록 idempotent 관리.

## 남은 S 단계
- S4-R2: Hook 템플릿 변수 (sees block-leader-agent-bypass 일반화)
- S5: R3 Matcher preset + R4 Bash 화이트리스트 빌더
- S6: R5 Worktree 규칙 동기화
- S7: docs 정리 + 브라우저 최종 검증

## 다음 세션 재개 가이드
1. CLAUDE.md + @imports 로드 확인
2. `docs/SESSION-CHECKPOINT.md` 열어 "다음 액션" 재개
3. 권장: **브라우저 Part H/I 검증 먼저** (신규 Skills/Workflows 실제 동작 확인)
4. 검증 pass 면 S4-R2 계속, fail 이면 회귀 수정 우선
