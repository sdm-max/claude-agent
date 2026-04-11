"use client";

import { useState } from "react";
import type { ClaudeSettings, HookRule, HookCommand, McpServerConfig, HookEvent } from "@/lib/settings-schema";
import { MODEL_OPTIONS, SANDBOX_TYPES, HOOK_EVENTS } from "@/lib/settings-schema";

interface Props {
  settings: ClaudeSettings;
  onChange: (settings: ClaudeSettings) => void;
}

export default function SettingsForm({ settings, onChange }: Props) {
  const update = (patch: Partial<ClaudeSettings>) => {
    const next = { ...settings, ...patch };
    // Clean up empty values
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) {
        delete next[k as keyof ClaudeSettings];
      }
    }
    onChange(next);
  };

  return (
    <div className="overflow-y-auto p-4 space-y-6">
      {/* General */}
      <Section title="General">
        <Field label="Model">
          <select
            className="input-base"
            value={settings.model || ""}
            onChange={(e) => update({ model: e.target.value || undefined })}
          >
            <option value="">Default</option>
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </Field>
        <Field label="System Prompt">
          <textarea
            className="input-base min-h-[80px]"
            value={settings.systemPrompt || ""}
            onChange={(e) => update({ systemPrompt: e.target.value || undefined })}
            placeholder="Custom system prompt..."
          />
        </Field>
        <Field label="Max Turns">
          <input
            type="number"
            className="input-base w-32"
            value={settings.maxTurns ?? ""}
            onChange={(e) => update({ maxTurns: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Unlimited"
            min={1}
          />
        </Field>
        <Field label="API Key">
          <input
            type="password"
            className="input-base"
            value={settings.apiKey || ""}
            onChange={(e) => update({ apiKey: e.target.value || undefined })}
            placeholder="sk-ant-..."
          />
        </Field>
      </Section>

      {/* Permissions */}
      <Section title="Permissions">
        <TagArrayField
          label="Allow"
          value={settings.permissions?.allow || []}
          onChange={(allow) => update({ permissions: { ...settings.permissions, allow } })}
          placeholder="e.g. Bash(git*), Read"
        />
        <TagArrayField
          label="Deny"
          value={settings.permissions?.deny || []}
          onChange={(deny) => update({ permissions: { ...settings.permissions, deny } })}
          placeholder="e.g. Bash(rm*)"
        />
      </Section>

      {/* Environment */}
      <Section title="Environment Variables">
        <KeyValueEditor
          value={settings.env || {}}
          onChange={(env) => update({ env: Object.keys(env).length > 0 ? env : undefined })}
        />
      </Section>

      {/* Hooks */}
      <Section title="Hooks">
        {HOOK_EVENTS.map((event) => (
          <HookSection
            key={event}
            event={event}
            rules={settings.hooks?.[event] || []}
            onChange={(rules) => {
              const hooks = { ...settings.hooks };
              if (rules.length > 0) {
                hooks[event] = rules;
              } else {
                delete hooks[event];
              }
              update({ hooks: Object.keys(hooks).length > 0 ? hooks : undefined });
            }}
          />
        ))}
      </Section>

      {/* Sandbox */}
      <Section title="Sandbox">
        <Field label="Type">
          <select
            className="input-base w-48"
            value={settings.sandbox?.type || ""}
            onChange={(e) => {
              const type = e.target.value as "docker" | "none" | "";
              if (!type) {
                update({ sandbox: undefined });
              } else {
                update({ sandbox: { ...settings.sandbox, type } });
              }
            }}
          >
            <option value="">Not set</option>
            {SANDBOX_TYPES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>
        {settings.sandbox?.type === "docker" && (
          <Field label="Container">
            <input
              className="input-base"
              value={settings.sandbox?.container || ""}
              onChange={(e) => update({
                sandbox: { ...settings.sandbox, container: e.target.value || undefined },
              })}
              placeholder="Container name"
            />
          </Field>
        )}
      </Section>

      {/* MCP Servers */}
      <Section title="MCP Servers">
        <McpServersEditor
          value={settings.mcpServers || {}}
          onChange={(mcpServers) => update({
            mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers : undefined,
          })}
        />
      </Section>
    </div>
  );
}

// --- Sub-components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--border)] rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3 text-[var(--text)]">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-muted)] mb-1">{label}</label>
      {children}
    </div>
  );
}

function TagArrayField({ label, value, onChange, placeholder }: {
  label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [input, setInput] = useState("");
  return (
    <div>
      <label className="block text-xs text-[var(--text-muted)] mb-1">{label}</label>
      <div className="flex flex-wrap gap-1 mb-1">
        {value.map((item, i) => (
          <span key={i} className="px-2 py-0.5 bg-[var(--bg-input)] border border-[var(--border)] rounded text-xs flex items-center gap-1">
            {item}
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-[var(--text-muted)] hover:text-[var(--danger)]">&times;</button>
          </span>
        ))}
      </div>
      <input
        className="input-base text-xs"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && input.trim()) {
            e.preventDefault();
            onChange([...value, input.trim()]);
            setInput("");
          }
        }}
        placeholder={placeholder || "Type and press Enter"}
      />
    </div>
  );
}

