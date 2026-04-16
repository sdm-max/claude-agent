import type {
  ClaudeSettings,
  SandboxConfig,
  SandboxFilesystem,
  SandboxNetwork,
} from "@/lib/settings-schema";

function unionArrays<T>(a: T[] | undefined, b: T[] | undefined): T[] | undefined {
  if (!a && !b) return undefined;
  const set = new Set([...(a || []), ...(b || [])]);
  return [...set];
}

function mergeSandboxFilesystem(
  base: SandboxFilesystem | undefined,
  overlay: SandboxFilesystem,
): SandboxFilesystem {
  if (!base) return overlay;
  const r: SandboxFilesystem = { ...base };
  if (overlay.allowWrite) r.allowWrite = unionArrays(base.allowWrite, overlay.allowWrite);
  if (overlay.denyWrite) r.denyWrite = unionArrays(base.denyWrite, overlay.denyWrite);
  if (overlay.allowRead) r.allowRead = unionArrays(base.allowRead, overlay.allowRead);
  if (overlay.denyRead) r.denyRead = unionArrays(base.denyRead, overlay.denyRead);
  if (overlay.allowManagedReadPathsOnly !== undefined)
    r.allowManagedReadPathsOnly = overlay.allowManagedReadPathsOnly;
  return r;
}

function mergeSandboxNetwork(
  base: SandboxNetwork | undefined,
  overlay: SandboxNetwork,
): SandboxNetwork {
  if (!base) return overlay;
  const r: SandboxNetwork = { ...base };
  if (overlay.allowedDomains) r.allowedDomains = unionArrays(base.allowedDomains, overlay.allowedDomains);
  if (overlay.allowUnixSockets) r.allowUnixSockets = unionArrays(base.allowUnixSockets, overlay.allowUnixSockets);
  if (overlay.allowMachLookup) r.allowMachLookup = unionArrays(base.allowMachLookup, overlay.allowMachLookup);
  if (overlay.allowManagedDomainsOnly !== undefined) r.allowManagedDomainsOnly = overlay.allowManagedDomainsOnly;
  if (overlay.allowAllUnixSockets !== undefined) r.allowAllUnixSockets = overlay.allowAllUnixSockets;
  if (overlay.allowLocalBinding !== undefined) r.allowLocalBinding = overlay.allowLocalBinding;
  if (overlay.httpProxyPort !== undefined) r.httpProxyPort = overlay.httpProxyPort;
  if (overlay.socksProxyPort !== undefined) r.socksProxyPort = overlay.socksProxyPort;
  return r;
}

function mergeSandbox(
  base: SandboxConfig | undefined,
  overlay: SandboxConfig,
): SandboxConfig {
  if (!base) return overlay;
  const r: SandboxConfig = { ...base };
  if (overlay.enabled !== undefined) r.enabled = overlay.enabled;
  if (overlay.failIfUnavailable !== undefined) r.failIfUnavailable = overlay.failIfUnavailable;
  if (overlay.autoAllowBashIfSandboxed !== undefined) r.autoAllowBashIfSandboxed = overlay.autoAllowBashIfSandboxed;
  if (overlay.excludedCommands) r.excludedCommands = unionArrays(base.excludedCommands, overlay.excludedCommands);
  if (overlay.allowUnsandboxedCommands !== undefined) r.allowUnsandboxedCommands = overlay.allowUnsandboxedCommands;
  if (overlay.filesystem !== undefined) r.filesystem = mergeSandboxFilesystem(base.filesystem, overlay.filesystem);
  if (overlay.network !== undefined) r.network = mergeSandboxNetwork(base.network, overlay.network);
  if (overlay.enableWeakerNestedSandbox !== undefined) r.enableWeakerNestedSandbox = overlay.enableWeakerNestedSandbox;
  if (overlay.enableWeakerNetworkIsolation !== undefined) r.enableWeakerNetworkIsolation = overlay.enableWeakerNetworkIsolation;
  return r;
}

