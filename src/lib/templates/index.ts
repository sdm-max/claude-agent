import type { ClaudeSettings } from "@/lib/settings-schema";

export interface Template {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  category: "security" | "hooks" | "skills" | "mcp" | "claude-md" | "cicd" | "agents" | "optimization";
  difficulty: 1 | 2 | 3;
  scope: "global" | "project" | "both";
  tags: string[];
  settings: ClaudeSettings;
  extraFiles?: TemplateFile[];
}

export interface TemplateFile {
  path: string;
  content: string;
  description: string;
}

export const templates: Template[] = [
  // ─── 1. Security Guard ───
  {
    id: "security-basic",
    name: "Security Guard — Basic Permissions",
    nameKo: "Security Guard — 기본 권한",
    description: "Essential allow/deny rules for safe Claude Code usage. Protects secrets and restricts dangerous commands.",
    descriptionKo: "안전한 Claude Code 사용을 위한 기본 allow/deny 규칙. 시크릿 보호 및 위험 명령 제한.",
    category: "security",
    difficulty: 1,
    scope: "project",
    tags: ["permissions.allow ×9", "permissions.deny ×5", ".env 차단", "curl/wget 차단"],
    settings: {
      permissions: {
        allow: [
          "Edit(*)",
          "Write(*.md)",
          "Bash(npm run *)",
          "Bash(git status)",
          "Bash(git diff *)",
          "Bash(git log *)",
          "Bash(git add *)",
          "Bash(git commit *)",
          "Read(*)",
        ],
        deny: [
          "Read(.env)",
          "Read(.env.*)",
          "Read(./secrets/**)",
          "Bash(curl *)",
          "Bash(wget *)",
        ],
      },
    },
  },
  {
    id: "security-hardened",
    name: "Security Guard — Hardened (Trail of Bits)",
    nameKo: "Security Guard — 강화 보안 (Trail of Bits)",
    description: "Advanced deny rules blocking access to SSH keys, cloud credentials, package manager tokens, and shell configs.",
    descriptionKo: "SSH 키, 클라우드 인증정보, 패키지 매니저 토큰, 셸 설정 접근 차단 강화 규칙.",
    category: "security",
    difficulty: 1,
    scope: "global",
    tags: ["permissions.deny ×12", "~/.ssh", "~/.aws", "~/.gnupg", "~/.docker", "~/.npmrc", ".bashrc/.zshrc 편집 차단"],
    settings: {
      permissions: {
        allow: ["Skill"],
        deny: [
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
          "Edit(~/.zshrc)",
        ],
      },
    },
  },

  // ─── 2. Hook Engineer ───
  {
    id: "hooks-main-protection",
    name: "Hook Engineer — Main Branch Protection",
    nameKo: "Hook Engineer — main 브랜치 보호",
    description: "PreToolUse hook that blocks Edit/Write operations when on the main branch.",
    descriptionKo: "main 브랜치에서 Edit/Write 작업을 차단하는 PreToolUse 훅.",
    category: "hooks",
    difficulty: 2,
    scope: "project",
    tags: ["hooks.PreToolUse", "matcher: Edit|Write", "main 브랜치 차단", "exit 2 block"],
    settings: {
      hooks: {
        PreToolUse: [
          {
            matcher: "Edit|Write",
            hooks: [
              {
                type: "command",
                command:
                  '[ "$(git branch --show-current 2>/dev/null)" != "main" ] || { echo \'{"block": true, "message": "main 브랜치 직접 편집 금지"}\' >&2; exit 2; }',
                timeout: 5,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "hooks-rm-protection",
    name: "Hook Engineer — rm -rf Protection",
    nameKo: "Hook Engineer — rm -rf 차단",
    description: "PreToolUse hook that blocks recursive rm commands to prevent accidental deletions.",
    descriptionKo: "실수로 인한 삭제를 방지하기 위해 재귀적 rm 명령을 차단하는 PreToolUse 훅.",
    category: "hooks",
    difficulty: 2,
    scope: "project",
    tags: ["hooks.PreToolUse", "matcher: Bash", "rm -r 패턴 감지", "jq 파싱"],
    settings: {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command:
                  "echo $(cat) | jq -r '.tool_input.command' | grep -qE 'rm\\s+(-[a-zA-Z]*r|-[a-zA-Z]*r)' && echo 'rm -rf 사용 금지' >&2 && exit 2 || exit 0",
                timeout: 5,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "hooks-auto-lint",
    name: "Hook Engineer — Auto Lint on Save",
    nameKo: "Hook Engineer — 자동 린트",
    description: "PostToolUse hook that runs auto-lint after Write/Edit operations.",
    descriptionKo: "Write/Edit 작업 후 자동으로 린트를 실행하는 PostToolUse 훅.",
    category: "hooks",
    difficulty: 2,
    scope: "project",
    tags: ["hooks.PostToolUse", "matcher: Write|Edit", "auto-lint.sh 스크립트", "eslint/ruff/gofmt"],
    settings: {
      hooks: {
        PostToolUse: [
          {
            matcher: "Write|Edit",
            hooks: [
              {
                type: "command",
                command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/auto-lint.sh',
                timeout: 30,
              },
            ],
          },
        ],
      },
    },
    extraFiles: [
      {
        path: ".claude/hooks/auto-lint.sh",
        content: `#!/bin/bash
set -euo pipefail

# Auto-lint hook for PostToolUse
# Runs appropriate linter based on file extension

FILE="\${TOOL_OUTPUT_FILE:-}"
if [ -z "$FILE" ]; then exit 0; fi

EXT="\${FILE##*.}"

case "$EXT" in
  ts|tsx|js|jsx)
    if command -v npx &>/dev/null; then
      npx eslint --fix "$FILE" 2>/dev/null || true
    fi
    ;;
  py)
    if command -v ruff &>/dev/null; then
      ruff format "$FILE" 2>/dev/null || true
    elif command -v black &>/dev/null; then
      black "$FILE" 2>/dev/null || true
    fi
    ;;
  go)
    if command -v gofmt &>/dev/null; then
      gofmt -w "$FILE" 2>/dev/null || true
    fi
    ;;
esac
`,
        description: "Auto-lint script that runs after file edits",
      },
    ],
  },
  {
    id: "hooks-git-check",
    name: "Hook Engineer — Uncommitted Changes Check",
    nameKo: "Hook Engineer — 미커밋 변경사항 체크",
    description: "Stop hook that warns when there are uncommitted changes after Claude finishes work.",
    descriptionKo: "Claude 작업 완료 후 미커밋 변경사항이 있으면 경고하는 Stop 훅.",
    category: "hooks",
    difficulty: 2,
    scope: "global",
    tags: ["hooks.Stop", "git status 체크", "stop-hook-git-check.sh", "미커밋 경고"],
    settings: {
      hooks: {
        Stop: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command: "~/.claude/stop-hook-git-check.sh",
              },
            ],
          },
        ],
      },
    },
    extraFiles: [
      {
        path: "~/.claude/stop-hook-git-check.sh",
        content: `#!/bin/bash
set -euo pipefail

# Stop hook: check for uncommitted changes
# Place at ~/.claude/stop-hook-git-check.sh

if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  exit 0
fi

CHANGES=$(git status --porcelain 2>/dev/null | head -20)
if [ -n "$CHANGES" ]; then
  COUNT=$(echo "$CHANGES" | wc -l | tr -d ' ')
  echo "WARNING: $COUNT uncommitted changes detected:" >&2
  echo "$CHANGES" >&2
  echo "" >&2
  echo "Consider committing or stashing before ending the session." >&2
fi
`,
        description: "Stop hook script for uncommitted changes detection",
      },
    ],
  },

  // ─── 3. Skill Architect ───
  {
    id: "skill-testing",
    name: "Skill Architect — Testing Patterns",
    nameKo: "Skill Architect — 테스트 패턴",
    description: "Skill file for standardized testing patterns with Jest/Vitest.",
    descriptionKo: "Jest/Vitest 표준 테스트 패턴을 위한 스킬 파일.",
    category: "skills",
    difficulty: 3,
    scope: "project",
    tags: [".claude/skills/", "SKILL.md", "AAA 패턴", "Jest/Vitest", "모킹 규칙"],
    settings: {},
    extraFiles: [
      {
        path: ".claude/skills/testing-patterns/SKILL.md",
        content: `---
name: testing-patterns
description: Testing patterns and conventions for Jest/Vitest
---

# Testing Patterns

## Structure
- Use \`describe\` blocks for grouping related tests
- Use \`it\` blocks for individual test cases
- Follow AAA pattern: Arrange -> Act -> Assert

## Naming
- Describe: feature or module name
- It: "should [expected behavior] when [condition]"

## Mocking
- Only mock external dependencies (APIs, databases)
- Use factory functions: \`getMockUser(overrides)\`
- Never mock the module under test

## Assertions
- One logical assertion per test
- Use specific matchers: \`toHaveBeenCalledWith\` over \`toHaveBeenCalled\`
- Test error cases and edge cases

## File Structure
- Co-locate tests: \`foo.test.ts\` next to \`foo.ts\`
- Shared fixtures in \`__fixtures__/\` directory
- Test utilities in \`__helpers__/\` directory
`,
        description: "Testing patterns skill file",
      },
    ],
  },
  {
    id: "skill-api-design",
    name: "Skill Architect — API Design",
    nameKo: "Skill Architect — API 설계",
    description: "Skill file for REST API design conventions and patterns.",
    descriptionKo: "REST API 설계 규칙 및 패턴을 위한 스킬 파일.",
    category: "skills",
    difficulty: 3,
    scope: "project",
    tags: [".claude/skills/", "SKILL.md", "REST 패턴", "HTTP 메서드", "에러 코드 규칙", "Zod 검증"],
    settings: {},
    extraFiles: [
      {
        path: ".claude/skills/api-design/SKILL.md",
        content: `---
name: api-design
description: REST API design conventions and error handling patterns
---

# API Design Patterns

## URL Structure
- Resources are nouns, plural: \`/api/users\`, \`/api/projects\`
- Nested resources: \`/api/projects/:id/files\`
- Actions as sub-resources: \`/api/projects/:id/export\`

## HTTP Methods
- GET: Read (idempotent, no body)
- POST: Create or action
- PUT: Full update (idempotent)
- PATCH: Partial update
- DELETE: Remove (idempotent)

## Response Format
\`\`\`json
{
  "data": {},
  "error": null,
  "meta": { "total": 100, "page": 1 }
}
\`\`\`

## Error Handling
- 400: Validation error (include field details)
- 401: Not authenticated
- 403: Not authorized
- 404: Resource not found
- 409: Conflict (duplicate, state mismatch)
- 500: Internal error (generic message, log details)

## Validation
- Validate at the boundary (API handler)
- Return all validation errors at once
- Use Zod or similar schema validation
`,
        description: "API design patterns skill file",
      },
    ],
  },

  // ─── 4. MCP Integrator ───
  {
    id: "mcp-github",
    name: "MCP Integrator — GitHub",
    nameKo: "MCP Integrator — GitHub 연동",
    description: "MCP server configuration for GitHub integration (issues, PRs, repos).",
    descriptionKo: "GitHub 연동 MCP 서버 설정 (이슈, PR, 리포지토리).",
    category: "mcp",
    difficulty: 2,
    scope: "project",
    tags: ["mcpServers.github", "@anthropic/mcp-github", "GITHUB_TOKEN 필요"],
    settings: {
      mcpServers: {
        github: {
          command: "npx",
          args: ["-y", "@anthropic/mcp-github"],
          env: { GITHUB_TOKEN: "${GITHUB_TOKEN}" },
        },
      },
    },
  },
  {
    id: "mcp-slack",
    name: "MCP Integrator — Slack",
    nameKo: "MCP Integrator — Slack 연동",
    description: "MCP server configuration for Slack integration (messages, channels).",
    descriptionKo: "Slack 연동 MCP 서버 설정 (메시지, 채널).",
    category: "mcp",
    difficulty: 2,
    scope: "project",
    tags: ["mcpServers.slack", "@anthropic/mcp-slack", "SLACK_BOT_TOKEN", "SLACK_TEAM_ID"],
    settings: {
      mcpServers: {
        slack: {
          command: "npx",
          args: ["-y", "@anthropic/mcp-slack"],
          env: {
            SLACK_BOT_TOKEN: "${SLACK_BOT_TOKEN}",
            SLACK_TEAM_ID: "${SLACK_TEAM_ID}",
          },
        },
      },
    },
  },
  {
    id: "mcp-postgres",
    name: "MCP Integrator — PostgreSQL",
    nameKo: "MCP Integrator — PostgreSQL 연동",
    description: "MCP server configuration for PostgreSQL database access.",
    descriptionKo: "PostgreSQL 데이터베이스 접근을 위한 MCP 서버 설정.",
    category: "mcp",
    difficulty: 2,
    scope: "project",
    tags: ["mcpServers.postgres", "@anthropic/mcp-postgres", "DATABASE_URL 필요"],
    settings: {
      mcpServers: {
        postgres: {
          command: "npx",
          args: ["-y", "@anthropic/mcp-postgres"],
          env: { DATABASE_URL: "${DATABASE_URL}" },
        },
      },
    },
  },
  {
    id: "mcp-context7",
    name: "MCP Integrator — Context7 (Docs)",
    nameKo: "MCP Integrator — Context7 (문서 검색)",
    description: "MCP server for Context7 — search and retrieve documentation for libraries and frameworks.",
    descriptionKo: "Context7 MCP 서버 — 라이브러리/프레임워크 문서 검색 및 조회.",
    category: "mcp",
    difficulty: 2,
    scope: "project",
    tags: ["mcpServers.context7", "@anthropic/mcp-context7", "env 불필요"],
    settings: {
      mcpServers: {
        context7: {
          command: "npx",
          args: ["-y", "@anthropic/mcp-context7"],
        },
      },
    },
  },

  // ─── 5. CLAUDE.md Writer ───
  {
    id: "claudemd-nextjs",
    name: "CLAUDE.md Writer — Next.js Project",
    nameKo: "CLAUDE.md Writer — Next.js 프로젝트",
    description: "CLAUDE.md template for Next.js + TypeScript projects with standard conventions.",
    descriptionKo: "Next.js + TypeScript 프로젝트용 CLAUDE.md 템플릿.",
    category: "claude-md",
    difficulty: 1,
    scope: "project",
    tags: ["CLAUDE.md", "Next.js", "React", "TypeScript", "Tailwind", "Prisma"],
    settings: {},
    extraFiles: [
      {
        path: "CLAUDE.md",
        content: `# Project Name

## Stack
- Frontend: Next.js, React, TypeScript
- Styling: Tailwind CSS
- DB: Prisma + PostgreSQL

## Commands
- \`npm run dev\` — Dev server
- \`npm run build\` — Production build
- \`npm run test\` — Run tests
- \`npm run lint\` — Lint check

## Directory Structure
- \`src/app/\` — Page routes (App Router)
- \`src/components/\` — UI components
- \`src/lib/\` — Utilities and helpers
- \`prisma/\` — Database schema

## Rules
- Functions under 50 lines
- Single responsibility per component
- Always type API responses
- Tests must pass before commit
- No \`any\` types — use \`unknown\` + type guards
`,
        description: "CLAUDE.md template for Next.js projects",
      },
    ],
  },
  {
    id: "claudemd-python",
    name: "CLAUDE.md Writer — Python Project",
    nameKo: "CLAUDE.md Writer — Python 프로젝트",
    description: "CLAUDE.md template for Python projects with FastAPI/Django patterns.",
    descriptionKo: "FastAPI/Django 패턴을 사용하는 Python 프로젝트용 CLAUDE.md 템플릿.",
    category: "claude-md",
    difficulty: 1,
    scope: "project",
    tags: ["CLAUDE.md", "Python 3.12+", "FastAPI", "SQLAlchemy", "pytest", "ruff"],
    settings: {},
    extraFiles: [
      {
        path: "CLAUDE.md",
        content: `# Project Name

## Stack
- Backend: Python 3.12+, FastAPI
- DB: SQLAlchemy + PostgreSQL
- Testing: pytest

## Commands
- \`uv run dev\` — Dev server
- \`uv run pytest\` — Run tests
- \`uv run ruff check .\` — Lint
- \`uv run ruff format .\` — Format

## Directory Structure
- \`src/api/\` — API routes
- \`src/models/\` — Database models
- \`src/services/\` — Business logic
- \`src/schemas/\` — Pydantic schemas
- \`tests/\` — Test files

## Rules
- Type hints on all function signatures
- Pydantic models for all API I/O
- Async handlers where possible
- Tests for all service functions
- No bare \`except:\` — always specify exception type
`,
        description: "CLAUDE.md template for Python projects",
      },
    ],
  },

  // ─── 6. CI/CD Automator ───
  {
    id: "cicd-pr-review",
    name: "CI/CD Automator — PR Review Workflow",
    nameKo: "CI/CD Automator — PR 자동 리뷰",
    description: "GitHub Actions workflow for automatic PR review using Claude Code.",
    descriptionKo: "Claude Code를 사용한 자동 PR 리뷰 GitHub Actions 워크플로우.",
    category: "cicd",
    difficulty: 3,
    scope: "project",
    tags: [".github/workflows/", "pull_request 트리거", "ANTHROPIC_API_KEY", "보안/성능/품질 리뷰"],
    settings: {},
    extraFiles: [
      {
        path: ".github/workflows/claude-pr-review.yml",
        content: `name: Claude Code PR Review
on:
  pull_request:
    types: [opened, synchronize]
jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Claude Review
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          npx @anthropic-ai/claude-code -p \\
            "Review the changes in this PR. Focus on: \\
             1. Security vulnerabilities \\
             2. Performance issues \\
             3. Code quality and readability \\
             4. Missing error handling \\
             Provide specific line references."
`,
        description: "GitHub Actions PR review workflow",
      },
    ],
  },

  // ─── 7. Agent Designer ───
  {
    id: "agent-code-reviewer",
    name: "Agent Designer — Code Reviewer",
    nameKo: "Agent Designer — 코드 리뷰어",
    description: "Sub-agent configuration for automated code review with security, performance, quality, and accessibility checks.",
    descriptionKo: "보안, 성능, 품질, 접근성 검사를 수행하는 자동 코드 리뷰 서브에이전트 설정.",
    category: "agents",
    difficulty: 3,
    scope: "project",
    tags: [".claude/agents/", "model: sonnet", "Read/Glob/Grep", "4관점 리뷰", "CRITICAL/WARNING/SUGGESTION"],
    settings: {},
    extraFiles: [
      {
        path: ".claude/agents/code-reviewer.md",
        content: `---
name: code-reviewer
description: Code review agent focusing on security, performance, quality, and accessibility
model: sonnet
tools:
  - Read
  - Glob
  - Grep
---

# Code Reviewer

Review code from 4 perspectives:

## 1. Security
- Injection vulnerabilities (SQL, XSS, command)
- Authentication/authorization gaps
- Secret/credential exposure
- Input validation issues

## 2. Performance
- N+1 queries
- Memory leaks
- Unnecessary re-renders (React)
- Missing indexes on DB queries

## 3. Quality
- Naming clarity
- Cyclomatic complexity
- Testability
- Single responsibility

## 4. Accessibility
- Keyboard navigation
- ARIA attributes
- Color contrast
- Screen reader support

Output format:
- [CRITICAL] — Must fix before merge
- [WARNING] — Should fix, can defer
- [SUGGESTION] — Nice to have improvement
`,
        description: "Code reviewer sub-agent definition",
      },
    ],
  },
  {
    id: "agent-test-writer",
    name: "Agent Designer — Test Writer",
    nameKo: "Agent Designer — 테스트 작성자",
    description: "Sub-agent that generates comprehensive tests for existing code.",
    descriptionKo: "기존 코드에 대한 포괄적인 테스트를 생성하는 서브에이전트.",
    category: "agents",
    difficulty: 3,
    scope: "project",
    tags: [".claude/agents/", "model: sonnet", "Read/Write/Glob/Grep/Bash", "커버리지 타겟", "anti-pattern 방지"],
    settings: {},
    extraFiles: [
      {
        path: ".claude/agents/test-writer.md",
        content: `---
name: test-writer
description: Generates comprehensive tests for existing code
model: sonnet
tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
---

# Test Writer

Write tests following these principles:

## Process
1. Read the target file and understand its interface
2. Identify all code paths (happy path, errors, edge cases)
3. Generate test file with comprehensive coverage
4. Run the tests to verify they pass

## Coverage Targets
- All exported functions
- Error handling paths
- Edge cases (empty input, null, boundary values)
- Integration between components

## Test Structure
- Group by function/method in describe blocks
- One assertion per test case
- Use descriptive test names
- Include setup/teardown as needed

## Anti-patterns to Avoid
- Testing implementation details
- Brittle assertions on exact strings
- Tests that depend on execution order
- Mocking the module under test
`,
        description: "Test writer sub-agent definition",
      },
    ],
  },

  // ─── 8. Config Optimizer ───
  {
    id: "config-performance",
    name: "Config Optimizer — Performance Settings",
    nameKo: "Config Optimizer — 성능 최적화",
    description: "Optimized settings for faster Claude Code sessions with thinking mode enabled.",
    descriptionKo: "thinking 모드 활성화 및 빠른 Claude Code 세션을 위한 최적화 설정.",
    category: "optimization",
    difficulty: 1,
    scope: "global",
    tags: ["env.DISABLE_TELEMETRY", "env.DISABLE_ERROR_REPORTING", "model: sonnet"],
    settings: {
      env: {
        DISABLE_TELEMETRY: "1",
        DISABLE_ERROR_REPORTING: "1",
      },
      model: "claude-sonnet-4-6",
    },
  },
  {
    id: "config-full-global",
    name: "Config Optimizer — Full Global Setup",
    nameKo: "Config Optimizer — 풀 글로벌 설정",
    description: "Complete global settings.json with security, hooks, and optimization combined.",
    descriptionKo: "보안, 훅, 최적화를 통합한 완전한 글로벌 settings.json.",
    category: "optimization",
    difficulty: 1,
    scope: "global",
    tags: ["permissions.allow/deny", "hooks.Stop", "env.DISABLE_TELEMETRY", "~/.ssh 차단", "git check 훅"],
    settings: {
      env: {
        DISABLE_TELEMETRY: "1",
      },
      permissions: {
        allow: ["Skill"],
        deny: [
          "Read(~/.ssh/**)",
          "Read(~/.aws/**)",
          "Read(~/.gnupg/**)",
          "Edit(~/.bashrc)",
          "Edit(~/.zshrc)",
        ],
      },
      hooks: {
        Stop: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command: "~/.claude/stop-hook-git-check.sh",
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "config-full-project",
    name: "Config Optimizer — Full Project Setup",
    nameKo: "Config Optimizer — 풀 프로젝트 설정",
    description: "Complete project settings.json with permissions, branch protection, and auto-lint hooks.",
    descriptionKo: "권한, 브랜치 보호, 자동 린트 훅을 통합한 완전한 프로젝트 settings.json.",
    category: "optimization",
    difficulty: 2,
    scope: "project",
    tags: ["permissions.allow/deny", "hooks.PreToolUse", "hooks.PostToolUse", "main 보호", "auto-lint"],
    settings: {
      permissions: {
        allow: [
          "Edit(*)",
          "Write(*)",
          "Bash(npm run *)",
          "Bash(git *)",
        ],
        deny: [
          "Read(.env)",
          "Read(.env.*)",
          "Read(./secrets/**)",
        ],
      },
      hooks: {
        PreToolUse: [
          {
            matcher: "Edit|Write",
            hooks: [
              {
                type: "command",
                command:
                  '[ "$(git branch --show-current 2>/dev/null)" != "main" ] || { echo \'{"block":true,"message":"main 브랜치 편집 금지"}\' >&2; exit 2; }',
                timeout: 5,
              },
            ],
          },
        ],
        PostToolUse: [
          {
            matcher: "Write|Edit",
            hooks: [
              {
                type: "command",
                command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/auto-lint.sh',
                timeout: 30,
              },
            ],
          },
        ],
      },
    },
  },

  // ─── NEW: Security — Ask 계층 + 고급 deny ───
  {
    id: "security-ask-tier",
    name: "Security Guard — Ask Tier (3-Layer Permissions)",
    nameKo: "Security Guard — Ask 계층 (3단계 권한)",
    description: "Complete allow/ask/deny 3-tier permissions. Ask tier requires user confirmation for risky but common operations.",
    descriptionKo: "allow/ask/deny 3단계 권한 체계. ask 계층은 위험하지만 일반적인 작업에 사용자 확인 요청.",
    category: "security",
    difficulty: 2,
    scope: "project",
    tags: ["permissions.allow ×9", "permissions.ask ×7", "permissions.deny ×6", "3단계 체계", "push/rm 확인"],
    settings: {
      permissions: {
        allow: [
          "Read(*)",
          "Edit(*)",
          "Write(*.md)",
          "Bash(npm run *)",
          "Bash(git status)",
          "Bash(git diff *)",
          "Bash(git log *)",
          "Glob",
          "Grep",
        ],
        ask: [
          "Bash(git push *)",
          "Bash(git reset *)",
          "Bash(rm *)",
          "Bash(npm install *)",
          "Bash(npx *)",
          "Write(*)",
          "WebFetch(*)",
        ],
        deny: [
          "Read(.env)",
          "Read(.env.*)",
          "Read(./secrets/**)",
          "Bash(curl *)",
          "Bash(wget *)",
          "Bash(ssh *)",
        ],
      },
    },
  },

  // ─── NEW: Security — Sandbox 설정 ───
  {
    id: "security-sandbox",
    name: "Security Guard — Sandbox Configuration",
    nameKo: "Security Guard — 샌드박스 설정",
    description: "Full sandbox configuration with filesystem and network restrictions.",
    descriptionKo: "파일시스템 및 네트워크 제한이 포함된 완전한 샌드박스 설정.",
    category: "security",
    difficulty: 2,
    scope: "project",
    tags: ["sandbox.enabled", "sandbox.filesystem.denyRead", "sandbox.network.allowedDomains", "github.com", "npmjs.org"],
    settings: {
      sandbox: {
        enabled: true,
        autoAllowBashIfSandboxed: true,
        filesystem: {
          denyRead: ["~/.aws/credentials", "~/.ssh/id_*"],
          denyWrite: ["/etc", "/usr/local/bin"],
        },
        network: {
          allowedDomains: ["github.com", "*.npmjs.org", "registry.yarnpkg.com"],
        },
      },
    },
  },

  // ─── NEW: Security — Auto Mode 제어 ───
  {
    id: "security-auto-mode",
    name: "Security Guard — Auto Mode Control",
    nameKo: "Security Guard — Auto Mode 제어",
    description: "Configure auto mode with environment descriptions and soft deny patterns.",
    descriptionKo: "환경 설명 및 soft deny 패턴으로 Auto Mode를 안전하게 설정.",
    category: "security",
    difficulty: 3,
    scope: "project",
    tags: ["defaultMode: auto", "autoMode.environment", "autoMode.allow", "autoMode.soft_deny", "main push 차단"],
    settings: {
      defaultMode: "auto",
      autoMode: {
        environment: [
          "Internal development environment",
          "Source control: GitHub",
        ],
        allow: [
          "Running tests and linters",
          "Reading and editing source code",
          "Git operations on feature branches",
        ],
        soft_deny: [
          "Pushing to main/master branch",
          "Deleting files outside project directory",
          "Running curl/wget to external URLs",
          "Modifying CI/CD configuration",
        ],
      },
    },
  },

  // ─── NEW: Hook — SessionEnd 로깅 ───
  {
    id: "hooks-session-end",
    name: "Hook Engineer — Session End Logging",
    nameKo: "Hook Engineer — 세션 종료 로깅",
    description: "SessionEnd hook that logs session summary to a file for audit trail.",
    descriptionKo: "감사 추적을 위해 세션 종료 시 요약을 파일에 로깅하는 SessionEnd 훅.",
    category: "hooks",
    difficulty: 2,
    scope: "global",
    tags: ["hooks.SessionEnd", "session-log.txt", "날짜+경로 기록", "감사 추적"],
    settings: {
      hooks: {
        SessionEnd: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command: 'echo "[$(date +%Y-%m-%d\\ %H:%M:%S)] Session ended in $(pwd)" >> ~/.claude/session-log.txt',
                timeout: 5,
              },
            ],
          },
        ],
      },
    },
  },

  // ─── NEW: Hook — UserPromptSubmit 검증 ───
  {
    id: "hooks-prompt-validate",
    name: "Hook Engineer — Prompt Validation",
    nameKo: "Hook Engineer — 프롬프트 검증",
    description: "UserPromptSubmit hook that validates prompts before processing.",
    descriptionKo: "프롬프트 처리 전 검증을 수행하는 UserPromptSubmit 훅.",
    category: "hooks",
    difficulty: 2,
    scope: "project",
    tags: ["hooks.UserPromptSubmit", "10000자 제한", "jq 파싱", "block 응답"],
    settings: {
      hooks: {
        UserPromptSubmit: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command: 'PROMPT=$(cat | jq -r \'.prompt // empty\'); [ ${#PROMPT} -lt 10000 ] || { echo \'{"block":true,"message":"Prompt too long (max 10000 chars)"}\' >&2; exit 2; }',
                timeout: 5,
              },
            ],
          },
        ],
      },
    },
  },

  // ─── NEW: Hook — Notification webhook ───
  {
    id: "hooks-notification-webhook",
    name: "Hook Engineer — Notification Webhook",
    nameKo: "Hook Engineer — 알림 웹훅",
    description: "Notification hook that sends alerts to a webhook URL (Slack, Discord, etc.).",
    descriptionKo: "Slack, Discord 등 웹훅 URL로 알림을 보내는 Notification 훅.",
    category: "hooks",
    difficulty: 3,
    scope: "project",
    tags: ["hooks.Notification", "WEBHOOK_URL 필요", "curl POST", "Slack/Discord 호환"],
    settings: {
      hooks: {
        Notification: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command: 'MSG=$(cat | jq -r \'.message // "Claude notification"\'); curl -s -X POST "${WEBHOOK_URL}" -H "Content-Type: application/json" -d "{\\\"text\\\": \\\"$MSG\\\"}" > /dev/null 2>&1 || true',
                timeout: 10,
              },
            ],
          },
        ],
      },
    },
  },

  // ─── NEW: Config — Worktree 설정 ───
  {
    id: "config-worktree",
    name: "Config Optimizer — Worktree Settings",
    nameKo: "Config Optimizer — Worktree 설정",
    description: "Worktree configuration with symlink directories and sparse paths for monorepos.",
    descriptionKo: "모노레포를 위한 symlink 디렉토리 및 sparse 경로 Worktree 설정.",
    category: "optimization",
    difficulty: 2,
    scope: "project",
    tags: ["worktree.symlinkDirectories", "worktree.sparsePaths", "node_modules 심링크", "모노레포"],
    settings: {
      worktree: {
        symlinkDirectories: ["node_modules", ".cache", "dist"],
        sparsePaths: ["packages/my-app", "shared/utils"],
      },
    },
  },

  // ─── NEW: Config — Attribution 설정 ───
  {
    id: "config-attribution",
    name: "Config Optimizer — Attribution Settings",
    nameKo: "Config Optimizer — 어트리뷰션 설정",
    description: "Configure commit and PR attribution messages for Claude Code contributions.",
    descriptionKo: "Claude Code 기여에 대한 커밋 및 PR 어트리뷰션 메시지 설정.",
    category: "optimization",
    difficulty: 1,
    scope: "global",
    tags: ["attribution.commit", "attribution.pr", "Co-Authored-By"],
    settings: {
      attribution: {
        commit: "Co-Authored-By: Claude <noreply@anthropic.com>",
        pr: "Generated with Claude Code",
      },
    },
  },

  // ─── NEW: Config — 환경변수 마스터 ───
  {
    id: "config-env-master",
    name: "Config Optimizer — Environment Variables Master",
    nameKo: "Config Optimizer — 환경변수 마스터",
    description: "Comprehensive environment variable configuration for performance, timeouts, and feature control.",
    descriptionKo: "성능, 타임아웃, 기능 제어를 위한 포괄적 환경변수 설정.",
    category: "optimization",
    difficulty: 2,
    scope: "global",
    tags: ["env ×7", "텔레메트리 끔", "타임아웃 설정", "동시성 제어", "MCP 토큰 제한"],
    settings: {
      env: {
        DISABLE_TELEMETRY: "1",
        DISABLE_ERROR_REPORTING: "1",
        BASH_DEFAULT_TIMEOUT_MS: "120000",
        BASH_MAX_TIMEOUT_MS: "600000",
        API_TIMEOUT_MS: "600000",
        CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY: "10",
        MAX_MCP_OUTPUT_TOKENS: "50000",
      },
    },
  },

  // ─── NEW: Config — Effort Level + Thinking ───
  {
    id: "config-thinking",
    name: "Config Optimizer — Deep Thinking Mode",
    nameKo: "Config Optimizer — 딥 씽킹 모드",
    description: "Enable always-on thinking with high effort level for complex tasks.",
    descriptionKo: "복잡한 작업을 위한 상시 thinking 모드 + 높은 effort level 설정.",
    category: "optimization",
    difficulty: 1,
    scope: "global",
    tags: ["alwaysThinkingEnabled", "effortLevel: high", "model: opus"],
    settings: {
      alwaysThinkingEnabled: true,
      effortLevel: "high",
      model: "claude-opus-4-6",
    },
  },

  // ─── NEW: MCP — Puppeteer ───
  {
    id: "mcp-puppeteer",
    name: "MCP Integrator — Puppeteer (Browser)",
    nameKo: "MCP Integrator — Puppeteer (브라우저)",
    description: "MCP server for Puppeteer browser automation — screenshots, navigation, interaction.",
    descriptionKo: "Puppeteer 브라우저 자동화 MCP 서버 — 스크린샷, 네비게이션, 인터랙션.",
    category: "mcp",
    difficulty: 2,
    scope: "project",
    tags: ["mcpServers.puppeteer", "@anthropic/mcp-puppeteer", "브라우저 자동화", "스크린샷"],
    settings: {
      mcpServers: {
        puppeteer: {
          command: "npx",
          args: ["-y", "@anthropic/mcp-puppeteer"],
        },
      },
    },
  },

  // ─── NEW: MCP — Filesystem ───
  {
    id: "mcp-filesystem",
    name: "MCP Integrator — Filesystem",
    nameKo: "MCP Integrator — 파일시스템",
    description: "MCP server for extended filesystem operations beyond built-in tools.",
    descriptionKo: "내장 도구 이상의 확장 파일시스템 작업을 위한 MCP 서버.",
    category: "mcp",
    difficulty: 2,
    scope: "project",
    tags: ["mcpServers.filesystem", "@anthropic/mcp-filesystem", "확장 파일 작업"],
    settings: {
      mcpServers: {
        filesystem: {
          command: "npx",
          args: ["-y", "@anthropic/mcp-filesystem", "."],
        },
      },
    },
  },

  // ─── NEW: Agent — Security Auditor ───
  {
    id: "agent-security-auditor",
    name: "Agent Designer — Security Auditor",
    nameKo: "Agent Designer — 보안 감사자",
    description: "Sub-agent specialized in security auditing — finds vulnerabilities, checks dependencies, reviews auth flows.",
    descriptionKo: "보안 감사 전문 서브에이전트 — 취약점 탐지, 의존성 검사, 인증 흐름 검토.",
    category: "agents",
    difficulty: 3,
    scope: "project",
    tags: [".claude/agents/", "model: opus", "5영역 감사", "CVE 체크", "인증/인가 검토"],
    settings: {},
    extraFiles: [
      {
        path: ".claude/agents/security-auditor.md",
        content: `---
name: security-auditor
description: Security audit agent — vulnerabilities, dependencies, auth flows
model: opus
tools:
  - Read
  - Glob
  - Grep
  - Bash
---

# Security Auditor

Perform comprehensive security audit:

## 1. Dependency Audit
- Run \`npm audit\` / \`pip audit\` / equivalent
- Check for known CVEs in dependencies
- Flag outdated packages with security patches

## 2. Code Vulnerabilities
- SQL injection / NoSQL injection
- XSS (stored, reflected, DOM-based)
- Command injection via user input
- Path traversal
- Insecure deserialization

## 3. Authentication & Authorization
- Session management weaknesses
- Missing CSRF protection
- Insecure password handling
- Broken access control

## 4. Secrets & Configuration
- Hardcoded credentials in source
- .env files committed to git
- Overly permissive CORS
- Debug mode enabled in production

## 5. Infrastructure
- Insecure HTTP endpoints
- Missing security headers
- Exposed error details

Output: severity-ranked findings with remediation steps.
`,
        description: "Security auditor sub-agent definition",
      },
    ],
  },

  // ─── NEW: CLAUDE.md — Go Project ───
  {
    id: "claudemd-go",
    name: "CLAUDE.md Writer — Go Project",
    nameKo: "CLAUDE.md Writer — Go 프로젝트",
    description: "CLAUDE.md template for Go projects with standard project layout.",
    descriptionKo: "표준 프로젝트 레이아웃을 사용하는 Go 프로젝트용 CLAUDE.md 템플릿.",
    category: "claude-md",
    difficulty: 1,
    scope: "project",
    tags: ["CLAUDE.md", "Go 1.22+", "Chi/Gin", "pgx", "golangci-lint"],
    settings: {},
    extraFiles: [
      {
        path: "CLAUDE.md",
        content: `# Project Name

## Stack
- Language: Go 1.22+
- Framework: net/http / Chi / Gin
- DB: PostgreSQL with pgx

## Commands
- \`go run ./cmd/server\` — Run server
- \`go test ./...\` — Run all tests
- \`go vet ./...\` — Static analysis
- \`golangci-lint run\` — Lint

## Directory Structure
- \`cmd/\` — Application entry points
- \`internal/\` — Private packages
- \`pkg/\` — Public packages
- \`api/\` — API definitions (proto, OpenAPI)
- \`migrations/\` — DB migrations

## Rules
- Error handling: always check and wrap errors
- Use \`context.Context\` for cancellation
- Interfaces at consumer, not producer
- Table-driven tests
- No package-level variables (except constants)
`,
        description: "CLAUDE.md template for Go projects",
      },
    ],
  },

  // ─── NEW: CI/CD — Auto Fix Workflow ───
  {
    id: "cicd-auto-fix",
    name: "CI/CD Automator — Auto Fix on Issue",
    nameKo: "CI/CD Automator — 이슈 자동 수정",
    description: "GitHub Actions workflow that auto-fixes issues labeled 'claude-fix' using Claude Code.",
    descriptionKo: "'claude-fix' 라벨이 붙은 이슈를 Claude Code로 자동 수정하는 워크플로우.",
    category: "cicd",
    difficulty: 3,
    scope: "project",
    tags: [".github/workflows/", "issues.labeled 트리거", "claude-fix 라벨", "자동 PR 생성"],
    settings: {},
    extraFiles: [
      {
        path: ".github/workflows/claude-auto-fix.yml",
        content: `name: Claude Auto Fix
on:
  issues:
    types: [labeled]
jobs:
  fix:
    if: github.event.label.name == 'claude-fix'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Create fix branch
        run: |
          git checkout -b fix/issue-\${{ github.event.issue.number }}
      - name: Claude Fix
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          npx @anthropic-ai/claude-code -p \\
            "Fix the issue described below. Create a minimal, focused fix. \\
             Issue #\${{ github.event.issue.number }}: \${{ github.event.issue.title }} \\
             \${{ github.event.issue.body }}"
      - name: Push and create PR
        run: |
          git add -A
          git commit -m "fix: auto-fix for #\${{ github.event.issue.number }}"
          git push origin fix/issue-\${{ github.event.issue.number }}
          gh pr create --title "Fix #\${{ github.event.issue.number }}" \\
            --body "Auto-generated fix for #\${{ github.event.issue.number }}" \\
            --base main
`,
        description: "GitHub Actions auto-fix workflow",
      },
    ],
  },
];

export function getTemplateById(id: string): Template | undefined {
  return templates.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: Template["category"]): Template[] {
  return templates.filter((t) => t.category === category);
}

export const categoryLabels: Record<Template["category"], { name: string; nameKo: string; icon: string }> = {
  security: { name: "Security Guard", nameKo: "보안 가드", icon: "Shield" },
  hooks: { name: "Hook Engineer", nameKo: "훅 엔지니어", icon: "Webhook" },
  skills: { name: "Skill Architect", nameKo: "스킬 아키텍트", icon: "BookOpen" },
  mcp: { name: "MCP Integrator", nameKo: "MCP 통합", icon: "Plug" },
  "claude-md": { name: "CLAUDE.md Writer", nameKo: "CLAUDE.md 작성자", icon: "FileText" },
  cicd: { name: "CI/CD Automator", nameKo: "CI/CD 자동화", icon: "GitBranch" },
  agents: { name: "Agent Designer", nameKo: "에이전트 설계자", icon: "Bot" },
  optimization: { name: "Config Optimizer", nameKo: "설정 최적화", icon: "Zap" },
};
