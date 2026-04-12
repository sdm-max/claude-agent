# Claude Code 하네스 설정 매트릭스 가이드

## 설정 계층 구조 (우선순위: 위 → 아래)

```
Managed (최상위, 조직 강제)
  ↓
CLI 인자 (세션 임시)
  ↓
.claude/settings.local.json (개인, gitignore)
  ↓
.claude/settings.json (팀 공유, git 커밋)
  ↓
~/.claude/settings.json (글로벌 기본값)
```

| 파일 | 위치 | 공유 | 용도 |
|------|------|------|------|
| `~/.claude/settings.json` | 홈 | X | 모든 프로젝트 기본값 |
| `.claude/settings.json` | 프로젝트 | O | 팀 공유 설정 |
| `.claude/settings.local.json` | 프로젝트 | X | 개인 오버라이드 |
| `CLAUDE.md` | 프로젝트 | O | 프로젝트 컨텍스트/메모리 |
| `.mcp.json` | 프로젝트 | O | MCP 서버 설정 |

---

## 8대 에이전트 역할 매트릭스

| # | 에이전트 | 담당 영역 | 산출물 |
|---|---------|----------|--------|
| 1 | **Security Guard** | 권한/deny 규칙, 시크릿 보호 | permissions 설정 |
| 2 | **Hook Engineer** | 6대 훅 이벤트 자동화 | hooks 설정 + 스크립트 |
| 3 | **Skill Architect** | 스킬/커맨드 구성 | .claude/skills/ 파일 |
| 4 | **MCP Integrator** | 외부 도구 연동 | .mcp.json |
| 5 | **CLAUDE.md Writer** | 프로젝트 메모리 설계 | CLAUDE.md |
| 6 | **CI/CD Automator** | GitHub Actions 워크플로우 | .github/workflows/ |
| 7 | **Agent Designer** | 서브에이전트 설계 | .claude/agents/ |
| 8 | **Config Optimizer** | 성능/환경 최적화 | env, model, worktree 설정 |

---

## 1. Security Guard — 권한 매트릭스

### 기본 permissions 설정

```json
{
  "permissions": {
    "allow": [
      "Edit(*)",
      "Write(*.md)",
      "Bash(npm run *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Read(*)"
    ],
    "deny": [
      "Read(.env)",
      "Read(.env.*)",
      "Read(./secrets/**)",
      "Bash(curl *)",
      "Bash(wget *)"
    ]
  }
}
```

### Trail of Bits 스타일 강화 deny

```json
{
  "permissions": {
    "deny": [
      "Read(~/.ssh/**)",
      "Read(~/.gnupg/**)",
      "Read(~/.aws/**)",
      "Read(~/.azure/**)",
      "Read(~/.kube/**)",
      "Read(~/.docker/config.json)",
      "Read(~/.npmrc)",
      "Read(~/.pypirc)",
      "Read(~/.git-credentials)",
      "Read(~/.config/gh/**)",
      "Edit(~/.bashrc)",
      "Edit(~/.zshrc)"
    ]
  }
}
```

---

## 2. Hook Engineer — 6대 훅 매트릭스

### 훅 이벤트 요약

| 이벤트 | 시점 | 차단 가능 | 용도 |
|--------|------|----------|------|
| `SessionStart` | 세션 시작 | X | 환경 초기화 |
| `UserPromptSubmit` | 프롬프트 제출 전 | O | 입력 검증 |
| `PreToolUse` | 도구 실행 전 | O | 위험 명령 차단 |
| `PostToolUse` | 도구 실행 후 | X | 자동 포맷/린트 |
| `Stop` | 응답 완료 시 | O | 미완료 작업 체크 |
| `SessionEnd` | 세션 종료 | X | 정리/로깅 |

### PreToolUse — main 브랜치 편집 차단

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "[ \"$(git branch --show-current 2>/dev/null)\" != \"main\" ] || { echo '{\"block\": true, \"message\": \"main 브랜치 직접 편집 금지\"}' >&2; exit 2; }",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

### PreToolUse — rm -rf 차단

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo $(cat) | jq -r '.tool_input.command' | grep -qE 'rm\\s+(-[a-zA-Z]*r|-[a-zA-Z]*r)' && echo 'rm -rf 사용 금지' >&2 && exit 2 || exit 0",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

### PostToolUse — 자동 린트

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/auto-lint.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### Stop — 미커밋 변경사항 체크

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/stop-hook-git-check.sh"
          }
        ]
      }
    ]
  }
}
```

---

## 3. Skill Architect — 스킬 구조

스킬 파일 위치: `.claude/skills/<name>/SKILL.md`

```markdown
---
name: testing-patterns
description: 테스트 작성 시 사용. Jest, Vitest 패턴.
---

# 테스트 패턴

