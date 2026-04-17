# 브라우저 검증 지시서 (Part A ~ I)

새 세션에서 UI 테스트할 때 이 파일을 기준으로 체크리스트 진행. PASS/FAIL 을 SESSION-CHECKPOINT 에 기록.

## 준비
- dev 서버 실행: `npm run dev` → http://localhost:3000
- 테스트 프로젝트 1개 이상 등록
- 위험한 스코프(user/global) 테스트는 local scope 먼저
- 프로젝트 테스트는 claude-agent 자체 또는 /tmp/test-proj 등 안전한 대상

## Part A: Settings UX Phase 0 (~2분)
- Form 모드: 각 필드 아래 한글 설명 표시
- "+ Add" 옆 프리셋 패널 (카테고리별)
- 태그 클릭 → 상세 설명
- allow `Bash(rm *)` + deny 동시 추가 → 충돌 배너
- JSON 모드: 키 hover 툴팁 + 인라인 설명

## Part B: User Settings 5탭 (~5분)
- **B-1** 5탭 존재 (Settings/CLAUDE.md/Rules/Hooks/Agents)
- **B-2** CLAUDE.md 저장 → `cat ~/.claude/CLAUDE.md` 확인
- **B-3** Rules 생성 (user scope: `~/.claude/rules/`)
- **B-4** Agents 생성 (`~/.claude/agents/`)
- **B-5** Hooks 편집

## Part C: Conflict Detection (~5분)
- ConflictBanner: `permissions.allow` vs `deny` 동시 추가
- 카드 간 충돌: 여러 카드 선택 시 "충돌 N건" 배지
- Apply confirm dialog

## Part D: Applied Templates + Undo (~6분)
- **D-1** Apply → AppliedTemplatesBar 배지 표시
- **D-2** Undo X 버튼 → delta subtract (수동 편집 보존)
- **D-3** scope 격리 (user / local 독립)
- **D-4** History 복원 → invalidate 호출

## Part E: Selective Apply + Trace (~6분)
- **E-1** Detail Dialog 체크리스트 → 선택 항목만 apply
- **E-2** 설정 출처 표시 (태그 옆 "from: 카드명")
- **E-3** dialogApply scope 분리

## Part F: Order Dependency Warning (~2분)
- 스칼라 필드 차이 있는 카드 2개 선택 → 순서 의존 배지

## Part G: Custom Templates (~8분)
- 내 템플릿 카테고리
- 새 카드 생성 (검증 포함)
- 편집
- 삭제
- Save as Card 플로우 (user scope)
- Project scope Save as Card

## Part H: Skills (신규, S2 완료 후)
- Skills 탭 존재 (User / Project)
- SKILL.md 생성 (frontmatter + body)
- 부속 파일 추가
- 새 Claude Code 세션에서 `/skill-name` 호출 확인

## Part I: Workflow 그룹핑 (신규, S3 완료 후)
- /workflows 페이지
- 워크플로 생성 (카드 N개 선택)
- 활성화 → batch apply 기록
- 비활성화 → 전부 Undo (sharedWithOther 보존 확인)

---

## 회귀 체크 (매 커밋마다)
- TSC exit 0
- 기존 Templates Apply/Undo/Trace 정상
- 기존 Custom Templates CRUD 정상
- 사이드바 링크 전부 동작
