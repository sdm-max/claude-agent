# 최근 세션 체크포인트

> **매 세션 종료 직전 반드시 갱신**. 새 세션 시작 시 이 파일부터 읽고 "다음 액션"부터 재개.

## 마지막 업데이트
2026-04-17 — S2 (죽은 코드 + Rules + Skills) 완료

## 현재 진행 Phase
S3 — Global 페이지 + Workflow 그룹핑 (진행중)

## 다음 액션
1. G1: /settings/global 에 CLAUDE.md 탭 추가 (managed policy 경로)
2. G2: Global Settings 페이지에 managed scope 안내 배너
3. W1: drizzle/0005_workflows.sql 마이그레이션 + applied_templates.workflow_id 추가
4. W2: /api/workflows/* CRUD + activate/deactivate
5. W3: /workflows 페이지 + Templates 페이지 "워크플로로 저장" 버튼

## 알려진 블로커
- 없음

## 미해결 이슈
- docs/backlog.md 321줄 재구조화 (S7 에서)
- docs/work-report.md 74K 분할 (S7 에서)
- sees worktree 실제 개수 (S6 에서 파악)

## 브라우저 검증 상태
- Part A (Settings UX Phase 0): **PASS** (사용자)
- Part B (User Settings 5탭): **WIP**
- Part C, D, E, F: 미검증
- Part G (Custom Templates Phase 3): 미검증
- Part H (Skills, 신규): 미검증 ← S2 완료 후 검증 가능
- Part I (Workflows): 미구현

## 이번 세션 주요 커밋 (시간순)
- c99f257 Phase 3-1 custom_templates 테이블
- d767175 Phase 3-2 하드코딩 + DB 커스텀 로더 통합
- 2960ee0 Phase 3-3 Custom Templates CRUD API
- faaa682 Phase 3-4 Templates 페이지 커스텀 UI
- 7d6ffe6 Phase 3-5 Save as Card 플로우
- 85b9c37 S1 context infra 기초
- 9c25b91 S2-D1 죽은 코드 2파일 삭제
- 56dafbb S2-D2 Rules 하위 디렉토리 + frontmatter
- b6b1f4d S2-CS Skills API (user + project)
- f5b2226 S2-CS-ui SkillEditor + Skills 탭 + hook 타입 확장

## 주요 결정사항
- **Rules는 Claude Code 표준** (v2.1.59+). UI 보강 방향.
- **Commands는 Skills로 통합**. 별도 구현 안 함.
- **EditorToolbar는 살아있음** (3곳에서 import). ARCHITECTURE.md 죽은 코드 목록에서 제외 필요 (S7 정정).
- **Skill 이름 스펙**: lowercase/numbers/hyphens, max 64 chars
- **fs-watcher depth**: project 4, home 3 (rules + skills 하위 디렉토리 지원)

## 다음 세션 재개 가이드
1. CLAUDE.md + @imports 로드 확인
2. `docs/SESSION-CHECKPOINT.md` 열어 "다음 액션" 재개
3. S3 G1 부터: /settings/global 페이지에 CLAUDE.md 탭 추가
