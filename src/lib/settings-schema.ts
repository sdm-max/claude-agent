export interface HookCommand {
  type: "command";
  command: string;
  timeout?: number;
}

export interface HookRule {
  matcher?: string;
  hooks: HookCommand[];
}

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface ClaudeSettings {
  model?: string;
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  env?: Record<string, string>;
  hooks?: {
    PreToolUse?: HookRule[];
    PostToolUse?: HookRule[];
    Notification?: HookRule[];
    Stop?: HookRule[];
    SessionStart?: HookRule[];
  };
  sandbox?: {
    type?: "docker" | "none";
    container?: string;
  };
  mcpServers?: Record<string, McpServerConfig>;
  apiKey?: string;
  systemPrompt?: string;
  maxTurns?: number;
}

export const HOOK_EVENTS = [
  "PreToolUse",
  "PostToolUse",
  "Notification",
  "Stop",
  "SessionStart",
] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number];

export const MODEL_OPTIONS = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
] as const;

export const SANDBOX_TYPES = [
  { value: "docker", label: "Docker" },
  { value: "none", label: "None" },
] as const;

export function getDefaultSettings(): ClaudeSettings {
  return {};
}
