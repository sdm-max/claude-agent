# 테스터 지시서 — 브라우저 검증 (Part A ~ I)

> 매 Part 수행 후 `docs/browser-test-issues.md` 또는 `docs/SESSION-CHECKPOINT.md` 브라우저 검증 상태에 PASS/FAIL 기록.

---

## 0. 준비

### 0-1. 환경
- Node.js, npm 설치 완료
- Claude Code v2.1.59+ (v2.1.112 권장)
- 앱 dev 서버: `npm run dev` → http://localhost:3000
- 테스트 프로젝트: claude-agent 자체 + 안전한 임시 프로젝트 (예: /tmp/test-proj) 최소 1개 등록 권장

### 0-2. 주의사항
- 위험한 scope(global/user) 테스트 는 **local scope 먼저** 확인 후
- 프로젝트 scope 테스트는 **테스트 프로젝트** 에 (claude-agent 본체 오염 주의)
- 각 Part 끝에 `git status` 로 예상치 못한 변경 확인

### 0-3. 기록
- PASS: Part 번호만 ("A PASS", "B-1 PASS")
- FAIL: Part 번호 + 증상 + 재현 경로 + 콘솔 에러 (가능하면 스크린샷)

---

## Part A — Settings UX Phase 0 (2분) ✅ 이전 PASS

이미 PASS 처리된 항목이지만 회귀 확인 위해 재검증 권장.

1. `/settings/user` → Form 모드
2. Permissions 각 필드(allow/ask/deny) 아래 **한글 설명** 표시
3. 프리셋 패널 (카테고리별 추천) 존재
4. 태그 클릭 → 상세 설명 팝오버
5. allow+deny 충돌 배너 표시
6. JSON 모드: hover 툴팁 + 인라인 설명

---

## Part B — User Settings 5탭 (3분)

1. `/settings/user` 접속
2. **탭 확인**: Settings / CLAUDE.md / Rules / Hooks / Agents / **Skills** (6탭, Skills는 S2 신규)
3. **B-1 CLAUDE.md**: 내용 수정 → Save → `cat ~/.claude/CLAUDE.md` 로 반영 확인
4. **B-2 Rules**: 
   - Rules 탭 → + New → `test-user-rule.md` 입력 → 아래 템플릿 확인 (YAML frontmatter 힌트 포함)
   - 저장 → `ls ~/.claude/rules/` 에 파일 생성 확인
   - **재귀 지원 확인**: + New → `frontend/scoped.md` 입력 → 저장 → `ls ~/.claude/rules/frontend/` 존재
5. **B-3 Hooks**: HooksUnifiedEditor 정상 렌더링
6. **B-4 Agents**: + New → 프로필 선택 → `test-agent.md` 생성 → `ls ~/.claude/agents/` 확인
7. **B-5 Skills (신규, S2)**: Part H 별도 진행

---

## Part C — Conflict Detection (3분)

1. `/settings/user` Settings 탭 → JSON 모드
2. 직접 입력:
```json
{ "permissions": { "allow": ["Bash(rm *)"], "deny": ["Bash(rm *)"] } }
```
3. Save → Form 모드 전환 → **ConflictBanner** (상단 빨간 배너) 표시
4. 배너에서 충돌 항목 식별 가능
5. 배너 텍스트 OK 확인

### C-2. 카드 간 충돌
1. `/templates?category=security` 접속
2. 여러 카드 다중 선택 (security-block-agents + security-limit-tools 등)
3. 하단 Apply Bar 에 "⚠ 충돌 N건" 배지 표시 (있다면)
4. Apply → 위험 시 confirm 다이얼로그

---

## Part D — Applied Templates + Undo (5분)

1. `/templates` → 임의 카드 1개 선택 → Apply Bar scope `local` + 테스트 프로젝트 선택 → Apply
2. 초록 "N templates applied" 토스트
3. 카드에 "✓ Applied" 배지
4. `/projects/[테스트프로젝트]` → Settings 탭 상단 AppliedTemplatesBar 에 배지
5. 배지 **X 클릭 → Undo** → settings.json 에서 정확히 해당 delta 제거 확인 (diff 비교)
6. **scope 격리**: 같은 카드를 user + local 양쪽 Apply → 각 scope 독립 표시 확인
7. **History 복원 시 invalidate**: settings 수정 Save → History 열기 → 이전 버전 Restore → 모든 Applied 배지 사라짐

---

## Part E — Selective Apply + Trace (4분)

1. `/templates` 카드 클릭 → Detail Dialog
2. 상단 "적용할 항목 선택" 체크박스 목록 (top-level 키)
3. 일부 체크 해제 → "체크 해제된 항목...제외됩니다" 안내
4. Apply → settings.json 에 체크한 키만 병합
5. AppliedTemplatesBar X → Undo 는 체크한 부분만 역 Undo
6. **Trace**: 적용된 settings 의 Form 모드 태그에 "from: 카드명" 표시 (있다면)