function KeyValueEditor({ value, onChange }: {
  value: Record<string, string>; onChange: (v: Record<string, string>) => void;
}) {
  const [key, setKey] = useState("");
  const [val, setVal] = useState("");
  const entries = Object.entries(value);

  const add = () => {
    if (key.trim()) {
      onChange({ ...value, [key.trim()]: val });
      setKey("");
      setVal("");
    }
  };

  return (
    <div>
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono px-2 py-1 bg-[var(--bg-input)] rounded">{k}</span>
          <span className="text-xs text-[var(--text-muted)]">=</span>
          <span className="text-xs font-mono flex-1 truncate">{v}</span>
          <button
            onClick={() => {
              const next = { ...value };
              delete next[k];
              onChange(next);
            }}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)]"
          >
            &times;
          </button>
        </div>
      ))}
      <div className="flex gap-1 mt-1">
        <input className="input-base text-xs w-32" value={key} onChange={(e) => setKey(e.target.value)} placeholder="KEY" />
        <input
          className="input-base text-xs flex-1"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="VALUE"
        />
        <button onClick={add} className="px-2 py-1 text-xs rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]">
          Add
        </button>
      </div>
    </div>
  );
}

function HookSection({ event, rules, onChange }: {
  event: HookEvent; rules: HookRule[]; onChange: (rules: HookRule[]) => void;
}) {
  const addRule = () => {
    onChange([...rules, { hooks: [{ type: "command", command: "" }] }]);
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
    <div className="border border-[var(--border)] rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold">{event}</span>
        <button onClick={addRule} className="text-xs px-2 py-0.5 rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]">
          + Rule
        </button>
      </div>
      {rules.length === 0 && (
        <p className="text-xs text-[var(--text-muted)]">No rules configured</p>
      )}
      {rules.map((rule, i) => (
        <div key={i} className="mb-2 p-2 bg-[var(--bg)] rounded border border-[var(--border)]">
          <div className="flex items-center gap-2 mb-1">
            <label className="text-xs text-[var(--text-muted)]">Matcher:</label>
            <input
              className="input-base text-xs flex-1"
              value={rule.matcher || ""}
              onChange={(e) => updateRule(i, { ...rule, matcher: e.target.value || undefined })}
              placeholder="Tool name pattern (optional)"
            />
            <button onClick={() => removeRule(i)} className="text-xs text-[var(--danger)]">&times;</button>
          </div>
          {rule.hooks.map((hook, hi) => (
            <div key={hi} className="flex items-center gap-2 mt-1">
              <input
                className="input-base text-xs flex-1"
                value={hook.command}
                onChange={(e) => {
                  const hooks = [...rule.hooks];
                  hooks[hi] = { ...hook, command: e.target.value };
                  updateRule(i, { ...rule, hooks });
                }}
                placeholder="Shell command"
              />
              <input
                type="number"
                className="input-base text-xs w-20"
                value={hook.timeout ?? ""}
                onChange={(e) => {
                  const hooks = [...rule.hooks];
                  hooks[hi] = { ...hook, timeout: e.target.value ? Number(e.target.value) : undefined };
                  updateRule(i, { ...rule, hooks });
                }}
                placeholder="Timeout"
              />
              {rule.hooks.length > 1 && (
                <button
                  onClick={() => {
                    const hooks = rule.hooks.filter((_, j) => j !== hi);
                    updateRule(i, { ...rule, hooks });
                  }}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)]"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => {
              updateRule(i, { ...rule, hooks: [...rule.hooks, { type: "command", command: "" }] });
            }}
            className="text-xs text-[var(--accent)] mt-1 hover:underline"
          >
            + Command
          </button>
        </div>
      ))}
    </div>
  );
}

function McpServersEditor({ value, onChange }: {
  value: Record<string, McpServerConfig>;
  onChange: (v: Record<string, McpServerConfig>) => void;
}) {
  const [newName, setNewName] = useState("");
  const entries = Object.entries(value);

  const addServer = () => {
    if (newName.trim() && !value[newName.trim()]) {
      onChange({ ...value, [newName.trim()]: { command: "" } });
      setNewName("");
    }
  };

  const updateServer = (name: string, config: McpServerConfig) => {
    onChange({ ...value, [name]: config });
  };

  const removeServer = (name: string) => {
    const next = { ...value };
    delete next[name];
    onChange(next);
  };

  return (
    <div>
      {entries.map(([name, config]) => (
        <div key={name} className="mb-3 p-3 bg-[var(--bg)] rounded border border-[var(--border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold font-mono">{name}</span>
            <button onClick={() => removeServer(name)} className="text-xs text-[var(--danger)]">&times;</button>
          </div>
          <Field label="Command">
            <input
              className="input-base text-xs"
              value={config.command}
              onChange={(e) => updateServer(name, { ...config, command: e.target.value })}
              placeholder="npx -y @modelcontextprotocol/..."
            />
          </Field>
          <div className="mt-2">
            <label className="block text-xs text-[var(--text-muted)] mb-1">Args</label>
            <TagArrayField
              label=""
              value={config.args || []}
              onChange={(args) => updateServer(name, { ...config, args: args.length > 0 ? args : undefined })}
              placeholder="Add argument"
            />
          </div>
          <div className="mt-2">
            <label className="block text-xs text-[var(--text-muted)] mb-1">Environment</label>
            <KeyValueEditor
              value={config.env || {}}
              onChange={(env) => updateServer(name, { ...config, env: Object.keys(env).length > 0 ? env : undefined })}
            />
          </div>
        </div>
      ))}
      <div className="flex gap-1 mt-2">
        <input
          className="input-base text-xs flex-1"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addServer(); } }}
          placeholder="Server name"
        />
        <button onClick={addServer} className="px-3 py-1 text-xs rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]">
          Add Server
        </button>
      </div>
    </div>
  );
}
