import type { ClaudeSettings } from "@/lib/settings-schema";

export interface Template {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  category: TemplateCategory;
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

export type TemplateCategory =
  | "security"
  | "permissions"
  | "hooks"
  | "skills"
  | "mcp"
  | "claude-md"
  | "cicd"
  | "agents"
  | "model"
  | "env"
  | "ui"
  | "optimization";

export const templates: Template[] = [
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. SECURITY GUARD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: "security-basic",
    name: "Security Guard — Basic Permissions",
    nameKo: "기본 권한 설정",
    description: "Essential allow/deny rules for safe Claude Code usage.",
    descriptionKo: "안전한 Claude Code 사용을 위한 기본 allow/deny 규칙.",
    category: "security",
    difficulty: 1,
    scope: "project",
    tags: ["permissions.allow ×9", "permissions.deny ×5", ".env 차단", "curl/wget 차단"],
    settings: {
      permissions: {
        allow: [
          "Edit(*)", "Write(*.md)", "Bash(npm run *)",
          "Bash(git status)", "Bash(git diff *)", "Bash(git log *)",
          "Bash(git add *)", "Bash(git commit *)", "Read(*)",
        ],
        deny: [
          "Read(.env)", "Read(.env.*)", "Read(./secrets/**)",
          "Bash(curl *)", "Bash(wget *)",
        ],
      },
    },
  },
  {
    id: "security-hardened",
    name: "Security Guard — Hardened (Trail of Bits)",
    nameKo: "강화 보안 (Trail of Bits)",
    description: "Advanced deny rules blocking SSH keys, cloud creds, shell configs.",
    descriptionKo: "SSH 키, 클라우드 인증정보, 셸 설정 접근 차단 강화 규칙.",
    category: "security",
    difficulty: 1,
    scope: "global",
    tags: ["permissions.deny ×12", "~/.ssh", "~/.aws", "~/.gnupg", "~/.docker", ".bashrc 편집 차단"],
    settings: {
      permissions: {
        allow: ["Skill"],
        deny: [
          "Read(~/.ssh/**)", "Read(~/.gnupg/**)", "Read(~/.aws/**)",
          "Read(~/.azure/**)", "Read(~/.kube/**)", "Read(~/.docker/config.json)",
          "Read(~/.npmrc)", "Read(~/.pypirc)", "Read(~/.git-credentials)",
          "Read(~/.config/gh/**)", "Edit(~/.bashrc)", "Edit(~/.zshrc)",
        ],
      },
    },
  },
  {
    id: "security-ask-tier",
    name: "Security Guard — Ask Tier (3-Layer)",
    nameKo: "Ask 계층 (3단계 권한)",
    description: "Complete allow/ask/deny 3-tier permissions with user confirmation for risky ops.",
    descriptionKo: "allow/ask/deny 3단계 권한 체계. 위험한 작업에 사용자 확인 요청.",
    category: "security",
    difficulty: 2,
    scope: "project",
    tags: ["permissions.allow ×9", "permissions.ask ×7", "permissions.deny ×6", "push/rm 확인"],
    settings: {
      permissions: {
        allow: [
          "Read(*)", "Edit(*)", "Write(*.md)", "Bash(npm run *)",
          "Bash(git status)", "Bash(git diff *)", "Bash(git log *)",
          "Glob", "Grep",
        ],
        ask: [
          "Bash(git push *)", "Bash(git reset *)", "Bash(rm *)",
          "Bash(npm install *)", "Bash(npx *)", "Write(*)", "WebFetch(*)",
        ],
        deny: [
          "Read(.env)", "Read(.env.*)", "Read(./secrets/**)",
          "Bash(curl *)", "Bash(wget *)", "Bash(ssh *)",
        ],
      },
    },
  },
  {
    id: "security-sandbox",
    name: "Security Guard — Sandbox Configuration",
    nameKo: "샌드박스 설정",
    description: "Full sandbox with filesystem and network restrictions.",
    descriptionKo: "파일시스템 및 네트워크 제한 포함 샌드박스 설정.",
    category: "security",
    difficulty: 2,
    scope: "project",
    tags: ["sandbox.enabled", "sandbox.filesystem", "sandbox.network", "github.com", "npmjs.org"],
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
  {
    id: "security-auto-mode",
    name: "Security Guard — Auto Mode Control",
    nameKo: "Auto Mode 제어",
    description: "Configure auto mode with environment descriptions and soft deny patterns.",
    descriptionKo: "환경 설명 및 soft deny 패턴으로 Auto Mode를 안전하게 설정.",
    category: "security",
    difficulty: 3,
    scope: "project",
    tags: ["defaultMode: auto", "autoMode.environment", "autoMode.allow", "autoMode.soft_deny"],
    settings: {
      defaultMode: "auto",
      autoMode: {
        environment: ["Internal development environment", "Source control: GitHub"],
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
  {
    id: "security-disable-bypass",
    name: "Security Guard — Disable Bypass Modes",
    nameKo: "바이패스 모드 비활성화",
    description: "Prevent users from enabling bypass or auto modes. Team safety enforcement.",
    descriptionKo: "바이패스/자동 모드 전환을 차단. 팀 보안 정책 강제.",
    category: "security",
    difficulty: 2,
    scope: "global",
    tags: ["disableBypassPermissionsMode", "disableAutoMode", "팀 보안 강제"],
    settings: {
      permissions: {
        disableBypassPermissionsMode: "Security policy: bypass mode disabled by admin",
        disableAutoMode: "Security policy: auto mode disabled by admin",
      },
    },
  },
  {
    id: "security-readonly-project",
    name: "Security Guard — Read-Only Project",
    nameKo: "읽기 전용 프로젝트",
    description: "Project where Claude can only read and analyze, not modify any files.",
    descriptionKo: "파일 수정 불가, 읽기 및 분석만 가능한 프로젝트 설정.",
    category: "security",
    difficulty: 1,
    scope: "project",
    tags: ["permissions.allow: Read/Glob/Grep", "permissions.deny: Edit/Write/Bash", "분석 전용"],
    settings: {
      permissions: {
        allow: ["Read(*)", "Glob", "Grep"],
        deny: [
          "Edit(*)", "Write(*)", "Bash(*)",
        ],
      },
    },
  },
  {
    id: "security-block-agents",
    name: "Security Guard — Block Subagents",
    nameKo: "서브에이전트 완전 차단",
    description: "Block all subagent (Task) creation. Main Claude session remains fully functional.",
    descriptionKo: "서브에이전트(Task 도구) 생성 완전 차단. Claude 본 세션은 정상 작동.",
    category: "security",
    difficulty: 1,
    scope: "both",
    tags: ["permissions.deny: Task/Agent", "서브에이전트 차단", "폭주 방지"],
    settings: {
      permissions: {
        deny: ["Task", "Agent"],
      },
    },
  },
  {
    id: "security-limit-tools",
    name: "Security Guard — Limit Sensitive Paths",
    nameKo: "민감 경로 차단",
    description: "Selectively deny access to sensitive files (.env, secrets) without blocking all tools.",
    descriptionKo: ".env 및 secrets 등 민감 파일 접근만 선택적으로 차단. 전체 도구 차단 아님.",
    category: "security",
    difficulty: 1,
    scope: "project",
    tags: ["permissions.deny: .env*", "secrets 차단", "선택적 제한"],
    settings: {
      permissions: {
        deny: [
          "Edit(.env)", "Edit(.env.*)", "Write(.env)", "Write(.env.*)",
          "Read(.env.production)", "Read(./secrets/**)", "Edit(./secrets/**)",
        ],
      },
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. PERMISSIONS (세분화)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: "perm-frontend-dev",
    name: "Frontend Dev Permissions",
    nameKo: "프론트엔드 개발 권한",
    description: "Permissions for React/Vue/Svelte frontend development with npm/build tools.",
    descriptionKo: "React/Vue/Svelte 프론트엔드 개발용 npm/빌드 도구 권한.",
    category: "permissions",
    difficulty: 1,
    scope: "project",
    tags: ["Edit(src/**)", "Write(src/**)", "npm run dev/build/test", "prettier", "eslint"],
    settings: {
      permissions: {
        allow: [
          "Read(*)", "Edit(src/**)", "Edit(public/**)", "Write(src/**)",
          "Bash(npm run *)", "Bash(npx prettier *)", "Bash(npx eslint *)",
          "Bash(git *)", "Glob", "Grep",
        ],
        deny: [
          "Read(.env)", "Read(.env.*)", "Edit(package.json)",
          "Bash(npm publish *)", "Bash(rm -rf *)",
        ],
      },
    },
  },
  {
    id: "perm-backend-dev",
    name: "Backend Dev Permissions",
    nameKo: "백엔드 개발 권한",
    description: "Permissions for backend development with DB migrations, API testing, docker.",
    descriptionKo: "DB 마이그레이션, API 테스트, Docker 포함 백엔드 개발 권한.",
    category: "permissions",
    difficulty: 1,
    scope: "project",
    tags: ["Edit(src/**)", "npm run migrate", "docker compose", "API 테스트", "curl localhost"],
    settings: {
      permissions: {
        allow: [
          "Read(*)", "Edit(src/**)", "Write(src/**)",
          "Bash(npm run *)", "Bash(docker compose *)", "Bash(curl http://localhost:*)",
          "Bash(git *)", "Glob", "Grep",
        ],
        ask: [
          "Bash(npm run migrate *)", "Bash(docker *)",
        ],
        deny: [
          "Read(.env.production)", "Read(./secrets/**)",
          "Bash(curl http*://!localhost*)", "Bash(ssh *)",
        ],
      },
    },
  },
  {
    id: "perm-git-only",
    name: "Git Operations Only",
    nameKo: "Git 전용 권한",
    description: "Only allow git operations. For commit message editing, branch management.",
    descriptionKo: "Git 작업만 허용. 커밋 메시지 작성, 브랜치 관리용.",
    category: "permissions",
    difficulty: 1,
    scope: "project",
    tags: ["Read(*)", "Bash(git *)", "Edit 차단", "Write 차단", "코드 수정 불가"],
    settings: {
      permissions: {
        allow: [
          "Read(*)", "Glob", "Grep",
          "Bash(git *)",
        ],
        deny: [
          "Edit(*)", "Write(*)", "Bash(npm *)", "Bash(node *)",
        ],
      },
    },
  },
  {
    id: "perm-devops",
    name: "DevOps Permissions",
    nameKo: "DevOps 권한",
    description: "Permissions for infrastructure, Docker, Kubernetes, Terraform work.",
    descriptionKo: "인프라, Docker, Kubernetes, Terraform 작업 권한.",
    category: "permissions",
    difficulty: 2,
    scope: "project",
    tags: ["docker", "kubectl", "terraform", "ansible", "인프라 관리"],
    settings: {
      permissions: {
        allow: [
          "Read(*)", "Edit(*.yml)", "Edit(*.yaml)", "Edit(*.tf)", "Edit(Dockerfile*)",
          "Bash(docker *)", "Bash(kubectl get *)", "Bash(kubectl describe *)",
          "Bash(terraform plan *)", "Bash(terraform validate *)",
          "Bash(git *)", "Glob", "Grep",
        ],
        ask: [
          "Bash(kubectl apply *)", "Bash(kubectl delete *)",
          "Bash(terraform apply *)", "Bash(docker push *)",
          "Bash(ansible-playbook *)",
        ],
        deny: [
          "Bash(kubectl exec *)", "Bash(terraform destroy *)",
          "Read(~/.kube/config)", "Read(.env.production)",
        ],
      },
    },
  },
  {
    id: "perm-data-science",
    name: "Data Science Permissions",
    nameKo: "데이터 사이언스 권한",
    description: "Permissions for Jupyter, pandas, data analysis workflows.",
    descriptionKo: "Jupyter, pandas, 데이터 분석 워크플로우 권한.",
    category: "permissions",
    difficulty: 1,
    scope: "project",
    tags: ["python/jupyter", "pip install", "데이터 분석", "CSV/Parquet 읽기"],
    settings: {
      permissions: {
        allow: [
          "Read(*)", "Edit(*.py)", "Edit(*.ipynb)", "Write(*.py)", "Write(*.ipynb)",
          "Bash(python *)", "Bash(jupyter *)", "Bash(pip install *)",
          "Bash(git *)", "Glob", "Grep",
        ],
        deny: [
          "Read(.env)", "Bash(curl *)", "Bash(wget *)",
          "Bash(rm -rf *)", "Bash(ssh *)",
        ],
      },
    },
  },
  {
    id: "perm-monorepo",
    name: "Monorepo Permissions",
    nameKo: "모노레포 권한",
    description: "Scoped permissions for monorepo — restrict edits to specific packages.",
    descriptionKo: "모노레포용 범위 제한 권한 — 특정 패키지만 수정 허용.",
    category: "permissions",
    difficulty: 2,
    scope: "project",
    tags: ["Edit(packages/my-app/**)", "additionalDirectories", "turborepo/pnpm", "패키지 범위 제한"],
    settings: {
      permissions: {
        allow: [
          "Read(*)", "Glob", "Grep",
          "Edit(packages/my-app/**)", "Write(packages/my-app/**)",
          "Bash(pnpm --filter my-app *)", "Bash(turbo run * --filter=my-app)",
          "Bash(git *)",
        ],
        deny: [
          "Edit(packages/other-app/**)", "Write(packages/other-app/**)",
          "Read(.env)", "Read(.env.*)",
        ],
        additionalDirectories: ["shared/utils"],
      },
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. HOOK ENGINEER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: "hooks-main-protection",
    name: "Main Branch Protection",
    nameKo: "main 브랜치 보호",
    description: "PreToolUse hook that blocks Edit/Write on main branch.",
    descriptionKo: "main 브랜치에서 Edit/Write 작업을 차단하는 PreToolUse 훅.",
    category: "hooks",
    difficulty: 2,
    scope: "project",
    tags: ["hooks.PreToolUse", "matcher: Edit|Write", "main 차단", "exit 2 block"],
    settings: {
      hooks: {
        PreToolUse: [{
          matcher: "Edit|Write",
          hooks: [{
            type: "command",
            command: '[ "$(git branch --show-current 2>/dev/null)" != "main" ] || { echo \'{"block": true, "message": "main 브랜치 직접 편집 금지"}\' >&2; exit 2; }',
            timeout: 5,
          }],
        }],
      },
    },
  },
  {
    id: "hooks-rm-protection",
    name: "rm -rf Protection",
    nameKo: "rm -rf 차단",
    description: "PreToolUse hook that blocks recursive rm commands.",
    descriptionKo: "재귀적 rm 명령을 차단하는 PreToolUse 훅.",
    category: "hooks",
    difficulty: 2,
    scope: "project",
    tags: ["hooks.PreToolUse", "matcher: Bash", "rm -r 패턴 감지", "jq 파싱"],
    settings: {
      hooks: {
        PreToolUse: [{
          matcher: "Bash",
          hooks: [{
            type: "command",
            command: "cat | jq -r '.tool_input.command' | grep -qE 'rm\\s+(-[a-zA-Z]*r[a-zA-Z]*|--recursive)' && { echo 'rm -rf 사용 금지' >&2; exit 2; } || exit 0",
            timeout: 5,
          }],
        }],
      },
    },
  },
  {
    id: "hooks-auto-lint",
    name: "Auto Lint on Save",
    nameKo: "자동 린트",
    description: "PostToolUse hook that runs auto-lint after Write/Edit.",
    descriptionKo: "Write/Edit 작업 후 자동 린트 실행 PostToolUse 훅.",
    category: "hooks",
    difficulty: 2,
    scope: "project",
    tags: ["hooks.PostToolUse", "matcher: Write|Edit", "eslint/ruff/gofmt", "auto-lint.sh"],
    settings: {
      hooks: {
        PostToolUse: [{
          matcher: "Write|Edit",
          hooks: [{
            type: "command",
            command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/auto-lint.sh',
            timeout: 30,
          }],
        }],
      },
    },
    extraFiles: [{
      path: ".claude/hooks/auto-lint.sh",
      content: `#!/bin/bash
set -euo pipefail
FILE=$(cat | jq -r '.tool_input.file_path // empty')
if [ -z "$FILE" ]; then exit 0; fi
EXT="\${FILE##*.}"
case "$EXT" in
  ts|tsx|js|jsx) command -v npx &>/dev/null && npx eslint --fix "$FILE" 2>/dev/null || true ;;
  py) command -v ruff &>/dev/null && ruff format "$FILE" 2>/dev/null || true ;;
  go) command -v gofmt &>/dev/null && gofmt -w "$FILE" 2>/dev/null || true ;;
esac
`,
      description: "Auto-lint script for PostToolUse",
    }],
  },
  {
    id: "hooks-git-check",
    name: "Uncommitted Changes Check",
    nameKo: "미커밋 변경사항 체크",
    description: "Stop hook that warns on uncommitted changes after Claude finishes.",
    descriptionKo: "Claude 작업 완료 후 미커밋 변경사항 경고 Stop 훅.",
    category: "hooks",
    difficulty: 2,
    scope: "global",
    tags: ["hooks.Stop", "git status 체크", "미커밋 경고"],
    settings: {
      hooks: {
        Stop: [{
          matcher: "",
          hooks: [{
            type: "command",
            command: "~/.claude/stop-hook-git-check.sh",
          }],
        }],
      },
    },
    extraFiles: [{
      path: "~/.claude/stop-hook-git-check.sh",
      content: `#!/bin/bash
set -euo pipefail
if ! git rev-parse --is-inside-work-tree &>/dev/null; then exit 0; fi
CHANGES=$(git status --porcelain 2>/dev/null | head -20)
if [ -n "$CHANGES" ]; then
  COUNT=$(echo "$CHANGES" | wc -l | tr -d ' ')
  echo "WARNING: $COUNT uncommitted changes detected:" >&2
  echo "$CHANGES" >&2
fi
`,
      description: "Stop hook for uncommitted changes detection",
    }],
  },
  {
    id: "hooks-session-end",
    name: "Session End Logging",
    nameKo: "세션 종료 로깅",
    description: "SessionEnd hook that logs session summary for audit trail.",
    descriptionKo: "감사 추적을 위해 세션 종료 시 요약 로깅 SessionEnd 훅.",
    category: "hooks",
    difficulty: 2,
    scope: "global",
    tags: ["hooks.SessionEnd", "session-log.txt", "감사 추적"],
    settings: {
      hooks: {
        SessionEnd: [{
          matcher: "",
          hooks: [{
            type: "command",
            command: 'echo "[$(date +%Y-%m-%d\\ %H:%M:%S)] Session ended in $(pwd)" >> ~/.claude/session-log.txt',
            timeout: 5,
          }],
        }],
      },
    },
  },
  {
    id: "hooks-prompt-validate",
    name: "Prompt Validation",
    nameKo: "프롬프트 검증",
    description: "UserPromptSubmit hook that validates prompt length before processing.",
    descriptionKo: "프롬프트 길이 검증 UserPromptSubmit 훅.",
    category: "hooks",
    difficulty: 2,
    scope: "project",
    tags: ["hooks.UserPromptSubmit", "10000자 제한", "jq 파싱", "block 응답"],
    settings: {
      hooks: {
        UserPromptSubmit: [{
          matcher: "",
          hooks: [{
            type: "command",
            command: "PROMPT=$(cat | jq -r '.prompt // empty'); [ ${#PROMPT} -lt 10000 ] || { echo '{\"block\":true,\"message\":\"Prompt too long (max 10000 chars)\"}' >&2; exit 2; }",
            timeout: 5,
          }],
        }],
      },
    },
  },
  {
    id: "hooks-notification-webhook",
    name: "Notification Webhook",
    nameKo: "알림 웹훅",
    description: "Notification hook that sends alerts to webhook (Slack, Discord).",
    descriptionKo: "Slack/Discord 웹훅으로 알림 전송 Notification 훅.",
    category: "hooks",
    difficulty: 3,
    scope: "project",
    tags: ["hooks.Notification", "WEBHOOK_URL", "curl POST", "Slack/Discord"],
    settings: {
      hooks: {
        Notification: [{
          matcher: "",
          hooks: [{
            type: "command",
            command: '[ -z "${WEBHOOK_URL:-}" ] && exit 0; MSG=$(cat | jq -r \'.message // "Claude notification"\'); curl -s -X POST "${WEBHOOK_URL}" -H "Content-Type: application/json" -d "{\\\"text\\\": \\\"$MSG\\\"}" > /dev/null 2>&1 || true',
            timeout: 10,
          }],
        }],
      },
    },
  },
  {
    id: "hooks-file-changed",
    name: "File Changed Auto-Format",
    nameKo: "파일 변경 시 자동 포맷",
    description: "FileChanged hook that auto-formats files when they change.",
    descriptionKo: "파일 변경 시 자동 포맷 실행 FileChanged 훅.",
    category: "hooks",
    difficulty: 2,
    scope: "project",
    tags: ["hooks.FileChanged", "prettier --write", "자동 포맷"],
    settings: {
      hooks: {
        FileChanged: [{
          matcher: "",
          hooks: [{
            type: "command",
            command: 'FILE=$(cat | jq -r \'.file // empty\'); [ -n "$FILE" ] && npx prettier --write "$FILE" 2>/dev/null || true',
            timeout: 15,
          }],
        }],
      },
    },
  },
  {
    id: "hooks-subagent-control",
    name: "Subagent Spawn Observer",
    nameKo: "서브에이전트 생성 관찰",
    description: "SubagentStart hook that logs subagent spawning (observation only, cannot block).",
    descriptionKo: "서브에이전트 생성을 로깅만 하는 SubagentStart 훅 (관찰 전용, 차단 불가). 차단은 security-block-agents 카드 사용.",
    category: "hooks",
    difficulty: 3,
    scope: "project",
    tags: ["hooks.SubagentStart", "관찰 전용", "로깅", "차단 불가"],
    settings: {
      hooks: {
        SubagentStart: [{
          matcher: "",
          hooks: [{
            type: "command",
            command: 'DATA=$(cat); echo "[$(date \"+%Y-%m-%d %H:%M:%S\")] SUBAGENT_START: $(echo \\"$DATA\\" | jq -r \'.agent_type // \\"unknown\\"\')" >> ~/.claude/subagent-log.txt',
            timeout: 5,
          }],
        }],
      },
    },
  },
  {
    id: "hooks-permission-denied-log",
    name: "Permission Denied Logger",
    nameKo: "권한 거부 로거",
    description: "PermissionDenied hook that logs all permission denials for security audit.",
    descriptionKo: "모든 권한 거부를 로깅하는 보안 감사용 PermissionDenied 훅.",
    category: "hooks",
    difficulty: 2,
    scope: "global",
    tags: ["hooks.PermissionDenied", "보안 감사", "denied-log.txt", "도구명+시간 기록"],
    settings: {
      hooks: {
        PermissionDenied: [{
          matcher: "",
          hooks: [{
            type: "command",
            command: 'DATA=$(cat); TOOL=$(echo "$DATA" | jq -r \'.tool // "unknown"\'); echo "[$(date +%Y-%m-%d\\ %H:%M:%S)] DENIED: $TOOL" >> ~/.claude/denied-log.txt',
            timeout: 5,
          }],
        }],
      },
    },
  },
  {
    id: "hooks-http-webhook",
    name: "HTTP Webhook Hook",
    nameKo: "HTTP 웹훅 훅",
    description: "PostToolUse HTTP hook type — send events to external API endpoint.",
    descriptionKo: "PostToolUse HTTP 훅 타입 — 이벤트를 외부 API로 전송.",
    category: "hooks",
    difficulty: 3,
    scope: "project",
    tags: ["hooks.PostToolUse", "type: http", "POST 요청", "외부 API 연동"],
    settings: {
      hooks: {
        PostToolUse: [{
          matcher: "",
          hooks: [{
            type: "http",
            url: "https://your-api.example.com/claude-events",
            method: "POST",
            headers: { "Authorization": "Bearer ${WEBHOOK_TOKEN}" },
            timeout: 10,
          }],
        }],
      },
    },
  },
  {
    id: "hooks-session-start-setup",
    name: "Session Start Setup",
    nameKo: "세션 시작 설정",
    description: "SessionStart hook that runs project setup on each new Claude session.",
    descriptionKo: "새 Claude 세션마다 프로젝트 초기 설정 실행 SessionStart 훅.",
    category: "hooks",
    difficulty: 2,
    scope: "project",
    tags: ["hooks.SessionStart", "npm install", "env 확인", "프로젝트 초기화"],
    settings: {
      hooks: {
        SessionStart: [{
          matcher: "",
          hooks: [{
            type: "command",
            command: '[ -f package.json ] && [ ! -d node_modules ] && npm install --silent 2>/dev/null; echo "Session initialized in $(pwd)" >&2',
            timeout: 60,
          }],
        }],
      },
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. SKILL ARCHITECT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: "skill-testing",
    name: "Testing Patterns",
    nameKo: "테스트 패턴",
    description: "Skill file for standardized testing patterns with Jest/Vitest.",
    descriptionKo: "Jest/Vitest 표준 테스트 패턴 스킬 파일.",
    category: "skills",
    difficulty: 3,
    scope: "project",
    tags: [".claude/skills/", "SKILL.md", "AAA 패턴", "Jest/Vitest"],
    settings: {},
    extraFiles: [{
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
`,
      description: "Testing patterns skill file",
    }],
  },
  {
    id: "skill-api-design",
    name: "API Design",
    nameKo: "API 설계",
    description: "Skill file for REST API design conventions.",
    descriptionKo: "REST API 설계 규칙 스킬 파일.",
    category: "skills",
    difficulty: 3,
    scope: "project",
    tags: [".claude/skills/", "REST 패턴", "HTTP 메서드", "에러 코드", "Zod 검증"],
    settings: {},
    extraFiles: [{
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

## Error Handling
- 400: Validation error (include field details)
- 401: Not authenticated
- 403: Not authorized
- 404: Resource not found
- 409: Conflict
- 500: Internal error (generic message, log details)

## Validation
- Validate at the boundary (API handler)
- Return all validation errors at once
- Use Zod or similar schema validation
`,
      description: "API design patterns skill file",
    }],
  },
  {
    id: "skill-code-review",
    name: "Code Review Checklist",
    nameKo: "코드 리뷰 체크리스트",
    description: "Skill file defining code review process and checklist.",
    descriptionKo: "코드 리뷰 프로세스 및 체크리스트 스킬 파일.",
    category: "skills",
    difficulty: 2,
    scope: "project",
    tags: [".claude/skills/", "보안/성능/가독성 체크", "PR 리뷰 기준"],
    settings: {},
    extraFiles: [{
      path: ".claude/skills/code-review/SKILL.md",
      content: `---
name: code-review
description: Code review checklist and process
---

# Code Review Checklist

## Security
- [ ] No hardcoded secrets or credentials
- [ ] Input validation on all user input
- [ ] SQL injection / XSS prevention
- [ ] Auth checks on protected routes

## Performance
- [ ] No N+1 queries
- [ ] Proper pagination on list endpoints
- [ ] No unnecessary re-renders (React)
- [ ] Large data sets are streamed/chunked

## Code Quality
- [ ] Functions under 50 lines
- [ ] Single responsibility principle
- [ ] Meaningful variable/function names
- [ ] No dead code or commented-out blocks

## Testing
- [ ] Happy path covered
- [ ] Error cases tested
- [ ] Edge cases identified and tested
`,
      description: "Code review checklist skill file",
    }],
  },
  {
    id: "skill-documentation",
    name: "Documentation Standards",
    nameKo: "문서화 표준",
    description: "Skill file for documentation writing standards.",
    descriptionKo: "문서 작성 표준 스킬 파일.",
    category: "skills",
    difficulty: 2,
    scope: "project",
    tags: [".claude/skills/", "README 구조", "JSDoc/TSDoc", "변경로그"],
    settings: {},
    extraFiles: [{
      path: ".claude/skills/documentation/SKILL.md",
      content: `---
name: documentation
description: Documentation writing standards
---

# Documentation Standards

## README Structure
1. Project name + one-line description
2. Quick start (install, run)
3. Usage examples
4. Configuration reference
5. Contributing guide

## Code Comments
- WHY, not WHAT
- JSDoc for public APIs only
- No obvious comments (\`// increment counter\`)

## Changelog
- Follow Keep a Changelog format
- Group by: Added, Changed, Deprecated, Removed, Fixed, Security

## API Documentation
- Every endpoint: method, path, params, body, response
- Include curl example for each endpoint
- Document error responses
`,
      description: "Documentation standards skill file",
    }],
  },
  {
    id: "skill-refactoring",
    name: "Refactoring Patterns",
    nameKo: "리팩토링 패턴",
    description: "Skill file for safe refactoring techniques.",
    descriptionKo: "안전한 리팩토링 기법 스킬 파일.",
    category: "skills",
    difficulty: 3,
    scope: "project",
    tags: [".claude/skills/", "Extract/Inline/Move", "테스트 우선", "단계적 리팩토링"],
    settings: {},
    extraFiles: [{
      path: ".claude/skills/refactoring/SKILL.md",
      content: `---
name: refactoring
description: Safe refactoring techniques and patterns
---

# Refactoring Patterns

## Principles
- Always have tests before refactoring
- One refactoring at a time, commit after each
- Never change behavior during refactoring

## Common Patterns
- **Extract Function**: >20 lines or repeated logic
- **Extract Component**: React component >100 lines
- **Inline**: One-line wrapper with no value
- **Move**: File in wrong directory for its domain
- **Rename**: Name no longer reflects purpose

## Process
1. Ensure tests pass (green)
2. Make ONE structural change
3. Run tests (should still be green)
4. Commit with "refactor:" prefix
5. Repeat

## Red Flags
- Changing tests during refactoring = behavior change
- Multiple refactorings in one commit
- Refactoring untested code without adding tests first
`,
      description: "Refactoring patterns skill file",
    }],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. MCP INTEGRATOR
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: "mcp-github",
    name: "GitHub",
    nameKo: "GitHub 연동",
    description: "MCP server for GitHub (issues, PRs, repos).",
    descriptionKo: "GitHub MCP 서버 (이슈, PR, 리포지토리).",
    category: "mcp",
    difficulty: 2,
    scope: "project",
    tags: ["mcpServers.github", "@anthropic/mcp-github", "GITHUB_TOKEN"],
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
    name: "Slack",
    nameKo: "Slack 연동",
    description: "MCP server for Slack (messages, channels).",
    descriptionKo: "Slack MCP 서버 (메시지, 채널).",
    category: "mcp",
    difficulty: 2,
    scope: "project",
    tags: ["mcpServers.slack", "@anthropic/mcp-slack", "SLACK_BOT_TOKEN"],
    settings: {
      mcpServers: {
        slack: {
          command: "npx",
          args: ["-y", "@anthropic/mcp-slack"],
          env: { SLACK_BOT_TOKEN: "${SLACK_BOT_TOKEN}", SLACK_TEAM_ID: "${SLACK_TEAM_ID}" },
        },
      },
    },
  },
  {
    id: "mcp-postgres",
    name: "PostgreSQL",
    nameKo: "PostgreSQL 연동",
    description: "MCP server for PostgreSQL database access.",
    descriptionKo: "PostgreSQL 데이터베이스 접근 MCP 서버.",
    category: "mcp",
    difficulty: 2,
    scope: "project",
    tags: ["mcpServers.postgres", "DATABASE_URL"],
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
    name: "Context7 (Docs)",
    nameKo: "Context7 (문서 검색)",
    description: "MCP server for documentation search (libraries, frameworks).",
    descriptionKo: "라이브러리/프레임워크 문서 검색 MCP 서버.",
    category: "mcp",
    difficulty: 2,
    scope: "project",
    tags: ["mcpServers.context7", "env 불필요", "문서 검색"],
    settings: {
      mcpServers: {
        context7: { command: "npx", args: ["-y", "@anthropic/mcp-context7"] },
      },
    },
  },
  {
    id: "mcp-puppeteer",
    name: "Puppeteer (Browser)",
    nameKo: "Puppeteer (브라우저)",
    description: "MCP server for browser automation — screenshots, navigation.",
    descriptionKo: "브라우저 자동화 MCP — 스크린샷, 네비게이션.",
    category: "mcp",
    difficulty: 2,
    scope: "project",
    tags: ["mcpServers.puppeteer", "브라우저 자동화", "스크린샷"],
    settings: {
      mcpServers: {
        puppeteer: { command: "npx", args: ["-y", "@anthropic/mcp-puppeteer"] },
      },
    },
  },
  {
    id: "mcp-filesystem",
    name: "Filesystem",
    nameKo: "파일시스템",
    description: "MCP server for extended filesystem operations.",
    descriptionKo: "확장 파일시스템 작업 MCP 서버.",
    category: "mcp",
    difficulty: 2,
    scope: "project",
    tags: ["mcpServers.filesystem", "확장 파일 작업"],
    settings: {
      mcpServers: {
        filesystem: { command: "npx", args: ["-y", "@anthropic/mcp-filesystem", "."] },
      },
    },
  },
  {
    id: "mcp-sqlite",
    name: "SQLite",
    nameKo: "SQLite 연동",
    description: "MCP server for SQLite database access and queries.",
    descriptionKo: "SQLite 데이터베이스 접근 및 쿼리 MCP 서버.",
    category: "mcp",
    difficulty: 1,
    scope: "project",
    tags: ["mcpServers.sqlite", "DB_PATH 필요", "로컬 DB"],
    settings: {
      mcpServers: {
        sqlite: {
          command: "npx",
          args: ["-y", "@anthropic/mcp-sqlite"],
          env: { DB_PATH: "${DB_PATH}" },
        },
      },
    },
  },
  {
    id: "mcp-sentry",
    name: "Sentry (Error Tracking)",
    nameKo: "Sentry (에러 추적)",
    description: "MCP server for Sentry error tracking integration.",
    descriptionKo: "Sentry 에러 추적 연동 MCP 서버.",
    category: "mcp",
    difficulty: 2,
    scope: "project",
    tags: ["mcpServers.sentry", "SENTRY_AUTH_TOKEN", "에러 조회"],
    settings: {
      mcpServers: {
        sentry: {
          command: "npx",
          args: ["-y", "@anthropic/mcp-sentry"],
          env: { SENTRY_AUTH_TOKEN: "${SENTRY_AUTH_TOKEN}" },
        },
      },
    },
  },
  {
    id: "mcp-linear",
    name: "Linear (Issue Tracking)",
    nameKo: "Linear (이슈 추적)",
    description: "MCP server for Linear project management integration.",
    descriptionKo: "Linear 프로젝트 관리 연동 MCP 서버.",
    category: "mcp",
    difficulty: 2,
    scope: "project",
    tags: ["mcpServers.linear", "LINEAR_API_KEY", "이슈/프로젝트 관리"],
    settings: {
      mcpServers: {
        linear: {
          command: "npx",
          args: ["-y", "@anthropic/mcp-linear"],
          env: { LINEAR_API_KEY: "${LINEAR_API_KEY}" },
        },
      },
    },
  },
  {
    id: "mcp-brave",
    name: "Brave Search",
    nameKo: "Brave 검색",
    description: "MCP server for Brave web search integration.",
    descriptionKo: "Brave 웹 검색 연동 MCP 서버.",
    category: "mcp",
    difficulty: 1,
    scope: "global",
    tags: ["mcpServers.brave", "BRAVE_API_KEY", "웹 검색"],
    settings: {
      mcpServers: {
        brave: {
          command: "npx",
          args: ["-y", "@anthropic/mcp-brave-search"],
          env: { BRAVE_API_KEY: "${BRAVE_API_KEY}" },
        },
      },
    },
  },
  {
    id: "mcp-docker",
    name: "Docker",
    nameKo: "Docker 연동",
    description: "MCP server for Docker container management.",
    descriptionKo: "Docker 컨테이너 관리 MCP 서버.",
    category: "mcp",
    difficulty: 2,
    scope: "project",
    tags: ["mcpServers.docker", "컨테이너 관리", "빌드/실행"],
    settings: {
      mcpServers: {
        docker: {
          command: "npx",
          args: ["-y", "@anthropic/mcp-docker"],
        },
      },
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. CLAUDE.md WRITER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: "claudemd-nextjs",
    name: "Next.js Project",
    nameKo: "Next.js 프로젝트",
    description: "CLAUDE.md template for Next.js + TypeScript projects.",
    descriptionKo: "Next.js + TypeScript 프로젝트용 CLAUDE.md 템플릿.",
    category: "claude-md",
    difficulty: 1,
    scope: "project",
    tags: ["CLAUDE.md", "Next.js", "React", "TypeScript", "Tailwind"],
    settings: {},
    extraFiles: [{
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

## Rules
- Functions under 50 lines
- Single responsibility per component
- Always type API responses
- No \`any\` types
`,
      description: "CLAUDE.md for Next.js projects",
    }],
  },
  {
    id: "claudemd-python",
    name: "Python Project",
    nameKo: "Python 프로젝트",
    description: "CLAUDE.md for Python projects with FastAPI/Django.",
    descriptionKo: "FastAPI/Django Python 프로젝트용 CLAUDE.md.",
    category: "claude-md",
    difficulty: 1,
    scope: "project",
    tags: ["CLAUDE.md", "Python 3.12+", "FastAPI", "pytest", "ruff"],
    settings: {},
    extraFiles: [{
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

## Rules
- Type hints on all function signatures
- Pydantic models for all API I/O
- Async handlers where possible
- No bare \`except:\`
`,
      description: "CLAUDE.md for Python projects",
    }],
  },
  {
    id: "claudemd-go",
    name: "Go Project",
    nameKo: "Go 프로젝트",
    description: "CLAUDE.md for Go projects with standard layout.",
    descriptionKo: "표준 레이아웃 Go 프로젝트용 CLAUDE.md.",
    category: "claude-md",
    difficulty: 1,
    scope: "project",
    tags: ["CLAUDE.md", "Go 1.22+", "Chi/Gin", "pgx", "golangci-lint"],
    settings: {},
    extraFiles: [{
      path: "CLAUDE.md",
      content: `# Project Name

## Stack
- Language: Go 1.22+
- Framework: net/http / Chi / Gin
- DB: PostgreSQL with pgx

## Commands
- \`go run ./cmd/server\` — Run server
- \`go test ./...\` — Run all tests
- \`golangci-lint run\` — Lint

## Rules
- Always check and wrap errors
- Use \`context.Context\` for cancellation
- Interfaces at consumer, not producer
- Table-driven tests
`,
      description: "CLAUDE.md for Go projects",
    }],
  },
  {
    id: "claudemd-react",
    name: "React SPA",
    nameKo: "React SPA",
    description: "CLAUDE.md for React single-page application with Vite.",
    descriptionKo: "Vite 기반 React 단일 페이지 앱 CLAUDE.md.",
    category: "claude-md",
    difficulty: 1,
    scope: "project",
    tags: ["CLAUDE.md", "React 19", "Vite", "Zustand", "React Router"],
    settings: {},
    extraFiles: [{
      path: "CLAUDE.md",
      content: `# Project Name

## Stack
- Frontend: React 19, TypeScript, Vite
- State: Zustand
- Routing: React Router v7
- Styling: Tailwind CSS

## Commands
- \`npm run dev\` — Vite dev server
- \`npm run build\` — Production build
- \`npm run test\` — Vitest
- \`npm run preview\` — Preview build

## Rules
- Functional components only
- Custom hooks for shared logic
- Lazy load route components
- No prop drilling beyond 2 levels — use context or store
`,
      description: "CLAUDE.md for React SPA",
    }],
  },
  {
    id: "claudemd-rust",
    name: "Rust Project",
    nameKo: "Rust 프로젝트",
    description: "CLAUDE.md for Rust projects with Cargo conventions.",
    descriptionKo: "Cargo 규칙 기반 Rust 프로젝트 CLAUDE.md.",
    category: "claude-md",
    difficulty: 1,
    scope: "project",
    tags: ["CLAUDE.md", "Rust", "Cargo", "clippy", "tokio"],
    settings: {},
    extraFiles: [{
      path: "CLAUDE.md",
      content: `# Project Name

## Stack
- Language: Rust (latest stable)
- Async: tokio
- Web: axum / actix-web
- DB: sqlx

## Commands
- \`cargo run\` — Run
- \`cargo test\` — Test
- \`cargo clippy\` — Lint
- \`cargo fmt\` — Format

## Rules
- Handle all Results — no unwrap() in production code
- Use thiserror for custom errors
- Minimize unsafe blocks
- Document public APIs with /// comments
`,
      description: "CLAUDE.md for Rust projects",
    }],
  },
  {
    id: "claudemd-java",
    name: "Java/Spring Boot",
    nameKo: "Java/Spring Boot",
    description: "CLAUDE.md for Java Spring Boot projects.",
    descriptionKo: "Java Spring Boot 프로젝트 CLAUDE.md.",
    category: "claude-md",
    difficulty: 1,
    scope: "project",
    tags: ["CLAUDE.md", "Java 21", "Spring Boot 3", "Gradle", "JUnit 5"],
    settings: {},
    extraFiles: [{
      path: "CLAUDE.md",
      content: `# Project Name

## Stack
- Language: Java 21
- Framework: Spring Boot 3
- Build: Gradle
- DB: Spring Data JPA + PostgreSQL
- Testing: JUnit 5, Mockito

## Commands
- \`./gradlew bootRun\` — Run server
- \`./gradlew test\` — Run tests
- \`./gradlew build\` — Build
- \`./gradlew spotlessApply\` — Format

## Rules
- Constructor injection over field injection
- DTOs for API request/response
- Repository pattern for data access
- Integration tests for controllers
`,
      description: "CLAUDE.md for Java Spring Boot",
    }],
  },
  {
    id: "claudemd-monorepo",
    name: "Monorepo",
    nameKo: "모노레포",
    description: "CLAUDE.md for monorepo with Turborepo/Nx.",
    descriptionKo: "Turborepo/Nx 모노레포 CLAUDE.md.",
    category: "claude-md",
    difficulty: 2,
    scope: "project",
    tags: ["CLAUDE.md", "Turborepo/Nx", "pnpm workspaces", "패키지 구조"],
    settings: {},
    extraFiles: [{
      path: "CLAUDE.md",
      content: `# Monorepo Name

## Stack
- Monorepo: Turborepo / pnpm workspaces
- Frontend: packages/web (Next.js)
- API: packages/api (Express/Fastify)
- Shared: packages/shared (types, utils)

## Commands
- \`pnpm dev\` — Run all packages
- \`pnpm --filter web dev\` — Run specific package
- \`turbo run build\` — Build all
- \`turbo run test\` — Test all

## Rules
- Shared types in packages/shared
- No circular dependencies between packages
- Each package has own tsconfig extending root
- Changes to shared require testing all dependents
`,
      description: "CLAUDE.md for monorepo",
    }],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 7. CI/CD AUTOMATOR
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: "cicd-pr-review",
    name: "PR Review Workflow",
    nameKo: "PR 자동 리뷰",
    description: "GitHub Actions for automatic PR review with Claude Code.",
    descriptionKo: "Claude Code로 자동 PR 리뷰 GitHub Actions.",
    category: "cicd",
    difficulty: 3,
    scope: "project",
    tags: [".github/workflows/", "pull_request 트리거", "ANTHROPIC_API_KEY", "보안/성능/품질"],
    settings: {},
    extraFiles: [{
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
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Claude Review
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          npx @anthropic-ai/claude-code -p \\
            "Review this PR. Focus on: security, performance, code quality, error handling."
`,
      description: "PR review workflow",
    }],
  },
  {
    id: "cicd-auto-fix",
    name: "Auto Fix on Issue",
    nameKo: "이슈 자동 수정",
    description: "GitHub Actions that auto-fixes issues labeled 'claude-fix'.",
    descriptionKo: "'claude-fix' 라벨 이슈 자동 수정 워크플로우.",
    category: "cicd",
    difficulty: 3,
    scope: "project",
    tags: [".github/workflows/", "issues.labeled", "claude-fix 라벨", "자동 PR 생성"],
    settings: {},
    extraFiles: [{
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
      - name: Claude Fix
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          git checkout -b fix/issue-\${{ github.event.issue.number }}
          npx @anthropic-ai/claude-code -p \\
            "Fix issue #\${{ github.event.issue.number }}: \${{ github.event.issue.title }}"
          git add -A && git commit -m "fix: #\${{ github.event.issue.number }}"
          git push origin fix/issue-\${{ github.event.issue.number }}
          gh pr create --title "Fix #\${{ github.event.issue.number }}" --base main
`,
      description: "Auto-fix workflow",
    }],
  },
  {
    id: "cicd-lint-test",
    name: "Lint + Test Pipeline",
    nameKo: "린트 + 테스트 파이프라인",
    description: "CI workflow running Claude Code for lint fixes and test generation.",
    descriptionKo: "Claude Code로 린트 수정 + 테스트 생성 CI 워크플로우.",
    category: "cicd",
    difficulty: 2,
    scope: "project",
    tags: [".github/workflows/", "push 트리거", "lint fix", "test 생성"],
    settings: {},
    extraFiles: [{
      path: ".github/workflows/claude-lint-test.yml",
      content: `name: Claude Lint & Test
on:
  push:
    branches: [main, develop]
jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - name: Lint Check
        run: npm run lint 2>&1 | tee lint-output.txt || true
      - name: Claude Fix Lints
        if: failure()
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          npx @anthropic-ai/claude-code -p \\
            "Fix lint errors from lint-output.txt. Only fix, don't add features."
`,
      description: "Lint + test CI workflow",
    }],
  },
  {
    id: "cicd-deploy-preview",
    name: "Deploy Preview",
    nameKo: "배포 프리뷰",
    description: "Claude generates deploy preview summary and checks before deployment.",
    descriptionKo: "배포 전 Claude가 변경사항 요약 및 안전성 체크.",
    category: "cicd",
    difficulty: 2,
    scope: "project",
    tags: [".github/workflows/", "deployment 체크", "변경 요약", "안전성 검증"],
    settings: {},
    extraFiles: [{
      path: ".github/workflows/claude-deploy-check.yml",
      content: `name: Claude Deploy Check
on:
  pull_request:
    types: [labeled]
    branches: [main]
jobs:
  check:
    if: github.event.label.name == 'deploy'
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Claude Deploy Check
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          npx @anthropic-ai/claude-code -p \\
            "Analyze changes for deployment safety: \\
             1. Breaking API changes? \\
             2. Database migration needed? \\
             3. Environment variables changed? \\
             4. Performance impact? \\
             Post summary as PR comment."
`,
      description: "Deploy preview check workflow",
    }],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 8. AGENT DESIGNER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: "agent-code-reviewer",
    name: "Code Reviewer",
    nameKo: "코드 리뷰어",
    description: "Sub-agent for automated code review (security, performance, quality).",
    descriptionKo: "보안/성능/품질 자동 코드 리뷰 서브에이전트.",
    category: "agents",
    difficulty: 3,
    scope: "project",
    tags: [".claude/agents/", "model: sonnet", "4관점 리뷰", "CRITICAL/WARNING/SUGGESTION"],
    settings: {},
    extraFiles: [{
      path: ".claude/agents/code-reviewer.md",
      content: `---
name: code-reviewer
description: Code review agent — security, performance, quality, accessibility
model: sonnet
tools: [Read, Glob, Grep]
disallowedTools: [Write, Edit, Bash, Agent]
permissionMode: plan
maxTurns: 15
effort: high
color: blue
---

# Code Reviewer

Review from 4 perspectives:

## 1. Security
- Injection vulnerabilities
- Auth/authz gaps
- Secret exposure
- Input validation

## 2. Performance
- N+1 queries
- Memory leaks
- Unnecessary re-renders

## 3. Quality
- Naming, complexity
- Testability, SRP

## 4. Accessibility
- Keyboard nav, ARIA
- Color contrast

Output: [CRITICAL] / [WARNING] / [SUGGESTION]
`,
      description: "Code reviewer agent",
    }],
  },
  {
    id: "agent-test-writer",
    name: "Test Writer",
    nameKo: "테스트 작성자",
    description: "Sub-agent that generates comprehensive tests for existing code.",
    descriptionKo: "기존 코드의 포괄적 테스트 생성 서브에이전트.",
    category: "agents",
    difficulty: 3,
    scope: "project",
    tags: [".claude/agents/", "model: sonnet", "커버리지 타겟", "anti-pattern 방지"],
    settings: {},
    extraFiles: [{
      path: ".claude/agents/test-writer.md",
      content: `---
name: test-writer
description: Generates comprehensive tests for existing code
model: sonnet
tools: [Read, Write, Glob, Grep, Bash]
disallowedTools: [Agent]
permissionMode: acceptEdits
maxTurns: 25
effort: high
color: green
---

# Test Writer

## Process
1. Read target file, understand interface
2. Identify all code paths
3. Generate test file with coverage
4. Run tests to verify

## Coverage
- All exported functions
- Error handling paths
- Edge cases (empty, null, boundary)

## Anti-patterns to Avoid
- Testing implementation details
- Brittle assertions on exact strings
- Tests that depend on order
- Mocking the module under test
`,
      description: "Test writer agent",
    }],
  },
  {
    id: "agent-security-auditor",
    name: "Security Auditor",
    nameKo: "보안 감사자",
    description: "Sub-agent for security auditing — vulnerabilities, deps, auth.",
    descriptionKo: "보안 감사 서브에이전트 — 취약점, 의존성, 인증.",
    category: "agents",
    difficulty: 3,
    scope: "project",
    tags: [".claude/agents/", "model: opus", "CVE 체크", "5영역 감사"],
    settings: {},
    extraFiles: [{
      path: ".claude/agents/security-auditor.md",
      content: `---
name: security-auditor
description: Security audit — vulnerabilities, dependencies, auth flows
model: opus
tools: [Read, Glob, Grep, Bash]
disallowedTools: [Write, Edit, Agent]
permissionMode: plan
maxTurns: 20
effort: high
color: red
---

# Security Auditor

## 1. Dependency Audit
- npm audit / pip audit
- Known CVEs, outdated packages

## 2. Code Vulnerabilities
- SQL/NoSQL/command injection
- XSS, path traversal

## 3. Auth & Authorization
- Session management
- CSRF, access control

## 4. Secrets & Config
- Hardcoded credentials
- .env in git, permissive CORS

## 5. Infrastructure
- HTTP endpoints, security headers

Output: severity-ranked findings with remediation.
`,
      description: "Security auditor agent",
    }],
  },
  {
    id: "agent-docs-writer",
    name: "Documentation Writer",
    nameKo: "문서 작성자",
    description: "Sub-agent that generates comprehensive documentation from code.",
    descriptionKo: "코드에서 포괄적 문서를 생성하는 서브에이전트.",
    category: "agents",
    difficulty: 2,
    scope: "project",
    tags: [".claude/agents/", "model: sonnet", "README/API/가이드 생성"],
    settings: {},
    extraFiles: [{
      path: ".claude/agents/docs-writer.md",
      content: `---
name: docs-writer
description: Generates documentation from code analysis
model: sonnet
tools: [Read, Write, Glob, Grep]
disallowedTools: [Bash, Agent]
permissionMode: acceptEdits
maxTurns: 20
effort: medium
color: cyan
---

# Documentation Writer

## Process
1. Scan project structure
2. Identify public APIs and exports
3. Generate docs with examples

## Output Types
- README.md — project overview + quickstart
- API.md — endpoint documentation
- ARCHITECTURE.md — system design overview
- CONTRIBUTING.md — dev setup + guidelines

## Style
- Concrete examples over abstract descriptions
- Include curl commands for APIs
- Diagrams using Mermaid markdown
`,
      description: "Documentation writer agent",
    }],
  },
  {
    id: "agent-migration",
    name: "Migration Assistant",
    nameKo: "마이그레이션 어시스턴트",
    description: "Sub-agent for framework/library migration planning and execution.",
    descriptionKo: "프레임워크/라이브러리 마이그레이션 계획 및 실행 서브에이전트.",
    category: "agents",
    difficulty: 3,
    scope: "project",
    tags: [".claude/agents/", "model: opus", "영향 분석", "단계적 마이그레이션"],
    settings: {},
    extraFiles: [{
      path: ".claude/agents/migration-assistant.md",
      content: `---
name: migration-assistant
description: Framework/library migration planning and execution
model: opus
tools: [Read, Write, Edit, Glob, Grep, Bash]
disallowedTools: [Agent]
permissionMode: auto
maxTurns: 30
effort: high
isolation: worktree
color: orange
---

# Migration Assistant

## Process
1. Analyze current usage of target library/framework
2. Map API differences (old → new)
3. Identify breaking changes
4. Create migration plan with phases
5. Execute changes file by file
6. Run tests after each phase

## Principles
- Never break existing functionality
- One file at a time, test after each
- Keep backward compatibility shims temporary
- Update imports, types, and tests together
`,
      description: "Migration assistant agent",
    }],
  },
  {
    id: "agent-performance",
    name: "Performance Analyzer",
    nameKo: "성능 분석기",
    description: "Sub-agent that finds and fixes performance bottlenecks.",
    descriptionKo: "성능 병목 발견 및 수정 서브에이전트.",
    category: "agents",
    difficulty: 3,
    scope: "project",
    tags: [".claude/agents/", "model: sonnet", "N+1 탐지", "번들 분석", "메모리 누수"],
    settings: {},
    extraFiles: [{
      path: ".claude/agents/performance-analyzer.md",
      content: `---
name: performance-analyzer
description: Finds and fixes performance bottlenecks
model: sonnet
tools: [Read, Glob, Grep, Bash]
disallowedTools: [Write, Edit, Agent]
permissionMode: plan
maxTurns: 15
effort: high
color: yellow
---

# Performance Analyzer

## Checks
- N+1 queries (ORM usage patterns)
- Large bundle imports (tree-shaking issues)
- Unnecessary re-renders (React)
- Missing indexes on DB queries
- Synchronous I/O in async context
- Memory leaks (event listeners, timers)

## Process
1. Profile — identify slow paths
2. Measure — baseline metrics
3. Optimize — minimal targeted change
4. Verify — compare before/after
`,
      description: "Performance analyzer agent",
    }],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 9. MODEL CONFIG (NEW)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: "model-opus",
    name: "Opus — Maximum Quality",
    nameKo: "Opus — 최고 품질",
    description: "Use Claude Opus for complex reasoning and high-quality output.",
    descriptionKo: "복잡한 추론과 고품질 출력을 위한 Claude Opus 설정.",
    category: "model",
    difficulty: 1,
    scope: "global",
    tags: ["model: claude-opus-4-6", "effortLevel: high", "최고 품질"],
    settings: {
      model: "claude-opus-4-6",
      effortLevel: "high",
    },
  },
  {
    id: "model-sonnet",
    name: "Sonnet — Balanced Speed",
    nameKo: "Sonnet — 균형 속도",
    description: "Use Claude Sonnet for balanced speed and quality.",
    descriptionKo: "속도와 품질의 균형을 위한 Claude Sonnet 설정.",
    category: "model",
    difficulty: 1,
    scope: "global",
    tags: ["model: claude-sonnet-4-6", "effortLevel: medium", "균형 모드"],
    settings: {
      model: "claude-sonnet-4-6",
      effortLevel: "medium",
    },
  },
  {
    id: "model-haiku",
    name: "Haiku — Fast & Light",
    nameKo: "Haiku — 빠른 경량",
    description: "Use Claude Haiku for fast, lightweight operations.",
    descriptionKo: "빠르고 가벼운 작업을 위한 Claude Haiku 설정.",
    category: "model",
    difficulty: 1,
    scope: "global",
    tags: ["model: claude-haiku-4-5", "effortLevel: low", "빠른 응답"],
    settings: {
      model: "claude-haiku-4-5-20251001",
      effortLevel: "low",
    },
  },
  {
    id: "model-overrides",
    name: "Model Overrides (Subagent Routing)",
    nameKo: "모델 오버라이드 (서브에이전트 라우팅)",
    description: "Route different subagents to different models for cost optimization.",
    descriptionKo: "비용 최적화를 위한 서브에이전트별 모델 라우팅.",
    category: "model",
    difficulty: 2,
    scope: "project",
    tags: ["modelOverrides", "code-reviewer→haiku", "security→opus", "비용 최적화"],
    settings: {
      model: "claude-sonnet-4-6",
      modelOverrides: {
        "code-reviewer": "claude-haiku-4-5-20251001",
        "test-writer": "claude-haiku-4-5-20251001",
        "security-auditor": "claude-opus-4-6",
        "migration-assistant": "claude-opus-4-6",
      },
    },
  },
  {
    id: "model-available-models",
    name: "Available Models Whitelist",
    nameKo: "사용 가능 모델 화이트리스트",
    description: "Restrict which models users can select in the UI.",
    descriptionKo: "UI에서 선택 가능한 모델을 제한.",
    category: "model",
    difficulty: 1,
    scope: "global",
    tags: ["availableModels", "모델 제한", "팀 정책"],
    settings: {
      availableModels: [
        "claude-opus-4-6",
        "claude-sonnet-4-6",
        "claude-haiku-4-5-20251001",
      ],
    },
  },
  {
    id: "model-thinking-always",
    name: "Always Thinking Mode",
    nameKo: "상시 씽킹 모드",
    description: "Enable always-on thinking for deeper reasoning on every prompt.",
    descriptionKo: "모든 프롬프트에 대한 깊은 추론을 위한 상시 씽킹 모드.",
    category: "model",
    difficulty: 1,
    scope: "global",
    tags: ["alwaysThinkingEnabled: true", "깊은 추론", "사고 과정 표시"],
    settings: {
      alwaysThinkingEnabled: true,
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 10. ENVIRONMENT VARIABLES (NEW)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: "env-telemetry-off",
    name: "Disable Telemetry",
    nameKo: "텔레메트리 비활성화",
    description: "Turn off telemetry and error reporting for privacy.",
    descriptionKo: "개인정보 보호를 위한 텔레메트리/에러 리포팅 비활성화.",
    category: "env",
    difficulty: 1,
    scope: "global",
    tags: ["DISABLE_TELEMETRY: 1", "DISABLE_ERROR_REPORTING: 1", "개인정보 보호"],
    settings: {
      env: {
        DISABLE_TELEMETRY: "1",
        DISABLE_ERROR_REPORTING: "1",
      },
    },
  },
  {
    id: "env-timeout",
    name: "Timeout Configuration",
    nameKo: "타임아웃 설정",
    description: "Configure bash and API timeout limits.",
    descriptionKo: "Bash 및 API 타임아웃 제한 설정.",
    category: "env",
    difficulty: 1,
    scope: "global",
    tags: ["BASH_DEFAULT_TIMEOUT_MS: 120s", "BASH_MAX_TIMEOUT_MS: 600s", "API_TIMEOUT_MS: 600s"],
    settings: {
      env: {
        BASH_DEFAULT_TIMEOUT_MS: "120000",
        BASH_MAX_TIMEOUT_MS: "600000",
        API_TIMEOUT_MS: "600000",
      },
    },
  },
  {
    id: "env-concurrency",
    name: "Concurrency Control",
    nameKo: "동시성 제어",
    description: "Control tool use concurrency and MCP token limits.",
    descriptionKo: "도구 사용 동시성 및 MCP 토큰 제한 제어.",
    category: "env",
    difficulty: 2,
    scope: "global",
    tags: ["MAX_TOOL_USE_CONCURRENCY: 10", "MAX_MCP_OUTPUT_TOKENS: 50000", "동시 실행 제어"],
    settings: {
      env: {
        CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY: "10",
        MAX_MCP_OUTPUT_TOKENS: "50000",
      },
    },
  },
  {
    id: "env-full-master",
    name: "Full Environment Master",
    nameKo: "전체 환경변수 마스터",
    description: "Comprehensive environment variable configuration for all settings.",
    descriptionKo: "모든 설정을 위한 포괄적 환경변수 설정.",
    category: "env",
    difficulty: 2,
    scope: "global",
    tags: ["env ×7", "텔레메트리 끔", "타임아웃", "동시성", "MCP 토큰"],
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
  {
    id: "env-proxy",
    name: "Proxy Configuration",
    nameKo: "프록시 설정",
    description: "HTTP/HTTPS proxy settings for corporate environments.",
    descriptionKo: "기업 환경용 HTTP/HTTPS 프록시 설정.",
    category: "env",
    difficulty: 2,
    scope: "global",
    tags: ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "기업 환경"],
    settings: {
      env: {
        HTTP_PROXY: "http://proxy.company.com:8080",
        HTTPS_PROXY: "http://proxy.company.com:8080",
        NO_PROXY: "localhost,127.0.0.1,.company.com",
      },
    },
  },
  {
    id: "env-api-config",
    name: "API Configuration",
    nameKo: "API 설정",
    description: "API key, max tokens, temperature for custom API usage.",
    descriptionKo: "커스텀 API 사용을 위한 API 키, 최대 토큰, 온도 설정.",
    category: "env",
    difficulty: 2,
    scope: "global",
    tags: ["apiKey", "maxTokens: 4096", "temperature: 0", "systemPrompt"],
    settings: {
      maxTokens: 4096,
      temperature: 0,
      systemPrompt: "You are a helpful coding assistant. Follow the project conventions strictly.",
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 11. UI / UX (NEW)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: "ui-vim-mode",
    name: "Vim Mode",
    nameKo: "Vim 모드",
    description: "Enable vim keybindings in Claude Code editor.",
    descriptionKo: "Claude Code 에디터에서 Vim 키바인딩 활성화.",
    category: "ui",
    difficulty: 1,
    scope: "global",
    tags: ["editorMode: vim", "Vim 키바인딩"],
    settings: {
      editorMode: "vim",
    },
  },
  {
    id: "ui-progress-bar",
    name: "Progress Bar + Duration",
    nameKo: "진행 바 + 소요시간",
    description: "Show terminal progress bar and turn duration.",
    descriptionKo: "터미널 진행 바 및 턴 소요시간 표시.",
    category: "ui",
    difficulty: 1,
    scope: "global",
    tags: ["terminalProgressBarEnabled", "showTurnDuration", "UX 개선"],
    settings: {
      terminalProgressBarEnabled: true,
      showTurnDuration: true,
    },
  },
  {
    id: "ui-ide-auto",
    name: "IDE Auto-Connect",
    nameKo: "IDE 자동 연결",
    description: "Auto-connect and install IDE extensions (VS Code, JetBrains).",
    descriptionKo: "IDE 확장 자동 연결 및 설치 (VS Code, JetBrains).",
    category: "ui",
    difficulty: 1,
    scope: "global",
    tags: ["autoConnectIde", "autoInstallIdeExtension", "VS Code/JetBrains"],
    settings: {
      autoConnectIde: true,
      autoInstallIdeExtension: true,
    },
  },
  {
    id: "ui-teammate-tmux",
    name: "Teammate Mode — tmux",
    nameKo: "팀메이트 모드 — tmux",
    description: "Use tmux for teammate/subagent sessions.",
    descriptionKo: "팀메이트/서브에이전트 세션에 tmux 사용.",
    category: "ui",
    difficulty: 2,
    scope: "global",
    tags: ["teammateMode: tmux", "서브에이전트 세션 분리"],
    settings: {
      teammateMode: "tmux",
    },
  },
  {
    id: "ui-output-json",
    name: "JSON Output Format",
    nameKo: "JSON 출력 형식",
    description: "Set output format to JSON for programmatic usage.",
    descriptionKo: "프로그래밍 사용을 위한 JSON 출력 형식 설정.",
    category: "ui",
    difficulty: 2,
    scope: "project",
    tags: ["outputFormat: json", "프로그래밍 연동"],
    settings: {
      outputFormat: "json",
    },
  },
  {
    id: "ui-context-compression",
    name: "Context Compression",
    nameKo: "컨텍스트 압축",
    description: "Enable context compression for longer sessions.",
    descriptionKo: "긴 세션을 위한 컨텍스트 압축 활성화.",
    category: "ui",
    difficulty: 1,
    scope: "global",
    tags: ["contextCompression: true", "긴 세션 최적화"],
    settings: {
      contextCompression: true,
    },
  },
  {
    id: "ui-auto-update-beta",
    name: "Auto Update — Beta Channel",
    nameKo: "자동 업데이트 — 베타 채널",
    description: "Receive beta updates for latest features.",
    descriptionKo: "최신 기능을 위한 베타 채널 자동 업데이트.",
    category: "ui",
    difficulty: 1,
    scope: "global",
    tags: ["autoUpdatesChannel: beta", "최신 기능"],
    settings: {
      autoUpdatesChannel: "beta",
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 12. CONFIG OPTIMIZER (통합 프리셋)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: "config-full-global",
    name: "Full Global Setup",
    nameKo: "풀 글로벌 설정",
    description: "Complete global settings with security, hooks, and optimization.",
    descriptionKo: "보안, 훅, 최적화 통합 글로벌 설정.",
    category: "optimization",
    difficulty: 1,
    scope: "global",
    tags: ["permissions", "hooks.Stop", "env.DISABLE_TELEMETRY", "~/.ssh 차단", "git check"],
    settings: {
      env: { DISABLE_TELEMETRY: "1" },
      permissions: {
        allow: ["Skill"],
        deny: [
          "Read(~/.ssh/**)", "Read(~/.aws/**)", "Read(~/.gnupg/**)",
          "Edit(~/.bashrc)", "Edit(~/.zshrc)",
        ],
      },
      hooks: {
        Stop: [{
          matcher: "",
          hooks: [{ type: "command", command: "~/.claude/stop-hook-git-check.sh" }],
        }],
      },
    },
  },
  {
    id: "config-full-project",
    name: "Full Project Setup",
    nameKo: "풀 프로젝트 설정",
    description: "Complete project settings with permissions, branch protection, auto-lint.",
    descriptionKo: "권한, 브랜치 보호, 자동 린트 통합 프로젝트 설정.",
    category: "optimization",
    difficulty: 2,
    scope: "project",
    tags: ["permissions", "hooks.PreToolUse", "hooks.PostToolUse", "main 보호", "auto-lint"],
    settings: {
      permissions: {
        allow: ["Edit(*)", "Write(*)", "Bash(npm run *)", "Bash(git *)"],
        deny: ["Read(.env)", "Read(.env.*)", "Read(./secrets/**)"],
      },
      hooks: {
        PreToolUse: [{
          matcher: "Edit|Write",
          hooks: [{
            type: "command",
            command: '[ "$(git branch --show-current 2>/dev/null)" != "main" ] || { echo \'{"block":true,"message":"main 편집 금지"}\' >&2; exit 2; }',
            timeout: 5,
          }],
        }],
        PostToolUse: [{
          matcher: "Write|Edit",
          hooks: [{
            type: "command",
            command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/auto-lint.sh',
            timeout: 30,
          }],
        }],
      },
    },
  },
  {
    id: "config-worktree",
    name: "Worktree Settings",
    nameKo: "Worktree 설정",
    description: "Worktree with symlink directories and sparse paths for monorepos.",
    descriptionKo: "모노레포용 symlink + sparse 경로 Worktree 설정.",
    category: "optimization",
    difficulty: 2,
    scope: "project",
    tags: ["worktree.symlinkDirectories", "worktree.sparsePaths", "모노레포"],
    settings: {
      worktree: {
        symlinkDirectories: ["node_modules", ".cache", "dist"],
        sparsePaths: ["packages/my-app", "shared/utils"],
      },
    },
  },
  {
    id: "config-attribution",
    name: "Attribution Settings",
    nameKo: "어트리뷰션 설정",
    description: "Configure commit and PR attribution for Claude contributions.",
    descriptionKo: "Claude 기여 커밋/PR 어트리뷰션 설정.",
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
  {
    id: "config-cleanup",
    name: "Auto Cleanup",
    nameKo: "자동 정리",
    description: "Configure automatic cleanup period for old sessions.",
    descriptionKo: "오래된 세션 자동 정리 기간 설정.",
    category: "optimization",
    difficulty: 1,
    scope: "global",
    tags: ["cleanupPeriodDays: 30", "자동 정리"],
    settings: {
      cleanupPeriodDays: 30,
    },
  },
  {
    id: "config-max-performance",
    name: "Maximum Performance Preset",
    nameKo: "최대 성능 프리셋",
    description: "All performance optimizations combined: fast model, telemetry off, compression on.",
    descriptionKo: "모든 성능 최적화 통합: 빠른 모델, 텔레메트리 끔, 압축 켬.",
    category: "optimization",
    difficulty: 1,
    scope: "global",
    tags: ["model: sonnet", "effortLevel: low", "contextCompression", "telemetry off", "속도 우선"],
    settings: {
      model: "claude-sonnet-4-6",
      effortLevel: "low",
      contextCompression: true,
      env: {
        DISABLE_TELEMETRY: "1",
        DISABLE_ERROR_REPORTING: "1",
      },
    },
  },
  {
    id: "config-max-quality",
    name: "Maximum Quality Preset",
    nameKo: "최대 품질 프리셋",
    description: "All quality settings combined: Opus, high effort, always thinking.",
    descriptionKo: "모든 품질 설정 통합: Opus, high effort, 상시 thinking.",
    category: "optimization",
    difficulty: 1,
    scope: "global",
    tags: ["model: opus", "effortLevel: high", "alwaysThinking", "품질 우선"],
    settings: {
      model: "claude-opus-4-6",
      effortLevel: "high",
      alwaysThinkingEnabled: true,
    },
  },
];

export function getTemplateById(id: string): Template | undefined {
  return templates.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: TemplateCategory): Template[] {
  return templates.filter((t) => t.category === category);
}

export const categoryLabels: Record<TemplateCategory, { name: string; nameKo: string; icon: string }> = {
  security: { name: "Security Guard", nameKo: "보안 가드", icon: "Shield" },
  permissions: { name: "Permissions", nameKo: "권한 설정", icon: "Lock" },
  hooks: { name: "Hook Engineer", nameKo: "훅 엔지니어", icon: "Webhook" },
  skills: { name: "Skill Architect", nameKo: "스킬 아키텍트", icon: "BookOpen" },
  mcp: { name: "MCP Integrator", nameKo: "MCP 통합", icon: "Plug" },
  "claude-md": { name: "CLAUDE.md Writer", nameKo: "CLAUDE.md 작성자", icon: "FileText" },
  cicd: { name: "CI/CD Automator", nameKo: "CI/CD 자동화", icon: "GitBranch" },
  agents: { name: "Agent Designer", nameKo: "에이전트 설계자", icon: "Bot" },
  model: { name: "Model Config", nameKo: "모델 설정", icon: "Cpu" },
  env: { name: "Environment", nameKo: "환경변수", icon: "Terminal" },
  ui: { name: "UI / UX", nameKo: "UI / UX", icon: "Monitor" },
  optimization: { name: "Config Optimizer", nameKo: "설정 최적화", icon: "Zap" },
};
