# Claude Code Settings Manager

@docs/PROJECT.md
@docs/ARCHITECTURE.md
@docs/SESSION-CHECKPOINT.md

## 새 세션 시작 체크리스트 (필수)
1. 위 @imports 가 전부 로드됐는지 확인
2. auto memory MEMORY.md 가 로드됐는지 (첫 200줄)
3. `git log -10` 최근 커밋 확인
4. `docs/SESSION-CHECKPOINT.md` 의 "다음 액션" 부터 재개
5. TaskList 로 진행중 task 확인

## 절대 규칙

### 작업 완료 원칙
- 지시받은 작업은 끝까지 완료한 후 보고해라. 중간에 멈추지 마라
- "할까요?", "진행할까요?", "구현할까요?" 같은 확인 질문 금지. 지시받은 것은 바로 실행해라
- 미구현 목록을 나열했으면 바로 전부 구현해라. 목록만 보여주고 끝내지 마라
- 부분 완성 후 "나머지 할까요?" 금지. 전체를 한번에 완료해라

### 보고 원칙
- 작업 완료 후 마스터 체크리스트를 증거와 함께 보고해라
- 증거 = API 테스트 결과, TypeScript 빌드 결과, 실제 동작 확인
- 증거 없는 "완료" 보고 금지

### Phase별 작업 원칙
- **Phase별 커밋 분리** (번들링 금지). 커밋 메시지는 `feat/refactor(scope): SN-X — 설명` 형식
- **매 Phase 완료 시** `docs/SESSION-CHECKPOINT.md` 갱신 + 커밋
- **세션 종료 직전** `docs/worklog/session-YYYY-MM-DD.md` 작성 + MEMORY.md 업데이트

### 작업내역서 필수 항목
작업내역서 작성 시 아래 항목을 전부 포함:
- [ ] 프로젝트 개요 + 기술 스택
- [ ] DB 스키마 (테이블별 컬럼 명세)
- [ ] API 엔드포인트 전체 목록 (Method, Path, 설명)
- [ ] 페이지 구성 (URL별 기능 설명)
- [ ] UI 컴포넌트 목록 (파일명, 용도, props)
- [ ] 파일 구조 트리
- [ ] 구현 기능 상세 (기능별 동작 설명)
- [ ] 보안/에러 처리 내역
- [ ] 발견/수정한 버그 목록
- [ ] 테스트 결과 (증거)
- [ ] 설치한 패키지 목록
- [ ] git 변경 파일 목록 (신규/수정/삭제)
- [ ] 설정값/템플릿/상수 정의 내용
- [ ] 데이터 흐름 설명 (Import/Export/Save 경로)
- [ ] 빠진 항목 스스로 점검 후 보완

### 코드 작업 원칙
- 코드를 읽기만 하고 끝내지 마라. 읽었으면 수정까지 해라
- 에이전트 모드 사용 시 구현 에이전트 완료 후 바로 QA/수정까지 한 사이클로 끝내라
- 파일 하나 수정하고 보고하지 마라. 관련 파일 전부 수정 후 보고해라

### 금지 행동
- 과도한 분석/확인 후 "이제 구현할까요?" 패턴 금지
- 같은 파일 반복 읽기 금지. 한번 읽고 기억해라
- 플랜 모드에서 불필요하게 오래 머물지 마라

## 기술 스택
- Next.js 16 App Router + TypeScript
- Drizzle ORM + SQLite (better-sqlite3, WAL)
- shadcn/ui (base-ui v1.3.0)
- CodeMirror 6
- chokidar + SSE

## Claude Code 버전 요구사항
- Claude Code v2.1.59+ (auto memory + `.claude/rules/` paths frontmatter)
- 현재 확인: 2.1.112 ✓