export function deepMergeSettings(
  base: ClaudeSettings,
  overlay: ClaudeSettings,
): ClaudeSettings {
  const result: ClaudeSettings = { ...base };

  // ─── permissions (arrays: union, strings: overwrite) ───
  if (overlay.permissions) {
    result.permissions = result.permissions || {};
    if (overlay.permissions.allow)
      result.permissions.allow = unionArrays(result.permissions.allow, overlay.permissions.allow);
    if (overlay.permissions.ask)
      result.permissions.ask = unionArrays(result.permissions.ask, overlay.permissions.ask);
    if (overlay.permissions.deny)
      result.permissions.deny = unionArrays(result.permissions.deny, overlay.permissions.deny);
    if (overlay.permissions.additionalDirectories)
      result.permissions.additionalDirectories = unionArrays(
        result.permissions.additionalDirectories,
        overlay.permissions.additionalDirectories,
      );
    if (overlay.permissions.disableBypassPermissionsMode !== undefined)
      result.permissions.disableBypassPermissionsMode = overlay.permissions.disableBypassPermissionsMode;
    if (overlay.permissions.disableAutoMode !== undefined)
      result.permissions.disableAutoMode = overlay.permissions.disableAutoMode;
  }

  // ─── env (flat key-value: shallow merge) ───
  if (overlay.env) {
    result.env = { ...result.env, ...overlay.env };
  }

  // ─── hooks (concat arrays per event key) ───
  if (overlay.hooks) {
    result.hooks = result.hooks || {};
    for (const [event, rules] of Object.entries(overlay.hooks)) {
      const key = event as keyof typeof result.hooks;
      if (rules) {
        result.hooks[key] = [...(result.hooks[key] || []), ...rules];
      }
    }
  }

  // ─── mcpServers (shallow merge by server name) ───
  if (overlay.mcpServers) {
    result.mcpServers = { ...result.mcpServers, ...overlay.mcpServers };
  }

  // ─── sandbox (deep merge — inner arrays union) ───
  if (overlay.sandbox !== undefined) {
    result.sandbox = mergeSandbox(result.sandbox, overlay.sandbox);
  }

  // ─── worktree (inner arrays union) ───
  if (overlay.worktree !== undefined) {
    const bw = result.worktree || {};
    result.worktree = {
      ...bw,
      ...(overlay.worktree.symlinkDirectories !== undefined
        ? { symlinkDirectories: unionArrays(bw.symlinkDirectories, overlay.worktree.symlinkDirectories) }
        : {}),
      ...(overlay.worktree.sparsePaths !== undefined
        ? { sparsePaths: unionArrays(bw.sparsePaths, overlay.worktree.sparsePaths) }
        : {}),
    };
  }

  // ─── attribution (shallow merge — all primitives) ───
  if (overlay.attribution !== undefined) {
    result.attribution = { ...result.attribution, ...overlay.attribution };
  }

  // ─── autoMode (inner arrays union) ───
  if (overlay.autoMode !== undefined) {
    const ba = result.autoMode || {};
    result.autoMode = {
      ...ba,
      ...(overlay.autoMode.environment !== undefined
        ? { environment: unionArrays(ba.environment, overlay.autoMode.environment) }
        : {}),
      ...(overlay.autoMode.allow !== undefined
        ? { allow: unionArrays(ba.allow, overlay.autoMode.allow) }
        : {}),
      ...(overlay.autoMode.soft_deny !== undefined
        ? { soft_deny: unionArrays(ba.soft_deny, overlay.autoMode.soft_deny) }
        : {}),
    };
  }

  // ─── modelOverrides (shallow merge by key) ───
  if (overlay.modelOverrides !== undefined) {
    result.modelOverrides = { ...result.modelOverrides, ...overlay.modelOverrides };
  }

  // ─── Scalar fields: overlay wins (use !== undefined to handle falsy) ───
  if (overlay.model !== undefined) result.model = overlay.model;
  if (overlay.effortLevel !== undefined) result.effortLevel = overlay.effortLevel;
  if (overlay.defaultMode !== undefined) result.defaultMode = overlay.defaultMode;
  if (overlay.systemPrompt !== undefined) result.systemPrompt = overlay.systemPrompt;
  if (overlay.maxTurns !== undefined) result.maxTurns = overlay.maxTurns;
  if (overlay.maxTokens !== undefined) result.maxTokens = overlay.maxTokens;
  if (overlay.temperature !== undefined) result.temperature = overlay.temperature;
  if (overlay.outputFormat !== undefined) result.outputFormat = overlay.outputFormat;
  if (overlay.editorMode !== undefined) result.editorMode = overlay.editorMode;
  if (overlay.showTurnDuration !== undefined) result.showTurnDuration = overlay.showTurnDuration;
  if (overlay.terminalProgressBarEnabled !== undefined) result.terminalProgressBarEnabled = overlay.terminalProgressBarEnabled;
  if (overlay.autoConnectIde !== undefined) result.autoConnectIde = overlay.autoConnectIde;
  if (overlay.autoInstallIdeExtension !== undefined) result.autoInstallIdeExtension = overlay.autoInstallIdeExtension;
  if (overlay.teammateMode !== undefined) result.teammateMode = overlay.teammateMode;
  if (overlay.alwaysThinkingEnabled !== undefined) result.alwaysThinkingEnabled = overlay.alwaysThinkingEnabled;
  if (overlay.contextCompression !== undefined) result.contextCompression = overlay.contextCompression;
  if (overlay.cleanupPeriodDays !== undefined) result.cleanupPeriodDays = overlay.cleanupPeriodDays;
  if (overlay.autoUpdatesChannel !== undefined) result.autoUpdatesChannel = overlay.autoUpdatesChannel;
  if (overlay.enableAllProjectMcpServers !== undefined) result.enableAllProjectMcpServers = overlay.enableAllProjectMcpServers;
  if (overlay.trustProjectMcpServers !== undefined) result.trustProjectMcpServers = overlay.trustProjectMcpServers;
  if (overlay.apiKey !== undefined) result.apiKey = overlay.apiKey;
  if (overlay.workDir !== undefined) result.workDir = overlay.workDir;

  // ─── Top-level arrays: union ───
  if (overlay.availableModels !== undefined) {
    result.availableModels = unionArrays(result.availableModels, overlay.availableModels);
  }
  if (overlay.additionalDirectories !== undefined) {
    result.additionalDirectories = unionArrays(result.additionalDirectories, overlay.additionalDirectories);
  }

  return result;
}
