# Claude Code Settings Manager — 앱 개요

## 앱 목적
사용자(개발자)가 여러 프로젝트에서 Claude Code 설정(settings.json, CLAUDE.md, agents, rules, hooks, skills)을 **웹 UI로 통합 관리**하는 도구.

## 타겟 사용자
- **Primary**: sees 프로젝트처럼 **대규모 Claude Code 거버넌스**를 운영하는 개인/팀
- 특징: 수십 개 에이전트 + 수십 개 rules + 수 개 hooks + git worktrees 다수 보유
- 관리 부담: 에이전트 공통 헤더 중복, hook hardcoding, worktree 규칙 동기화 pain 경험

## 핵심 가치 (sees 기반)
1. **에이전트 공통 헤더 일괄 관리** — 16개 에이전트에 같은 13줄 붙여넣기 중복 해소
2. **Hook 템플릿 변수** — `block-leader-agent-bypass.sh` 의 에이전트 화이트리스트 자동 동기화
3. **Worktree 규칙 동기화** — 20+ worktree 간 마스터 규칙 diff + 선택 적용
4. **Bash 화이트리스트 빌더** — 복잡한 grep 패턴을 시각화
5. **Workflow 그룹핑** — 여러 template/hook을 "기획" 단위로 묶어 활성화/비활성화

## Claude Code 표준 정합성
- `~/.claude/CLAUDE.md` + `<proj>/CLAUDE.md` + `.claude/CLAUDE.md` + `CLAUDE.local.md`: 표준 자동 로드
- `.claude/rules/*.md` (paths frontmatter, 재귀): 표준 v2.1.59+
- `.claude/agents/*.md`: 표준 subagents
- `.claude/skills/<name>/SKILL.md`: 표준 (commands와 통합됨)
- `settings.json.hooks`: 표준 17 이벤트
- Auto memory (`~/.claude/projects/<project>/memory/`): 표준 v2.1.59+

## 기술 스택
- Next.js 16 App Router + TypeScript
- Drizzle ORM + SQLite WAL (better-sqlite3)
- shadcn/ui (base-ui v1.3.0)
- CodeMirror 6
- chokidar (fs-watcher) + SSE

## 현재 버전
- Claude Code 2.1.112 (auto memory 지원)
- Next.js 16
- DB 마이그레이션 0000~0004 (5개 적용)
