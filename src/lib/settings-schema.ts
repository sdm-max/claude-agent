// ─── Hook Types ───

export interface HookCommand {
  type: "command";
  command: string;
  timeout?: number;
}

export interface HookHttp {
  type: "http";
  url: string;
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface HookPrompt {
  type: "prompt";
  prompt: string;
  timeout?: number;
}

export interface HookAgent {
  type: "agent";
  agent: string;
  timeout?: number;
}

export type HookEntry = HookCommand | HookHttp | HookPrompt | HookAgent;

export interface HookRule {
  matcher?: string;
  hooks: HookEntry[];
}

// ─── MCP Types ───

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
  oauth?: {
    clientId?: string;
    clientSecret?: string;
    authServerMetadataUrl?: string;
  };
  headersHelper?: {
    command: string;
    args?: string[];
  };
}

// ─── Sandbox Types ───

export interface SandboxFilesystem {
  allowWrite?: string[];
  denyWrite?: string[];
  allowRead?: string[];
  denyRead?: string[];
  allowManagedReadPathsOnly?: boolean;
}

export interface SandboxNetwork {
  allowedDomains?: string[];
  allowManagedDomainsOnly?: boolean;
  allowUnixSockets?: string[];
  allowAllUnixSockets?: boolean;
  allowLocalBinding?: boolean;
  allowMachLookup?: string[];
  httpProxyPort?: number;
  socksProxyPort?: number;
}

export interface SandboxConfig {
  enabled?: boolean;
  failIfUnavailable?: boolean;
  autoAllowBashIfSandboxed?: boolean;
  excludedCommands?: string[];
  allowUnsandboxedCommands?: boolean;
  filesystem?: SandboxFilesystem;
  network?: SandboxNetwork;
  enableWeakerNestedSandbox?: boolean;
  enableWeakerNetworkIsolation?: boolean;
}

// ─── Worktree Types ───

export interface WorktreeConfig {
  symlinkDirectories?: string[];
  sparsePaths?: string[];
}

// ─── Attribution Types ───

export interface AttributionConfig {
  commit?: string;
  pr?: string;
}

// ─── Auto Mode Types ───

export interface AutoModeConfig {
  environment?: string[];
  allow?: string[];
  soft_deny?: string[];
}

// ─── Main Settings Interface ───

export interface ClaudeSettings {
  // Core
  model?: string;
  effortLevel?: "low" | "medium" | "high";
  defaultMode?: "default" | "acceptEdits" | "plan" | "auto" | "dontAsk" | "bypassPermissions";

  // Permissions
  permissions?: {
    allow?: string[];
    ask?: string[];
    deny?: string[];
    additionalDirectories?: string[];
    disableBypassPermissionsMode?: string;
    disableAutoMode?: string;
  };

  // Environment
  env?: Record<string, string>;

  // Hooks (all event types)
  hooks?: {
    PreToolUse?: HookRule[];
    PostToolUse?: HookRule[];
    PostToolUseFailure?: HookRule[];
    Notification?: HookRule[];
    Stop?: HookRule[];
    StopFailure?: HookRule[];
    SessionStart?: HookRule[];
    SessionEnd?: HookRule[];
    UserPromptSubmit?: HookRule[];
    PermissionRequest?: HookRule[];
    PermissionDenied?: HookRule[];
    FileChanged?: HookRule[];
    CwdChanged?: HookRule[];
    ConfigChange?: HookRule[];
    SubagentStart?: HookRule[];
    SubagentStop?: HookRule[];
    SubagentTurn?: HookRule[];
  };

  // Sandbox
  sandbox?: SandboxConfig;

  // MCP Servers
  mcpServers?: Record<string, McpServerConfig>;
  enableAllProjectMcpServers?: boolean;
  trustProjectMcpServers?: boolean;

  // Worktree
  worktree?: WorktreeConfig;

  // Attribution
  attribution?: AttributionConfig;

  // Auto Mode
  autoMode?: AutoModeConfig;

  // UI/UX
  editorMode?: "normal" | "vim";
  showTurnDuration?: boolean;
  terminalProgressBarEnabled?: boolean;
  autoConnectIde?: boolean;
  autoInstallIdeExtension?: boolean;
  teammateMode?: "auto" | "in-process" | "tmux";
  additionalDirectories?: string[];

  // Feature Flags
  alwaysThinkingEnabled?: boolean;
  contextCompression?: boolean;

  // Model Configuration
  availableModels?: string[];
  modelOverrides?: Record<string, string>;

  // API / Session
  apiKey?: string;
  systemPrompt?: string;
  maxTurns?: number;
  workDir?: string;
  maxTokens?: number;
  temperature?: number;
  outputFormat?: "text" | "json" | "stream-json";

  // Cleanup
  cleanupPeriodDays?: number;
  autoUpdatesChannel?: "stable" | "beta";
}

// ─── Constants ───

export const HOOK_EVENTS = [
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "Notification",
  "Stop",
  "StopFailure",
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
  "PermissionRequest",
  "PermissionDenied",
  "FileChanged",
  "CwdChanged",
  "ConfigChange",
  "SubagentStart",
  "SubagentStop",
  "SubagentTurn",
] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number];

export const MODEL_OPTIONS = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
] as const;

export const EFFORT_LEVELS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export const PERMISSION_MODES = [
  { value: "default", label: "Default" },
  { value: "acceptEdits", label: "Accept Edits" },
  { value: "plan", label: "Plan" },
  { value: "auto", label: "Auto" },
  { value: "dontAsk", label: "Don't Ask" },
  { value: "bypassPermissions", label: "Bypass Permissions" },
] as const;

export const SANDBOX_TYPES = [
  { value: "enabled", label: "Enabled" },
  { value: "disabled", label: "Disabled" },
] as const;

export const OUTPUT_FORMAT_OPTIONS = ["text", "json", "stream-json"] as const;

export const HOOK_TYPES = ["command", "http", "prompt", "agent"] as const;

export function getDefaultSettings(): ClaudeSettings {
  return {};
}
