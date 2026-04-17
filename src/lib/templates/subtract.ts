import type { ClaudeSettings, HookRule } from "@/lib/settings-schema";

/**
 * 키를 재귀적으로 정렬하여 직렬화 — 객체 키 순서에 무관하게 동등성 비교 가능 (H3/H4)
 */
function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * subtractSettings — deepMergeSettings의 역연산.
 * current에서 delta가 추가한 것만 정확히 제거.
 *
 * @param current 현재 settings (디스크에서 읽은 것)
 * @param delta 빼야 할 delta (template.settings 원본)
 * @param otherActiveDeltas 다른 active template들의 delta — 공유 항목은 보존
 * @returns delta가 제거된 새 settings
 */
export function subtractSettings(
  current: ClaudeSettings,
  delta: ClaudeSettings,
  otherActiveDeltas: ClaudeSettings[] = [],
): ClaudeSettings {
  const result: ClaudeSettings = structuredClone(current);

  // ─── permissions (union arrays: 항목별 제거, 단 다른 델타에 있으면 보존) ───
  if (delta.permissions) {
    result.permissions = result.permissions ? { ...result.permissions } : {};
    const perm = result.permissions;

    if (delta.permissions.allow) {
      perm.allow = subtractArray(perm.allow, delta.permissions.allow, otherActiveDeltas.map((d) => d.permissions?.allow).filter(Boolean) as string[][]);
    }
    if (delta.permissions.ask) {
      perm.ask = subtractArray(perm.ask, delta.permissions.ask, otherActiveDeltas.map((d) => d.permissions?.ask).filter(Boolean) as string[][]);
    }
    if (delta.permissions.deny) {
      perm.deny = subtractArray(perm.deny, delta.permissions.deny, otherActiveDeltas.map((d) => d.permissions?.deny).filter(Boolean) as string[][]);
    }
    if (delta.permissions.additionalDirectories) {
      perm.additionalDirectories = subtractArray(perm.additionalDirectories, delta.permissions.additionalDirectories, otherActiveDeltas.map((d) => d.permissions?.additionalDirectories).filter(Boolean) as string[][]);
    }
    // 스칼라: M3 — sharedWithOther 체크 적용
    if (delta.permissions.disableBypassPermissionsMode !== undefined && perm.disableBypassPermissionsMode === delta.permissions.disableBypassPermissionsMode) {
      const shared = otherActiveDeltas.some((d) => d.permissions?.disableBypassPermissionsMode === delta.permissions!.disableBypassPermissionsMode);
      if (!shared) delete perm.disableBypassPermissionsMode;
    }
    if (delta.permissions.disableAutoMode !== undefined && perm.disableAutoMode === delta.permissions.disableAutoMode) {
      const shared = otherActiveDeltas.some((d) => d.permissions?.disableAutoMode === delta.permissions!.disableAutoMode);
      if (!shared) delete perm.disableAutoMode;
    }

    // 빈 객체 정리
    if (Object.keys(perm).length === 0) delete result.permissions;
  }

  // ─── env (shallow merge: 키 제거, 값이 다르면 보존) — M7 sharedWithOther ───
  if (delta.env && result.env) {
    const env = { ...result.env };
    for (const [k, v] of Object.entries(delta.env)) {
      if (env[k] === v) {
        const shared = otherActiveDeltas.some((d) => d.env?.[k] === v);
        if (!shared) delete env[k];
      }
    }
    if (Object.keys(env).length === 0) delete result.env;
    else result.env = env;
  }

  // ─── hooks (concat arrays: rule canonicalStringify 매칭) — H3 ───
  if (delta.hooks && result.hooks) {
    const hooks = { ...result.hooks } as Record<string, HookRule[]>;
    const rHooks = result.hooks as Record<string, HookRule[] | undefined>;
    for (const [event, deltaRules] of Object.entries(delta.hooks)) {
      if (!deltaRules || !rHooks[event]) continue;
      const deltaSet = new Set(deltaRules.map((r) => canonicalStringify(r)));
      const otherSets = otherActiveDeltas.map((d) => {
        const dh = (d.hooks as Record<string, HookRule[] | undefined> | undefined)?.[event];
        return new Set((dh || []).map((r) => canonicalStringify(r)));
      });
      const remaining = rHooks[event]!.filter((rule) => {
        const s = canonicalStringify(rule);
        if (!deltaSet.has(s)) return true;
        return otherSets.some((os) => os.has(s));
      });
      if (remaining.length === 0) delete hooks[event];
      else hooks[event] = remaining;
    }
    if (Object.keys(hooks).length === 0) delete result.hooks;
    else result.hooks = hooks as ClaudeSettings["hooks"];
  }

  // ─── mcpServers (shallow merge by server name) — H4 canonicalStringify ───
  if (delta.mcpServers && result.mcpServers) {
    const mcp = { ...result.mcpServers };
    for (const [key, val] of Object.entries(delta.mcpServers)) {
      const deltaKey = canonicalStringify(val);
      if (canonicalStringify(mcp[key]) === deltaKey) {
        // 다른 델타도 같은 키를 가지고 있으면 보존
        const sharedWithOther = otherActiveDeltas.some((d) => d.mcpServers?.[key] && canonicalStringify(d.mcpServers[key]) === deltaKey);
        if (!sharedWithOther) delete mcp[key];
      }
    }
    if (Object.keys(mcp).length === 0) delete result.mcpServers;
    else result.mcpServers = mcp;
  }

  // ─── sandbox (deep merge: 재귀 subtract) — M5/M6 sharedWithOther 적용 ───
  if (delta.sandbox !== undefined && result.sandbox) {
    const sb = { ...result.sandbox };
    // 스칼라 — sharedWithOther 체크
    for (const k of ["enabled", "failIfUnavailable", "autoAllowBashIfSandboxed", "allowUnsandboxedCommands", "enableWeakerNestedSandbox", "enableWeakerNetworkIsolation"] as const) {
      if (delta.sandbox[k] !== undefined && sb[k] === delta.sandbox[k]) {
        const shared = otherActiveDeltas.some((d) => d.sandbox?.[k] === delta.sandbox![k]);
        if (!shared) delete sb[k];
      }
    }
    // 배열
    if (delta.sandbox.excludedCommands) {
      sb.excludedCommands = subtractArray(sb.excludedCommands, delta.sandbox.excludedCommands, otherActiveDeltas.map((d) => d.sandbox?.excludedCommands).filter(Boolean) as string[][]);
    }
    // filesystem
    if (delta.sandbox.filesystem && sb.filesystem) {
      const fs = { ...sb.filesystem };
      for (const arrKey of ["allowWrite", "denyWrite", "allowRead", "denyRead"] as const) {
        const dArr = delta.sandbox.filesystem[arrKey];
        if (dArr) {
          fs[arrKey] = subtractArray(fs[arrKey], dArr, otherActiveDeltas.map((d) => d.sandbox?.filesystem?.[arrKey]).filter(Boolean) as string[][]);
        }
      }
      if (delta.sandbox.filesystem.allowManagedReadPathsOnly !== undefined && fs.allowManagedReadPathsOnly === delta.sandbox.filesystem.allowManagedReadPathsOnly) {
        const shared = otherActiveDeltas.some((d) => d.sandbox?.filesystem?.allowManagedReadPathsOnly === delta.sandbox!.filesystem!.allowManagedReadPathsOnly);
        if (!shared) delete fs.allowManagedReadPathsOnly;
      }
      if (Object.keys(fs).length === 0) delete sb.filesystem;
      else sb.filesystem = fs;
    }
    // network — sharedWithOther 체크
    if (delta.sandbox.network && sb.network) {
      const nw = { ...sb.network };
      for (const arrKey of ["allowedDomains", "allowUnixSockets", "allowMachLookup"] as const) {
        const dArr = delta.sandbox.network[arrKey];
        if (dArr) {
          nw[arrKey] = subtractArray(nw[arrKey], dArr, otherActiveDeltas.map((d) => d.sandbox?.network?.[arrKey]).filter(Boolean) as string[][]);
        }
      }
      for (const k of ["allowManagedDomainsOnly", "allowAllUnixSockets", "allowLocalBinding", "httpProxyPort", "socksProxyPort"] as const) {
        if (delta.sandbox.network[k] !== undefined && nw[k] === delta.sandbox.network[k]) {
          const shared = otherActiveDeltas.some((d) => d.sandbox?.network?.[k] === delta.sandbox!.network![k]);
          if (!shared) delete nw[k];
        }
      }
      if (Object.keys(nw).length === 0) delete sb.network;
      else sb.network = nw;
    }
    if (Object.keys(sb).length === 0) delete result.sandbox;
    else result.sandbox = sb;
  }

  // ─── worktree (inner arrays union) ───
  if (delta.worktree && result.worktree) {
    const wt = { ...result.worktree };
    if (delta.worktree.symlinkDirectories) {
      wt.symlinkDirectories = subtractArray(wt.symlinkDirectories, delta.worktree.symlinkDirectories, otherActiveDeltas.map((d) => d.worktree?.symlinkDirectories).filter(Boolean) as string[][]);
    }
    if (delta.worktree.sparsePaths) {
      wt.sparsePaths = subtractArray(wt.sparsePaths, delta.worktree.sparsePaths, otherActiveDeltas.map((d) => d.worktree?.sparsePaths).filter(Boolean) as string[][]);
    }
    if (Object.keys(wt).length === 0) delete result.worktree;
    else result.worktree = wt;
  }

  // ─── attribution (shallow merge: 키 제거, 값 동일시) — M4 sharedWithOther ───
  if (delta.attribution && result.attribution) {
    const att = { ...result.attribution };
    if (delta.attribution.commit !== undefined && att.commit === delta.attribution.commit) {
      const shared = otherActiveDeltas.some((d) => d.attribution?.commit === delta.attribution!.commit);
      if (!shared) delete att.commit;
    }
    if (delta.attribution.pr !== undefined && att.pr === delta.attribution.pr) {
      const shared = otherActiveDeltas.some((d) => d.attribution?.pr === delta.attribution!.pr);
      if (!shared) delete att.pr;
    }
    if (Object.keys(att).length === 0) delete result.attribution;
    else result.attribution = att;
  }

  // ─── autoMode (inner arrays union) ───
  if (delta.autoMode && result.autoMode) {
    const am = { ...result.autoMode };
    if (delta.autoMode.environment) {
      am.environment = subtractArray(am.environment, delta.autoMode.environment, otherActiveDeltas.map((d) => d.autoMode?.environment).filter(Boolean) as string[][]);
    }
    if (delta.autoMode.allow) {
      am.allow = subtractArray(am.allow, delta.autoMode.allow, otherActiveDeltas.map((d) => d.autoMode?.allow).filter(Boolean) as string[][]);
    }
    if (delta.autoMode.soft_deny) {
      am.soft_deny = subtractArray(am.soft_deny, delta.autoMode.soft_deny, otherActiveDeltas.map((d) => d.autoMode?.soft_deny).filter(Boolean) as string[][]);
    }
    if (Object.keys(am).length === 0) delete result.autoMode;
    else result.autoMode = am;
  }

  // ─── modelOverrides (shallow merge) ───
  if (delta.modelOverrides && result.modelOverrides) {
    const mo = { ...result.modelOverrides };
    for (const [key, val] of Object.entries(delta.modelOverrides)) {
      if (mo[key] === val) {
        const sharedWithOther = otherActiveDeltas.some((d) => d.modelOverrides?.[key] === val);
        if (!sharedWithOther) delete mo[key];
      }
    }
    if (Object.keys(mo).length === 0) delete result.modelOverrides;
    else result.modelOverrides = mo;
  }

  // ─── 스칼라 필드: M3 — sharedWithOther 체크 적용 ───
  const scalarKeys = [
    "model", "effortLevel", "defaultMode", "systemPrompt", "maxTurns", "maxTokens",
    "temperature", "outputFormat", "editorMode", "showTurnDuration",
    "terminalProgressBarEnabled", "autoConnectIde", "autoInstallIdeExtension",
    "teammateMode", "alwaysThinkingEnabled", "contextCompression",
    "cleanupPeriodDays", "autoUpdatesChannel", "enableAllProjectMcpServers",
    "trustProjectMcpServers", "apiKey", "workDir",
  ] as const;
  for (const k of scalarKeys) {
    const deltaVal = (delta as Record<string, unknown>)[k];
    if (deltaVal !== undefined) {
      const resultVal = (result as Record<string, unknown>)[k];
      if (resultVal === deltaVal) {
        const shared = otherActiveDeltas.some((d) => (d as Record<string, unknown>)[k] === deltaVal);
        if (!shared) delete (result as Record<string, unknown>)[k];
      }
    }
  }

  // ─── 최상위 배열: union ───
  if (delta.availableModels) {
    result.availableModels = subtractArray(result.availableModels, delta.availableModels, otherActiveDeltas.map((d) => d.availableModels).filter(Boolean) as string[][]);
  }
  if (delta.additionalDirectories) {
    result.additionalDirectories = subtractArray(result.additionalDirectories, delta.additionalDirectories, otherActiveDeltas.map((d) => d.additionalDirectories).filter(Boolean) as string[][]);
  }

  return result;
}

/**
 * 배열에서 delta 항목을 제거. 단 otherDeltas 중 하나에도 그 항목이 있으면 보존.
 * canonicalStringify로 객체 키 순서 무관 비교.
 * 결과 배열이 비면 undefined 반환 (필드 제거용).
 */
function subtractArray<T>(
  current: T[] | undefined,
  delta: T[],
  otherDeltas: T[][],
): T[] | undefined {
  if (!current || current.length === 0) return current;
  const deltaSet = new Set(delta.map((x) => canonicalStringify(x)));
  const otherSet = new Set<string>();
  for (const arr of otherDeltas) {
    for (const x of arr) otherSet.add(canonicalStringify(x));
  }
  const remaining = current.filter((item) => {
    const key = canonicalStringify(item);
    if (!deltaSet.has(key)) return true; // delta에 없으면 보존
    return otherSet.has(key); // 다른 delta에 있으면 보존
  });
  return remaining.length > 0 ? remaining : undefined;
}
