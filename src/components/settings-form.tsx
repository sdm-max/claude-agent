"use client";

import { useState } from "react";
import type { ClaudeSettings, HookRule, McpServerConfig, HookEvent } from "@/lib/settings-schema";
import { MODEL_OPTIONS, HOOK_EVENTS, OUTPUT_FORMAT_OPTIONS } from "@/lib/settings-schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { KEY_COMMENTS } from "@/lib/templates/annotate";
import { detectDangerousDeny, removeDangerousDeny } from "@/lib/deny-warning";
import { describePermission } from "@/lib/permission-descriptions";
import { PERMISSION_PRESETS, getCategoryLabel, type PermissionPreset } from "@/lib/permission-presets";

interface Props {
  settings: ClaudeSettings;
  onChange: (settings: ClaudeSettings) => void;
  hideHooks?: boolean;
}

export default function SettingsForm({ settings, onChange, hideHooks }: Props) {
  const update = (patch: Partial<ClaudeSettings>) => {
    const next = { ...settings, ...patch };
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) {
        delete next[k as keyof ClaudeSettings];
      }
    }
    onChange(next);
  };

  return (
    <div className="overflow-y-auto p-4 space-y-4">
      {/* General */}
      <Card size="sm">
        <CardHeader><CardTitle>General</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Model</Label>
            <FieldDesc keyName="model" />
            <Select
              value={settings.model || ""}
              onValueChange={(v) => update({ model: v || undefined })}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>System Prompt</Label>
            <FieldDesc keyName="systemPrompt" />
            <Textarea
              className="mt-1"
              value={settings.systemPrompt || ""}
              onChange={(e) => update({ systemPrompt: e.target.value || undefined })}
              placeholder="Custom system prompt..."
            />
          </div>
          <div>
            <Label>Max Turns</Label>
            <FieldDesc keyName="maxTurns" />
            <Input
              type="number"
              className="mt-1 w-32"
              value={settings.maxTurns ?? ""}
              onChange={(e) => update({ maxTurns: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="Unlimited"
              min={1}
            />
          </div>
          <div>
            <Label>API Key</Label>
            <Input
              type="password"
              className="mt-1"
              value={settings.apiKey || ""}
              onChange={(e) => update({ apiKey: e.target.value || undefined })}
              placeholder="sk-ant-..."
            />
          </div>
          <div>
            <Label>Working Directory</Label>
            <Input
              type="text"
              className="mt-1"
              value={settings.workDir || ""}
              onChange={(e) => update({ workDir: e.target.value || undefined })}
              placeholder="/path/to/dir"
            />
          </div>
          <div>
            <Label>Max Tokens</Label>
            <FieldDesc keyName="maxTokens" />
            <Input
              type="number"
              className="mt-1 w-32"
              value={settings.maxTokens ?? ""}
              onChange={(e) => update({ maxTokens: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="Unlimited"
              min={1}
            />
          </div>
          <div>
            <Label>Temperature</Label>
            <FieldDesc keyName="temperature" />
            <Input
              type="number"
              className="mt-1 w-32"
              value={settings.temperature ?? ""}
              onChange={(e) => update({ temperature: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="Default"
              step="0.1"
              min={0}
              max={2}
            />
          </div>
          <div>
            <Label>Output Format</Label>
            <Select
              value={settings.outputFormat || ""}
              onValueChange={(v) => update({ outputFormat: (v as typeof OUTPUT_FORMAT_OPTIONS[number]) || undefined })}
            >
              <SelectTrigger className="mt-1 w-48">
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                {OUTPUT_FORMAT_OPTIONS.map((fmt) => (
                  <SelectItem key={fmt} value={fmt}>{fmt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Permissions */}
      <Card size="sm">
        <CardHeader><CardTitle>Permissions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <TagArrayField
            label="Allow"
            value={settings.permissions?.allow || []}
            onChange={(allow) => update({ permissions: { ...settings.permissions, allow } })}
            placeholder="직접 입력 또는 선택 버튼 클릭"
            describer={describePermission}
            presets={PERMISSION_PRESETS}
          />
          <FieldDesc keyName="allow" />
          <Separator />
          <TagArrayField
            label="Deny"
            value={settings.permissions?.deny || []}
            onChange={(deny) => update({ permissions: { ...settings.permissions, deny } })}
            placeholder="직접 입력 또는 선택 버튼 클릭"
            describer={describePermission}
            presets={PERMISSION_PRESETS}
            isDeny
          />
          <FieldDesc keyName="deny" />
          {(() => {
            const allow = settings.permissions?.allow || [];
            const deny = settings.permissions?.deny || [];
            const conflicts = allow.filter((a) => deny.includes(a));
            if (conflicts.length === 0) return null;
            return (
              <div className="mt-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-sm font-medium text-yellow-700">⚠ Allow / Deny 충돌</p>
                <p className="text-xs text-yellow-600 mt-1">
                  다음 항목이 Allow와 Deny 양쪽에 있습니다: <strong>{conflicts.join(", ")}</strong>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Deny가 우선 적용되어 해당 권한은 차단됩니다.
                </p>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Environment */}
      <Card size="sm">
        <CardHeader><CardTitle>Environment Variables</CardTitle></CardHeader>
        <CardContent>
          <FieldDesc keyName="env" />
          <KeyValueEditor
            value={settings.env || {}}
            onChange={(env) => update({ env: Object.keys(env).length > 0 ? env : undefined })}
          />
        </CardContent>
      </Card>

      {/* Hooks */}
      {!hideHooks && (
        <Card size="sm">
          <CardHeader><CardTitle>Hooks</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {HOOK_EVENTS.map((event) => (
              <HookSection
                key={event}
                event={event}
                rules={settings.hooks?.[event] || []}
                onChange={(rules) => {
                  const hooks = { ...settings.hooks };
                  if (rules.length > 0) { hooks[event] = rules; } else { delete hooks[event]; }
                  update({ hooks: Object.keys(hooks).length > 0 ? hooks : undefined });
                }}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Sandbox */}
      <Card size="sm">
        <CardHeader><CardTitle>Sandbox</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <FieldDesc keyName="sandbox" />
          <div className="flex items-center gap-3">
            <Label>Enabled</Label>
            <Switch
              checked={settings.sandbox?.enabled ?? false}
              onCheckedChange={(v) => {
                if (!v) { update({ sandbox: undefined }); }
                else { update({ sandbox: { ...settings.sandbox, enabled: true } }); }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* MCP Servers */}
      <Card size="sm">
        <CardHeader><CardTitle>MCP Servers</CardTitle></CardHeader>
        <CardContent>
          <McpServersEditor
            value={settings.mcpServers || {}}
            onChange={(mcpServers) => update({ mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers : undefined })}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function FieldDesc({ keyName }: { keyName: string }) {
  const desc = (KEY_COMMENTS as Record<string, string>)[keyName];
  if (!desc) return null;
  return <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>;
}

// --- Sub-components ---

function TagArrayField({ label, value, onChange, placeholder, describer, presets, isDeny }: {
  label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string;
  describer?: (item: string) => string;
  presets?: PermissionPreset[];
  isDeny?: boolean;
}) {
  const [input, setInput] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const existingSet = new Set(value);

  return (
    <div>
      <Label className="mb-1">{label}</Label>
      <div className="flex flex-wrap gap-1 mb-2">
        {value.map((item, i) => (
          <Badge
            key={i}
            variant={selectedTag === item ? "default" : "secondary"}
            className={`gap-1 ${describer ? "cursor-pointer" : "cursor-default"}`}
            onClick={() => { describer && setSelectedTag(selectedTag === item ? null : item); setShowPresets(false); }}
          >
            {item}
            <button onClick={(e) => { e.stopPropagation(); onChange(value.filter((_, j) => j !== i)); if (selectedTag === item) setSelectedTag(null); }} className="text-muted-foreground hover:text-destructive ml-0.5">&times;</button>
          </Badge>
        ))}
      </div>
      {selectedTag && describer && (() => {
        const preset = presets?.find((p) => p.pattern === selectedTag);
        const hasWarning = isDeny ? preset?.warning : preset?.allowWarning;
        return (
          <div className={`mb-2 p-3 rounded-lg border ${hasWarning ? (isDeny ? "bg-destructive/5 border-destructive/20" : "bg-yellow-500/5 border-yellow-500/20") : "bg-muted/50 border-border"}`}>
            <p className="text-sm font-medium">{selectedTag}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {preset?.description || describer(selectedTag)}
            </p>
            {isDeny && preset?.warning && (
              <p className="text-xs text-destructive/80 mt-1">⚠ {preset.warning}</p>
            )}
            {!isDeny && preset?.allowWarning && (
              <p className="text-xs text-yellow-600 mt-1">💡 {preset.allowWarning}</p>
            )}
            <button
              type="button"
              className="mt-2 text-xs text-destructive underline hover:no-underline"
              onClick={() => { onChange(value.filter((v) => v !== selectedTag)); setSelectedTag(null); }}
            >
              항목 제거
            </button>
          </div>
        );
      })()}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) { e.preventDefault(); onChange([...value, input.trim()]); setInput(""); }
          }}
          placeholder={placeholder || "직접 입력 후 Enter"}
          className="flex-1"
        />
        {presets && (
          <Button
            type="button"
            variant={showPresets ? "secondary" : "outline"}
            size="sm"
            onClick={() => { setShowPresets(!showPresets); setSelectedTag(null); }}
          >
            {showPresets ? "닫기" : "+ 선택"}
          </Button>
        )}
      </div>
      {showPresets && presets && (
        <div className="mt-2 border border-border rounded-lg overflow-hidden">
          {(["file", "command", "search", "web", "agent"] as const).map((cat) => {
            const items = presets.filter((p) => p.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <div className="px-3 py-1.5 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                  {getCategoryLabel(cat)}
                </div>
                {items.map((preset) => {
                  const isAdded = existingSet.has(preset.pattern);
                  return (
                    <button
                      key={preset.pattern}
                      type="button"
                      className={`w-full text-left px-3 py-2 border-b border-border last:border-b-0 transition-colors ${
                        isAdded ? "bg-primary/5 opacity-60" : "hover:bg-accent"
                      }`}
                      disabled={isAdded}
                      onClick={() => {
                        if (!isAdded) onChange([...value, preset.pattern]);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium">{preset.pattern}</span>
                        {isAdded && <span className="text-[10px] text-muted-foreground">등록됨</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                      {isDeny && preset.warning && (
                        <p className="text-xs text-destructive/80 mt-0.5">⚠ {preset.warning}</p>
                      )}
                      {!isDeny && preset.allowWarning && (
                        <p className="text-xs text-yellow-600 mt-0.5">💡 {preset.allowWarning}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KeyValueEditor({ value, onChange }: {
  value: Record<string, string>; onChange: (v: Record<string, string>) => void;
}) {
  const [key, setKey] = useState("");
  const [val, setVal] = useState("");
  const entries = Object.entries(value);

  const add = () => { if (key.trim()) { onChange({ ...value, [key.trim()]: val }); setKey(""); setVal(""); } };

  return (
    <div>
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="font-mono">{k}</Badge>
          <span className="text-xs text-muted-foreground">=</span>
          <span className="text-xs font-mono flex-1 truncate">{v}</span>
          <Button variant="ghost" size="icon-xs" onClick={() => { const next = { ...value }; delete next[k]; onChange(next); }}>
            &times;
          </Button>
        </div>
      ))}
      <div className="flex gap-1 mt-2">
        <Input className="w-32" value={key} onChange={(e) => setKey(e.target.value)} placeholder="KEY" />
        <Input className="flex-1" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="VALUE" />
        <Button variant="outline" size="sm" onClick={add}>Add</Button>
      </div>
    </div>
  );
}

function HookSection({ event, rules, onChange }: {
  event: HookEvent; rules: HookRule[]; onChange: (rules: HookRule[]) => void;
}) {
  const addRule = () => { onChange([...rules, { hooks: [{ type: "command", command: "" }] }]); };
  const updateRule = (index: number, rule: HookRule) => { const next = [...rules]; next[index] = rule; onChange(next); };
  const removeRule = (index: number) => { onChange(rules.filter((_, i) => i !== index)); };

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <Label>{event}</Label>
        <Button variant="outline" size="xs" onClick={addRule}>+ Rule</Button>
      </div>
      {rules.length === 0 && <p className="text-xs text-muted-foreground">No rules configured</p>}
      {rules.map((rule, i) => (
        <div key={i} className="mb-2 p-2 bg-muted/30 rounded-md border border-border">
          <div className="flex items-center gap-2 mb-1">
            <Label className="text-xs shrink-0">Matcher:</Label>
            <Input
              className="flex-1"
              value={rule.matcher || ""}
              onChange={(e) => updateRule(i, { ...rule, matcher: e.target.value || undefined })}
              placeholder="Tool name pattern (optional)"
            />
            <Button variant="ghost" size="icon-xs" onClick={() => removeRule(i)} className="text-destructive">&times;</Button>
          </div>
          {rule.hooks.map((hook, hi) => (
            <div key={hi} className="flex items-center gap-2 mt-1">
              <Input
                className="flex-1"
                value={hook.type === "command" ? hook.command : ""}
                onChange={(e) => { const hooks = [...rule.hooks]; hooks[hi] = { type: "command", command: e.target.value, timeout: hook.timeout }; updateRule(i, { ...rule, hooks }); }}
                placeholder="Shell command"
              />
              <Input
                type="number"
                className="w-20"
                value={hook.timeout ?? ""}
                onChange={(e) => { const hooks = [...rule.hooks]; hooks[hi] = { ...hook, timeout: e.target.value ? Number(e.target.value) : undefined }; updateRule(i, { ...rule, hooks }); }}
                placeholder="Timeout"
              />
              {rule.hooks.length > 1 && (
                <Button variant="ghost" size="icon-xs" onClick={() => { const hooks = rule.hooks.filter((_, j) => j !== hi); updateRule(i, { ...rule, hooks }); }}>&times;</Button>
              )}
            </div>
          ))}
          <Button variant="link" size="xs" className="mt-1 p-0 h-auto" onClick={() => { updateRule(i, { ...rule, hooks: [...rule.hooks, { type: "command", command: "" }] }); }}>
            + Command
          </Button>
        </div>
      ))}
    </div>
  );
}

function McpServersEditor({ value, onChange }: {
  value: Record<string, McpServerConfig>; onChange: (v: Record<string, McpServerConfig>) => void;
}) {
  const [newName, setNewName] = useState("");
  const entries = Object.entries(value);

  const addServer = () => { if (newName.trim() && !value[newName.trim()]) { onChange({ ...value, [newName.trim()]: { command: "" } }); setNewName(""); } };
  const updateServer = (name: string, config: McpServerConfig) => { onChange({ ...value, [name]: config }); };
  const removeServer = (name: string) => { const next = { ...value }; delete next[name]; onChange(next); };

  return (
    <div>
      {entries.map(([name, config]) => (
        <div key={name} className="mb-3 p-3 bg-muted/30 rounded-md border border-border">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline" className="font-mono">{name}</Badge>
            <Button variant="ghost" size="icon-xs" onClick={() => removeServer(name)} className="text-destructive">&times;</Button>
          </div>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Command</Label>
              <Input className="mt-1" value={config.command} onChange={(e) => updateServer(name, { ...config, command: e.target.value })} placeholder="npx -y @modelcontextprotocol/..." />
            </div>
            <div>
              <Label className="text-xs">Args</Label>
              <TagArrayField label="" value={config.args || []} onChange={(args) => updateServer(name, { ...config, args: args.length > 0 ? args : undefined })} placeholder="Add argument" />
            </div>
            <div>
              <Label className="text-xs">Environment</Label>
              <KeyValueEditor value={config.env || {}} onChange={(env) => updateServer(name, { ...config, env: Object.keys(env).length > 0 ? env : undefined })} />
            </div>
          </div>
        </div>
      ))}
      <div className="flex gap-1 mt-2">
        <Input className="flex-1" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addServer(); } }} placeholder="Server name" />
        <Button variant="outline" size="sm" onClick={addServer}>Add Server</Button>
      </div>
    </div>
  );
}
