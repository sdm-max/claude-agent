"use client";

import { useState, useEffect, useCallback } from "react";
import FileDirectoryEditor from "./FileDirectoryEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { ClaudeSettings, HookRule, HookEvent } from "@/lib/settings-schema";
import { HOOK_EVENTS, TOOL_NAMES } from "@/lib/settings-schema";
import {
  MATCHER_PRESETS,
  findPresetByPattern,
  presetsForEvent,
} from "@/lib/hook-matcher-presets";
import BashMatcherBuilder from "@/components/bash-matcher-builder/BashMatcherBuilder";

interface Props {
  projectId?: string | null;
  settingsScope: "project" | "local" | "user";
  projectPath?: string | null;
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
  projectPath: projectPathProp,
  initialSettings,
  onSettingsSaved,
}: Props) {
  const projectPath = projectPathProp ?? "";
  const [settings, setSettings] = useState<ClaudeSettings>(initialSettings);
  const [savedSettings, setSavedSettings] = useState<ClaudeSettings>(initialSettings);
  const [availableScripts, setAvailableScripts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const hasEmptyCommands = (): boolean => {
    if (!settings.hooks) return false;
    for (const rules of Object.values(settings.hooks)) {
      if (!rules) continue;
      for (const rule of rules) {
        for (const hook of rule.hooks) {
          if (hook.type === "command" && !hook.command.trim()) return true;
        }
      }
    }
    return false;
  };

  const saveWiring = async () => {
    if (hasEmptyCommands()) {
      setSaveResult("Error: command가 비어있는 항목이 있습니다");
      return;
    }
    setSaving(true);
    setSaveResult(null);
    try {
      const fullSettings = { ...settings };
      const url = projectId
        ? `/api/projects/${projectId}/settings?scope=${settingsScope}`
        : `/api/settings?scope=user`;
      const res = await fetch(url, {
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
          projectId={projectId ?? null}
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
              event={event}
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
  event,
  availableScripts,
  projectPath,
  onUpdate,
  onRemove,
}: {
  rule: HookRule;
  event: HookEvent;
  availableScripts: string[];
  projectPath: string;
  onUpdate: (rule: HookRule) => void;
  onRemove: () => void;
}) {
  const [showToolPicker, setShowToolPicker] = useState(false);
  const [showBashBuilder, setShowBashBuilder] = useState(false);
  const selectedTools = (rule.matcher || "").split("|").filter(Boolean);
  const currentPreset = findPresetByPattern(rule.matcher ?? "");
  const eventPresets = presetsForEvent(event);

  const toggleTool = (toolName: string) => {
    const current = new Set(selectedTools);
    if (current.has(toolName)) {
      current.delete(toolName);
    } else {
      current.add(toolName);
    }
    const matcher = [...current].join("|") || undefined;
    onUpdate({ ...rule, matcher });
  };

  const applyPreset = (key: string | null) => {
    if (!key || key === "__custom__") return;
    const preset = MATCHER_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    onUpdate({ ...rule, matcher: preset.pattern });
  };

  const applyBashPattern = (pattern: string) => {
    onUpdate({ ...rule, matcher: pattern });
    setShowBashBuilder(false);
  };

  return (
    <div className="p-3 bg-muted/30 rounded-md border border-border space-y-2">
      {/* Preset dropdown */}
      <div className="flex items-center gap-2">
        <Label className="text-xs shrink-0 w-16">프리셋</Label>
        <Select
          value={currentPreset?.key ?? "__custom__"}
          onValueChange={applyPreset}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="프리셋 선택 (선택 시 matcher 자동 입력)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__custom__">사용자 지정 (직접 입력)</SelectItem>
            {eventPresets.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="xs"
          onClick={() => setShowBashBuilder(true)}
          title="Bash 명령줄 차단 regex 생성기"
        >
          Bash 빌더
        </Button>
      </div>

      {/* Matcher */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label className="text-xs shrink-0 w-16">Matcher</Label>
          <div
            className="flex-1 min-h-[36px] flex items-center gap-1 flex-wrap px-2 py-1 rounded-md border border-border bg-background cursor-pointer"
            onClick={() => setShowToolPicker(!showToolPicker)}
          >
            {selectedTools.length > 0 ? (
              selectedTools.map((t) => (
                <Badge key={t} variant="secondary" className="text-xs gap-1">
                  {t}
                  <span
                    className="cursor-pointer hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); toggleTool(t); }}
                  >
                    ×
                  </span>
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">도구를 선택하세요 (클릭)</span>
            )}
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onRemove} className="text-destructive">
            &times;
          </Button>
        </div>
        {showToolPicker && (
          <div className="ml-[4.5rem] grid grid-cols-3 gap-1 p-2 rounded-md border border-border bg-card">
            {TOOL_NAMES.map((tool) => {
              const isSelected = selectedTools.includes(tool.value);
              return (
                <button
                  key={tool.value}
                  type="button"
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs text-left transition-colors ${
                    isSelected
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "hover:bg-accent border border-transparent"
                  }`}
                  onClick={() => toggleTool(tool.value)}
                >
                  <span className={`size-3 rounded-sm border flex items-center justify-center ${
                    isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                  }`}>
                    {isSelected && <span className="text-[8px]">✓</span>}
                  </span>
                  <span className="font-medium">{tool.label}</span>
                  <span className="text-muted-foreground ml-auto">{tool.description}</span>
                </button>
              );
            })}
            <div className="col-span-3 mt-1 pt-1 border-t border-border">
              <Input
                className="text-xs"
                placeholder="MCP 도구 패턴 직접 입력 (예: mcp__github__.*)"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const input = e.currentTarget.value.trim();
                    if (input) {
                      const current = new Set(selectedTools);
                      current.add(input);
                      onUpdate({ ...rule, matcher: [...current].join("|") });
                      e.currentTarget.value = "";
                    }
                  }
                }}
              />
            </div>
          </div>
        )}
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

      {/* Bash matcher builder dialog */}
      <Dialog open={showBashBuilder} onOpenChange={setShowBashBuilder}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bash 화이트리스트 빌더</DialogTitle>
            <DialogDescription>
              프리셋과 옵션을 조합해 Bash 명령줄 차단 regex 를 생성합니다.
              결과는 이 Rule 의 matcher 에 설정됩니다.
            </DialogDescription>
          </DialogHeader>
          <BashMatcherBuilder
            initialPattern={rule.matcher ?? ""}
            onPatternSelect={applyBashPattern}
            onClose={() => setShowBashBuilder(false)}
          />
        </DialogContent>
      </Dialog>
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
