"use client";

import { useState, useEffect, useCallback } from "react";
import FileDirectoryEditor from "./FileDirectoryEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ClaudeSettings, HookRule, HookEvent } from "@/lib/settings-schema";
import { HOOK_EVENTS } from "@/lib/settings-schema";

interface Props {
  projectId: string;
  settingsScope: "project" | "local";
  projectPath: string;
  initialSettings: ClaudeSettings;
  onSettingsSaved: (updated: ClaudeSettings) => void;
}

function inferCommandType(command: string, projectPath: string): "script" | "inline" {
  const hooksDir = `${projectPath}/.claude/hooks/`;
  if (command.startsWith(hooksDir) && command.endsWith(".sh")) return "script";
  if (command.endsWith(".sh") && command.includes("/.claude/hooks/")) return "script";
  return "inline";
}

function extractScriptName(command: string, projectPath: string): string {
  const hooksDir = `${projectPath}/.claude/hooks/`;
  if (command.startsWith(hooksDir)) return command.slice(hooksDir.length);
  return "";
}

function buildScriptPath(projectPath: string, scriptName: string): string {
  return `${projectPath}/.claude/hooks/${scriptName}`;
}

export default function HooksUnifiedEditor({
  projectId,
  settingsScope,
  projectPath,
  initialSettings,
  onSettingsSaved,
}: Props) {
  const [settings, setSettings] = useState<ClaudeSettings>(initialSettings);
  const [savedSettings, setSavedSettings] = useState<ClaudeSettings>(initialSettings);
  const [availableScripts, setAvailableScripts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  useEffect(() => {
    setSettings(initialSettings);
    setSavedSettings(initialSettings);
  }, [initialSettings]);

  const hasChanges = JSON.stringify(settings.hooks) !== JSON.stringify(savedSettings.hooks);

  const handleFilesChange = useCallback((files: { name: string }[]) => {
    setAvailableScripts(files.map((f) => f.name));
  }, []);

  const updateHooks = (hooks: ClaudeSettings["hooks"]) => {
    const cleaned = hooks && Object.keys(hooks).length > 0 ? hooks : undefined;
    setSettings((prev) => ({ ...prev, hooks: cleaned }));
  };

  const saveWiring = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const fullSettings = { ...settings };
      const res = await fetch(`/api/projects/${projectId}/settings?scope=${settingsScope}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: JSON.stringify(fullSettings, null, 2) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveResult(`Error: ${err.error || "Save failed"}`);
        return;
      }
      setSavedSettings({ ...settings });
      onSettingsSaved(settings);
      setSaveResult("Saved");
      setTimeout(() => setSaveResult(null), 2000);
    } catch {
      setSaveResult("Error: Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Script file editor */}
      <div className="w-[45%] shrink-0 border-r border-border overflow-hidden">
        <FileDirectoryEditor
          projectId={projectId}
          type="hooks"
          fileExtension=".sh"
          editorLanguage="shell"
          onFilesChange={handleFilesChange}
        />
      </div>

      {/* Right: Hook wiring panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card">
          <span className="text-sm font-medium">Hook Wiring</span>
          <Badge variant="outline" className="text-xs">{settingsScope}</Badge>
          <div className="ml-auto flex items-center gap-2">
            {hasChanges && <span className="text-xs text-yellow-400">Unsaved</span>}
            {saveResult && (
              <span className={`text-xs ${saveResult.startsWith("Error") ? "text-destructive" : "text-green-400"}`}>
                {saveResult}
              </span>
            )}
            <Button size="sm" onClick={saveWiring} disabled={!hasChanges || saving}>
              {saving ? "Saving..." : "Save Wiring"}
            </Button>
          </div>
        </div>

        {/* Event sections */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {HOOK_EVENTS.map((event) => (
            <EventSection
              key={event}
              event={event}
              rules={settings.hooks?.[event] || []}
              availableScripts={availableScripts}
              projectPath={projectPath}
              onChange={(rules) => {
                const hooks = { ...settings.hooks };
                if (rules.length > 0) {
                  hooks[event] = rules;
                } else {
                  delete hooks[event];
                }
                updateHooks(hooks);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Event Section (collapsible per event) ──────────────────────────────── */

function EventSection({
  event,
  rules,
  availableScripts,
  projectPath,
  onChange,
}: {
  event: HookEvent;
  rules: HookRule[];
  availableScripts: string[];
  projectPath: string;
  onChange: (rules: HookRule[]) => void;
}) {
  const [expanded, setExpanded] = useState(rules.length > 0);

  const addRule = () => {
    onChange([...rules, { hooks: [{ type: "command", command: "" }] }]);
    setExpanded(true);
  };

  const updateRule = (index: number, rule: HookRule) => {
    const next = [...rules];
    next[index] = rule;
    onChange(next);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-lg border border-border">
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{expanded ? "▼" : "▶"}</span>
          <Label className="cursor-pointer">{event}</Label>
          {rules.length > 0 && (
            <Badge variant="secondary" className="text-xs">{rules.length}</Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="xs"
          onClick={(e) => { e.stopPropagation(); addRule(); }}
        >
          + Rule
        </Button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {rules.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">No rules configured</p>
          )}
          {rules.map((rule, i) => (
            <HookRuleRow
              key={i}
              rule={rule}
              availableScripts={availableScripts}
              projectPath={projectPath}
              onUpdate={(r) => updateRule(i, r)}
              onRemove={() => removeRule(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Hook Rule Row ──────────────────────────────────────────────────────── */

function HookRuleRow({
  rule,
  availableScripts,
  projectPath,
  onUpdate,
  onRemove,
}: {
  rule: HookRule;
  availableScripts: string[];
  projectPath: string;
  onUpdate: (rule: HookRule) => void;
  onRemove: () => void;
}) {
  return (
    <div className="p-3 bg-muted/30 rounded-md border border-border space-y-2">
      {/* Matcher */}
      <div className="flex items-center gap-2">
        <Label className="text-xs shrink-0 w-16">Matcher</Label>
        <Input
          className="flex-1"
          value={rule.matcher || ""}
          onChange={(e) => onUpdate({ ...rule, matcher: e.target.value || undefined })}
          placeholder="Tool pattern (e.g. Edit|Write|Bash)"
        />
        <Button variant="ghost" size="icon-xs" onClick={onRemove} className="text-destructive">
          &times;
        </Button>
      </div>

      {/* Commands */}
      {rule.hooks.map((hook, hi) => (
        <CommandEntry
          key={hi}
          command={hook.type === "command" ? hook.command : ""}
          timeout={hook.timeout}
          availableScripts={availableScripts}
          projectPath={projectPath}
          onChange={(cmd, timeout) => {
            const hooks = [...rule.hooks];
            hooks[hi] = { type: "command", command: cmd, ...(timeout != null ? { timeout } : {}) };
            onUpdate({ ...rule, hooks });
          }}
          onRemove={rule.hooks.length > 1 ? () => {
            const hooks = rule.hooks.filter((_, j) => j !== hi);
            onUpdate({ ...rule, hooks });
          } : undefined}
        />
      ))}

      <Button
        variant="link"
        size="xs"
        className="p-0 h-auto text-xs"
        onClick={() => onUpdate({ ...rule, hooks: [...rule.hooks, { type: "command", command: "" }] })}
      >
        + Command
      </Button>
    </div>
  );
}

/* ── Command Entry (Script / Inline toggle) ─────────────────────────────── */

function CommandEntry({
  command,
  timeout,
  availableScripts,
  projectPath,
  onChange,
  onRemove,
}: {
  command: string;
  timeout?: number;
  availableScripts: string[];
  projectPath: string;
  onChange: (command: string, timeout?: number) => void;
  onRemove?: () => void;
}) {
  const commandType = inferCommandType(command, projectPath);
  const scriptName = commandType === "script" ? extractScriptName(command, projectPath) : "";

  const setCommandType = (type: "script" | "inline") => {
    if (type === "script" && availableScripts.length > 0) {
      onChange(buildScriptPath(projectPath, availableScripts[0]), timeout);
    } else {
      onChange("", timeout);
    }
  };

  return (
    <div className="flex items-start gap-2">
      {/* Type toggle */}
      <Select value={commandType} onValueChange={(v) => setCommandType(v as "script" | "inline")}>
        <SelectTrigger className="w-24 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="script">Script</SelectItem>
          <SelectItem value="inline">Inline</SelectItem>
        </SelectContent>
      </Select>

      {/* Command input */}
      {commandType === "script" ? (
        <Select
          value={scriptName}
          onValueChange={(v) => v && onChange(buildScriptPath(projectPath, v), timeout)}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select script..." />
          </SelectTrigger>
          <SelectContent>
            {availableScripts.length === 0 ? (
              <SelectItem value="" disabled>No scripts available</SelectItem>
            ) : (
              availableScripts.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      ) : (
        <Textarea
          className="flex-1 font-mono text-xs min-h-[36px]"
          value={command}
          onChange={(e) => onChange(e.target.value, timeout)}
          placeholder="Shell command (e.g. jq -r '.tool_input' | ...)"
          rows={command.includes("\n") ? 3 : 1}
        />
      )}

      {/* Timeout */}
      <Input
        type="number"
        className="w-20 shrink-0"
        value={timeout ?? ""}
        onChange={(e) => onChange(command, e.target.value ? Number(e.target.value) : undefined)}
        placeholder="sec"
      />

      {/* Remove */}
      {onRemove && (
        <Button variant="ghost" size="icon-xs" onClick={onRemove} className="shrink-0">
          &times;
        </Button>
      )}
    </div>
  );
}
