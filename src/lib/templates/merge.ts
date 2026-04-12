import type { ClaudeSettings } from "@/lib/settings-schema";

export function deepMergeSettings(
  base: ClaudeSettings,
  overlay: ClaudeSettings
): ClaudeSettings {
  const result = { ...base };

  // Merge permissions
  if (overlay.permissions) {
    result.permissions = result.permissions || {};
    if (overlay.permissions.allow) {
      const existing = new Set(result.permissions.allow || []);
      overlay.permissions.allow.forEach((r) => existing.add(r));
      result.permissions.allow = [...existing];
    }
    if (overlay.permissions.deny) {
      const existing = new Set(result.permissions.deny || []);
      overlay.permissions.deny.forEach((r) => existing.add(r));
      result.permissions.deny = [...existing];
    }
  }

  // Merge env
  if (overlay.env) {
    result.env = { ...result.env, ...overlay.env };
  }

  // Merge hooks
  if (overlay.hooks) {
    result.hooks = result.hooks || {};
    for (const [event, rules] of Object.entries(overlay.hooks)) {
      const key = event as keyof typeof result.hooks;
      if (rules) {
        result.hooks[key] = [...(result.hooks[key] || []), ...rules];
      }
    }
  }

  // Merge mcpServers
  if (overlay.mcpServers) {
    result.mcpServers = { ...result.mcpServers, ...overlay.mcpServers };
  }

  // Scalar values: overlay wins
  if (overlay.model) result.model = overlay.model;
  if (overlay.systemPrompt) result.systemPrompt = overlay.systemPrompt;
  if (overlay.maxTurns) result.maxTurns = overlay.maxTurns;
  if (overlay.maxTokens) result.maxTokens = overlay.maxTokens;
  if (overlay.temperature !== undefined)
    result.temperature = overlay.temperature;
  if (overlay.outputFormat) result.outputFormat = overlay.outputFormat;
  if (overlay.sandbox)
    result.sandbox = { ...result.sandbox, ...overlay.sandbox };

  return result;
}