---

## Part F — Order Dependency Warning (2분)

1. `/templates` 에서 **스칼라 필드(model/temperature/effort 등) 값이 다른 카드 2개** 선택
2. Apply Bar 에 노란 "⚠ 순서 의존 N건" 배지 확인
3. Apply 클릭 → confirm 다이얼로그에 "순서 의존" 요약 포함

---

## Part G — Custom Templates Phase 3 (5분)

1. `/templates?category=custom` 접속
2. **사이드바에 "내 템플릿"** 카테고리 존재 (Star 아이콘)
3. **G-1 생성**:
   - "+ 새 카드" 클릭
   - 필수/선택 필드 입력 (name, nameKo, category=custom, settings JSON 유효)
   - Create → 카드 목록에 "커스텀" 노란 배지 카드 등장
4. **G-2 검증 실패 케이스**:
   - name 빈 값 → "name 은 필수" 에러
   - settings 불완전 JSON → "JSON 파싱 실패" 에러
5. **G-3 편집**: 연필 아이콘 → name/nameKo 변경 → Save → 카드 업데이트 (settings 는 수정 안 됨 — 의도된 동작)
6. **G-4 삭제**: 휴지통 아이콘 → Confirm Dialog → Delete → 카드 사라짐
7. **G-5 Save as Card**: `/settings/user` Settings 탭 → "Save as Card" 버튼 → 다이얼로그 → 이름 입력 → 체크리스트에서 일부 키 해제 → Save → `/templates?category=custom` 에 새 카드 존재 + 해제된 키 누락 확인
8. **G-6 Project scope Save as Card**: `/projects/[id]` Settings 탭에 동일 버튼, merged scope 선택 시 버튼 숨김

---

## Part H — Skills (신규, S2) (5분)

1. `/settings/user` → **Skills 탭** 클릭
2. 좌측 "No skills yet" 메시지 + "+ New" 버튼
3. **H-1 생성**:
   - New → 이름 입력 `test-skill` (lowercase/숫자/하이픈만)
   - Create → 자동 템플릿(YAML frontmatter + "When to use" + "Steps") 로 SKILL.md 생성
   - `ls ~/.claude/skills/test-skill/SKILL.md` 로 파일 확인
4. **H-2 검증**:
   - 대문자 `Test-Skill` → "lowercase/numbers/hyphens" 에러
   - 64자 초과 → 에러
5. **H-3 편집**:
   - SKILL.md 편집기 (markdown) 에서 내용 수정 → Save → 디스크 반영
6. **H-4 삭제**:
   - 휴지통 아이콘 → Confirm → 디렉토리 전체 삭제
7. **H-5 Project scope**: `/projects/[id]` → Skills 탭 → 위와 동일 플로우
   - `<proj>/.claude/skills/<name>/SKILL.md` 생성 확인
8. **H-6 Claude Code 실로드 (별도 세션)**:
   - 다른 Claude Code 세션에서 프로젝트 진입
   - `/test-skill` 입력 → 스킬 호출 되는지
   - 또는 `/memory` 명령으로 skill 인식 확인

---

## Part I — Workflows (신규, S3) (6분)

1. 사이드바 "Workflows" 섹션 → "내 워크플로" 링크 → `/workflows`
2. **I-1 생성**:
   - "+ 새 워크플로" 버튼
   - name: `frontend-dev-kit`, nameKo: `프론트엔드 개발`, scope: `local`, project 선택
   - items JSON:
     ```json
     [{ "templateId": "security-basic" }, { "templateId": "perm-frontend-dev" }]
     ```
     (실제 존재하는 templateId 로 조정)
   - Create → 카드 목록에 추가
3. **I-2 Activate**:
   - 카드의 "Activate" 버튼 클릭 → 초록 테두리 + "✓ Active (N)" 배지
   - `/projects/[id]` Settings 탭 → AppliedTemplatesBar 에 해당 템플릿들 배지
   - settings.json 에 merge 확인
4. **I-3 Deactivate**:
   - 같은 카드 "Deactivate" → 초록 테두리 해제
   - AppliedTemplatesBar 배지 사라짐
   - settings.json 에서 delta subtract 정확히 실행 (수동 편집 보존)
5. **I-4 sharedWithOther**:
   - 같은 templateId 를 다른 workflow 에도 포함
   - 두 workflow 모두 activate → settings.json 에 한 번만 반영
   - 하나만 deactivate → 다른 workflow 의 템플릿은 유지 확인
6. **I-5 Delete**:
   - Active 상태 → Delete 버튼 disabled
   - Deactivate 후 → Delete Confirm → 카드 사라짐

---

## Part J — S4-R1 Agent 공통 헤더 (4분)

1. `/projects/[id]` → **Agents 탭** 접속
2. 좌측 상단에 "Header" 버튼 (New 옆)
3. **J-1 Save**:
   - Header 클릭 → 다이얼로그
   - Textarea 에 공통 헤더 입력 (예: sees governance 규칙 13줄)
   - "Save Header" → `<proj>/.claude/_agent-header.md` 생성 확인
