import type { ClaudeSettings } from "@/lib/settings-schema";

export interface GovernancePolicy {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  settings: Partial<ClaudeSettings>;
}

export const GOVERNANCE_POLICIES: GovernancePolicy[] = [
  {
    id: "agent-depth-limit",
    name: "Agent Depth Limit",
    nameKo: "에이전트 깊이 제한",
    description: "Limit agent nesting depth to 3 levels",
    descriptionKo: "서브에이전트 호출 깊이를 최대 3단계로 제한",
    settings: {
      hooks: {
        SubagentStart: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command:
                  "DEPTH=$(cat | jq -r '.depth // 0'); [ $DEPTH -lt 3 ] || { echo '{\"block\":true,\"message\":\"Max agent depth exceeded\"}' >&2; exit 2; }",
                timeout: 5,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "agent-concurrency-limit",
    name: "Agent Concurrency Limit",
    nameKo: "동시 에이전트 수 제한",
    description: "Limit concurrent agents to 5",
    descriptionKo: "동시 실행 에이전트를 최대 5개로 제한",
    settings: {
      hooks: {
        SubagentStart: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command:
                  "COUNT=$(pgrep -f 'claude.*agent' | wc -l); [ $COUNT -lt 5 ] || { echo '{\"block\":true,\"message\":\"Max 5 concurrent agents\"}' >&2; exit 2; }",
                timeout: 5,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "agent-audit-logging",
    name: "Agent Audit Logging",
    nameKo: "에이전트 감사 로깅",
    description: "Log all agent start/stop/turn events",
    descriptionKo: "모든 에이전트 활동을 .claude/agent-audit.log에 기록",
    settings: {
      hooks: {
        SubagentStart: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command:
                  "echo \"[$(date -Iseconds)] START $(cat | jq -r '.agent_name')\" >> .claude/agent-audit.log",
                timeout: 3,
              },
            ],
          },
        ],
        SubagentStop: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command:
                  "echo \"[$(date -Iseconds)] STOP $(cat | jq -r '.agent_name')\" >> .claude/agent-audit.log",
                timeout: 3,
              },
            ],
          },
        ],
        SubagentTurn: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command:
                  "echo \"[$(date -Iseconds)] TURN $(cat | jq -r '.agent_name') #$(cat | jq -r '.turn_number')\" >> .claude/agent-audit.log",
                timeout: 3,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "destructive-command-block",
    name: "Destructive Command Block",
    nameKo: "파괴적 명령 차단",
    description: "Block dangerous shell commands across all agents",
    descriptionKo: "rm -rf, DROP DATABASE, force push 등 위험 명령을 전역 차단",
    settings: {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command:
                  "CMD=$(cat | jq -r '.tool_input.command // empty'); echo \"$CMD\" | grep -qE '(rm -rf /|DROP DATABASE|TRUNCATE TABLE|git push --force|git reset --hard|:(){ :|:& };:)' && { echo '{\"block\":true,\"message\":\"Destructive command blocked by governance policy\"}' >&2; exit 2; } || exit 0",
                timeout: 5,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "orchestrator-only-agent-calls",
    name: "Orchestrator-Only Agent Calls",
    nameKo: "오케스트레이터 전용 에이전트 호출",
    description: "Only orchestrator agents can spawn sub-agents",
    descriptionKo: "오케스트레이터 역할의 에이전트만 서브에이전트를 호출 가능",
    settings: {
      permissions: {
        deny: ["Agent(*)"],
      },
    },
  },
  {
    id: "full-governance-bundle",
    name: "Full Governance Bundle",
    nameKo: "전체 거버넌스 번들",
    description: "Depth limit + concurrency limit + audit logging + destructive block",
    descriptionKo: "깊이 제한 + 동시 수 제한 + 감사 로깅 + 파괴적 명령 차단을 모두 적용",
    settings: {
      hooks: {
        SubagentStart: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command:
                  "DEPTH=$(cat | jq -r '.depth // 0'); [ $DEPTH -lt 3 ] || { echo '{\"block\":true,\"message\":\"Max agent depth exceeded\"}' >&2; exit 2; }",
                timeout: 5,
              },
              {
                type: "command",
                command:
                  "COUNT=$(pgrep -f 'claude.*agent' | wc -l); [ $COUNT -lt 5 ] || { echo '{\"block\":true,\"message\":\"Max 5 concurrent agents\"}' >&2; exit 2; }",
                timeout: 5,
              },
              {
                type: "command",
                command:
                  "echo \"[$(date -Iseconds)] START $(cat | jq -r '.agent_name')\" >> .claude/agent-audit.log",
                timeout: 3,
              },
            ],
          },
        ],
        SubagentStop: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command:
                  "echo \"[$(date -Iseconds)] STOP $(cat | jq -r '.agent_name')\" >> .claude/agent-audit.log",
                timeout: 3,
              },
            ],
          },
        ],
        SubagentTurn: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command:
                  "echo \"[$(date -Iseconds)] TURN $(cat | jq -r '.agent_name') #$(cat | jq -r '.turn_number')\" >> .claude/agent-audit.log",
                timeout: 3,
              },
            ],
          },
        ],
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command:
                  "CMD=$(cat | jq -r '.tool_input.command // empty'); echo \"$CMD\" | grep -qE '(rm -rf /|DROP DATABASE|TRUNCATE TABLE|git push --force|git reset --hard)' && { echo '{\"block\":true,\"message\":\"Destructive command blocked\"}' >&2; exit 2; } || exit 0",
                timeout: 5,
              },
            ],
          },
        ],
      },
    },
  },
];

export function getPolicyById(id: string): GovernancePolicy | undefined {
  return GOVERNANCE_POLICIES.find((p) => p.id === id);
}