## 구조
- describe 블록으로 그룹핑
- it 블록으로 개별 테스트
- AAA: Arrange → Act → Assert

## 모킹
- 외부 의존성만 모킹
- 팩토리 함수: getMockUser(overrides)
```

---

## 4. MCP Integrator — 외부 도구 연동

### `.mcp.json` 예시

```json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    },
    "slack": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}",
        "SLACK_TEAM_ID": "${SLACK_TEAM_ID}"
      }
    },
    "postgres": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-postgres"],
      "env": { "DATABASE_URL": "${DATABASE_URL}" }
    },
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-context7"]
    }
  }
}
```

---

## 5. CLAUDE.md Writer — 템플릿

```markdown
# 프로젝트명

## 스택
- Frontend: Next.js 15, React 19, TypeScript
- Backend: Node.js, Prisma
- DB: PostgreSQL

## 핵심 명령어
- `npm run dev` — 개발 서버
- `npm run test` — 테스트
- `npm run lint` — 린트
- `npm run build` — 빌드

## 디렉토리 구조
- `src/app/` — 페이지 라우트
- `src/components/` — UI 컴포넌트
- `src/lib/` — 유틸리티
- `prisma/` — DB 스키마

## 규칙
- 함수는 50줄 이하
- 컴포넌트는 단일 책임
- API 응답은 항상 타입 정의
- 커밋 전 반드시 테스트 통과
```

---

## 6. CI/CD Automator — GitHub Actions

### `.github/workflows/pr-review.yml`

```yaml
name: Claude Code PR Review
on:
  pull_request:
    types: [opened, synchronize]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Claude Review
        run: |
          npx @anthropic-ai/claude-code -p \
            "이 PR의 변경사항을 리뷰해줘. 보안, 성능, 코드 품질 관점에서."
```

---

## 7. Agent Designer — 서브에이전트

### `.claude/agents/code-reviewer.md`

```markdown
---
name: code-reviewer
description: 코드 리뷰 전문 에이전트
model: sonnet
tools:
  - Read
  - Glob
  - Grep
---

# 코드 리뷰어

4가지 관점으로 리뷰:
1. **보안** — 인젝션, 인증, 시크릿 노출
2. **성능** — N+1 쿼리, 메모리 누수
3. **품질** — 네이밍, 복잡도, 테스트 가능성
4. **접근성** — 키보드 네비게이션, ARIA
```

---

## 8. Config Optimizer — 성능/환경 최적화

```json
{
  "env": {
    "DISABLE_TELEMETRY": "1",
    "DISABLE_ERROR_REPORTING": "1"
  },
  "model": "sonnet",
  "alwaysThinkingEnabled": true,
  "cleanupPeriodDays": 30,
  "autoUpdatesChannel": "stable"
}
```

---

## 적용 난이도 매트릭스

| 설정 | 난이도 | 소요시간 | 효과 |
|------|--------|---------|------|
| permissions deny 규칙 | ★☆☆ | 1분 | 시크릿 보호 |
| CLAUDE.md 작성 | ★☆☆ | 5분 | 컨텍스트 품질 향상 |
| Stop 훅 (git check) | ★★☆ | 3분 | 자동 커밋/푸시 보장 |
| PreToolUse 차단 훅 | ★★☆ | 3분 | 위험 작업 방지 |
| PostToolUse 린트 훅 | ★★☆ | 5분 | 코드 품질 자동화 |
| MCP 서버 연동 | ★★☆ | 5분 | 외부 도구 통합 |
| 스킬 작성 | ★★★ | 10분 | 도메인 지식 주입 |
| CI/CD 워크플로우 | ★★★ | 15분 | 자동 리뷰/감사 |
| 서브에이전트 설계 | ★★★ | 10분 | 전문 역할 분리 |

---

## 빠른 시작 순서

```
1단계: ~/.claude/settings.json 글로벌 설정 (복붙)
2단계: CLAUDE.md 프로젝트 메모리 작성
3단계: .claude/settings.json 프로젝트 훅 설정 (복붙)
4단계: .mcp.json MCP 서버 연동 (필요시)
5단계: .claude/skills/ 스킬 추가 (필요시)
6단계: .claude/agents/ 서브에이전트 (필요시)
```

---

## 참조 GitHub 프로젝트

| 프로젝트 | 특징 |
|---------|------|
| claude-code-harness | Plan→Work→Review 사이클, 13개 가드레일 |
| claude-code-showcase | 훅/스킬/에이전트/커맨드/CI 종합 예시 |
| everything-claude-code | 156스킬, 38에이전트, 12언어 |
| claude-code-config | Trail of Bits 보안 중심 설정 |
| claude-code-hooks-mastery | 13개 훅 이벤트 실전 예제 |
| claude-code-best-practice | 설정 베스트 프랙티스 |