4. **J-2 Apply to All**:
   - 기존 에이전트 2~3개 있는 상태에서
   - "Apply to All" 클릭 → 결과 "주입 완료: N/M 파일"
   - 각 에이전트 파일 열어서 YAML frontmatter 뒤에 `<!-- COMMON-HEADER:START -->` 블록 주입 확인
5. **J-3 재적용 (idempotent)**:
   - 헤더 내용 변경 → Save → Apply to All 다시
   - 기존 블록이 **교체** 되었는지 (중복 없음) 확인
6. **J-4 Strip from All**:
   - "Strip from All" → 모든 에이전트에서 헤더 블록 제거

---

## Part K — S4-R2 Hook Templates Deploy (3분)

1. `/projects/[id]` Agents 탭 → "Deploy Hooks" 버튼 (Header 옆)
2. 다이얼로그:
   - **현재 변수** 섹션: `{{AGENT_WHITELIST}}`, `{{AGENT_COUNT}}`, `{{DATE}}`, `{{PROJECT_NAME}}` 값 프리뷰
   - **Templates (N개)** 섹션: `.claude/hooks/*.tpl` 파일 목록
3. **K-1 템플릿 없을 때**: 예시 코드 안내 표시 (block-leader-agent-bypass.sh.tpl 스니펫)
4. **K-2 테스트 템플릿 생성** (터미널):
   ```bash
   cat > <proj>/.claude/hooks/block-leader-agent-bypass.sh.tpl <<EOF
   #!/bin/bash
   ALLOWED="{{AGENT_WHITELIST}}"
   # Count: {{AGENT_COUNT}}
   # Generated: {{DATE}}
   INPUT=$(cat)
   echo "Project: {{PROJECT_NAME}}"
   EOF
   ```
5. **K-3 Deploy**:
   - 다이얼로그 새로고침 (Close → 다시 열기) → Templates 1개 표시
   - Deploy 버튼 → 결과 "배포 완료: 1/1"
   - `cat <proj>/.claude/hooks/block-leader-agent-bypass.sh` → 변수 모두 치환됨 확인
6. **K-4 실행 권한**: `ls -la` 로 새 .sh 에 실행 비트(+x) 설정됨 확인

---

## Part L — S5-R3 Matcher Presets API (1분)

1. 브라우저 또는 curl:
   ```bash
   curl -s http://localhost:3000/api/hook-presets | jq
   ```
2. 응답 구조 확인:
   - `presets`: 8개 (write-triad, bash-only, read-only, agents, team-ops, any, webfetch, write-triad-bash)
   - `events`: 17개 (UserPromptSubmit, PreToolUse, PostToolUse...)

---

## Part M — 회귀 체크 (마무리, 3분)

1. **콘솔 에러 없음**: DevTools 열고 각 페이지 네비게이션 — 콘솔 에러 0 개 확인
2. **TSC**: 터미널 `npx tsc --noEmit` → exit 0
3. **사이드바 링크** 전부 동작:
   - Settings (Global, User)
   - Templates 13개 카테고리
   - Workflows (내 워크플로)
   - Projects 동적 목록 + + New
4. **SSE 동기화 확인**: 터미널에서 `~/.claude/CLAUDE.md` 수정 → 브라우저 User Settings CLAUDE.md 탭 자동 갱신
5. **기존 기능**: Phase 2 Apply/Undo/Trace, Phase 3 Custom Templates 모두 정상

---

## Part N — Context Infra 검증 (새 Claude Code 세션, 3분)

1. 새 터미널 → `cd /Users/min/Documents/claude-agent && claude`
2. 세션 시작 시 CLAUDE.md 자동 로드 (Claude 가 인지 확인)
3. `/memory` 명령:
   - CLAUDE.md 표시됨
   - `@docs/PROJECT.md`, `@docs/ARCHITECTURE.md`, `@docs/SESSION-CHECKPOINT.md` 로드됨
   - MEMORY.md 자동 로드됨
4. "이 프로젝트 지금까지 뭐 했어?" 물어보기 → SESSION-CHECKPOINT 기반 답변 가능

---

## 보고 템플릿

각 Part 끝나면 아래 형식으로 기록:

```
Part A: PASS
Part B-1: PASS
Part B-2: FAIL — Rules 저장 후 `~/.claude/rules/` 에 파일 없음
    재현: /settings/user → Rules → + New → test.md → Save
    콘솔: TypeError at line 123...
...
```

---

## FAIL 처리 워크플로우

1. Part 번호 + 증상 + 재현 경로 + 콘솔 에러 메모
2. `docs/browser-test-issues.md` 에 추가
3. `docs/SESSION-CHECKPOINT.md` 브라우저 검증 상태 업데이트
4. 수정 필요 시: 새 커밋으로 회귀 수정 후 재검증
