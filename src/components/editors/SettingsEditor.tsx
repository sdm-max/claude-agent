"use client";

import { useState, useEffect, useCallback } from "react";
import CodeEditor from "./CodeEditor";
import EditorToolbar from "./EditorToolbar";
import VersionHistory from "./VersionHistory";
import Tabs from "../ui/Tabs";
import ConfirmDialog from "../ui/ConfirmDialog";

const SCOPE_TABS = [
  { id: "user", label: "User" },
  { id: "project", label: "Project" },
  { id: "local", label: "Local" },
];

const MODE_TABS = [
  { id: "form", label: "Form" },
  { id: "code", label: "Code" },
];

interface FileRecord {
  id: string;
  content: string;
  type: string;
  scope: string;
}

interface Props {
  projectId: string;
  onHasChanges?: (v: boolean) => void;
}

export default function SettingsEditor({ projectId, onHasChanges }: Props) {
  const [scope, setScope] = useState("project");
  const [mode, setMode] = useState("form");
  const [file, setFile] = useState<FileRecord | null>(null);

  // Single source of truth: rawContent (the JSON string)
  const [rawContent, setRawContent] = useState("{}");
  const [savedContent, setSavedContent] = useState("{}");

  // Parsed settings for form mode (derived from rawContent)
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [parseError, setParseError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingScope, setPendingScope] = useState<string | null>(null);

  const hasChanges = rawContent !== savedContent;

  useEffect(() => {
    onHasChanges?.(hasChanges);
  }, [hasChanges, onHasChanges]);

  // Warn on page unload
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  // Parse rawContent → settings whenever rawContent changes
  useEffect(() => {
    try {
      const parsed = JSON.parse(rawContent);
      setSettings(parsed);
      setParseError(null);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON");
      // Keep last valid settings
    }
  }, [rawContent]);

  // Load file
  const loadFile = useCallback(async (s: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/files?type=settings&scope=${s}`);
      const data = await res.json();
      if (data.length > 0) {
        setFile(data[0]);
        setRawContent(data[0].content || "{}");
        setSavedContent(data[0].content || "{}");
      } else {
        setFile(null);
        setRawContent("{}");
        setSavedContent("{}");
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadFile(scope);
  }, [scope, loadFile]);

  // Scope switch guard
  const handleScopeChange = (newScope: string) => {
    if (hasChanges) {
      setPendingScope(newScope);
    } else {
      setScope(newScope);
    }
  };

  const confirmScopeSwitch = () => {
    if (pendingScope) {
      setScope(pendingScope);
      setPendingScope(null);
    }
  };

  // Form field change → update rawContent (single source of truth)
  const updateField = (key: string, value: unknown) => {
    const next = { ...settings, [key]: value };
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
      delete next[key];
    }
    const newRaw = JSON.stringify(next, null, 2);
    setRawContent(newRaw);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (file) {
        await fetch(`/api/projects/${projectId}/files/${file.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: rawContent }),
        });
      } else {
        const res = await fetch(`/api/projects/${projectId}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "settings", scope, content: rawContent }),
        });
        const created = await res.json();
        setFile(created);
      }
      setSavedContent(rawContent);
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = (restoredContent: string) => {
    setRawContent(restoredContent);
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs tabs={SCOPE_TABS} activeTab={scope} onTabChange={handleScopeChange} />
      <div className="flex items-center gap-2 px-2 py-1 bg-[var(--bg-card)] border-b border-[var(--border)]">
        <Tabs tabs={MODE_TABS} activeTab={mode} onTabChange={setMode} />
        {parseError && mode === "form" && (
          <span className="ml-auto text-xs text-[var(--danger)]">JSON 파싱 오류: {parseError}</span>
        )}
      </div>
      <EditorToolbar
        hasChanges={hasChanges}
        onSave={save}
        onHistory={file ? () => setShowHistory(true) : undefined}
        saving={saving}
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">로딩 중...</div>
      ) : mode === "code" ? (
        <div className="flex-1 overflow-hidden">
          <CodeEditor value={rawContent} onChange={setRawContent} language="json" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {parseError ? (
            <div className="p-3 rounded bg-red-900/30 border border-red-700 text-sm">
              JSON이 올바르지 않습니다. Code 탭에서 수정해주세요.
            </div>
          ) : (
            <>
              <FormField label="Model" value={(settings.model as string) || ""} onChange={(v) => updateField("model", v)} placeholder="claude-sonnet-4-20250514" />
              <FormSection label="Permissions">
                <FormArrayField
                  label="Allow"
                  value={(settings as Record<string, unknown>).permissions
                    ? ((settings as Record<string, string[]>).permissions as unknown as Record<string, string[]>)?.allow || []
                    : []}
                  onChange={(v) => {
                    const perms = (settings.permissions || {}) as Record<string, unknown>;
                    updateField("permissions", { ...perms, allow: v });
                  }}
                />
                <FormArrayField
                  label="Deny"
                  value={
                    (settings as Record<string, unknown>).permissions
                      ? ((settings as Record<string, string[]>).permissions as unknown as Record<string, string[]>)?.deny || []
                      : []
                  }
                  onChange={(v) => {
                    const perms = (settings.permissions || {}) as Record<string, unknown>;
                    updateField("permissions", { ...perms, deny: v });
                  }}
                />
              </FormSection>
              <FormSection label="Environment Variables">
                <FormKeyValueField
                  value={(settings.env as Record<string, string>) || {}}
                  onChange={(v) => updateField("env", v)}
                />
              </FormSection>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingScope}
        title="미저장 변경사항"
        message="저장하지 않은 변경사항이 있습니다. 스코프를 전환하시겠습니까?"
        onConfirm={confirmScopeSwitch}
        onCancel={() => setPendingScope(null)}
      />

      {file && (
        <VersionHistory
          projectId={projectId}
          fileId={file.id}
          open={showHistory}
          onClose={() => setShowHistory(false)}
          onRestore={handleRestore}
          language="json"
        />
      )}
    </div>
  );
}

// --- Sub-components for Form mode ---

function FormField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-[var(--text-muted)] mb-1">{label}</label>
      <input
        className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--border)] rounded p-3">
      <h4 className="text-sm font-medium mb-2">{label}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function FormArrayField({ label, value, onChange }: {
  label: string; value: string[]; onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");
  return (
    <div>
      <label className="block text-xs text-[var(--text-muted)] mb-1">{label}</label>
      <div className="flex flex-wrap gap-1 mb-1">
        {value.map((item, i) => (
          <span key={i} className="px-2 py-0.5 bg-[var(--bg-input)] rounded text-xs flex items-center gap-1">
            {item}
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-[var(--text-muted)] hover:text-[var(--danger)]">&times;</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          className="flex-1 px-2 py-1 bg-[var(--bg-input)] border border-[var(--border)] rounded text-xs"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              onChange([...value, input.trim()]);
              setInput("");
            }
          }}
          placeholder="추가 후 Enter"
        />
      </div>
    </div>
  );
}

function FormKeyValueField({ value, onChange }: {
  value: Record<string, string>; onChange: (v: Record<string, string>) => void;
}) {
  const [key, setKey] = useState("");
  const [val, setVal] = useState("");
  const entries = Object.entries(value);

  return (
    <div>
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono">{k}</span>
          <span className="text-xs text-[var(--text-muted)]">=</span>
          <span className="text-xs font-mono flex-1">{v}</span>
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
      <div className="flex gap-1">
        <input className="px-2 py-1 bg-[var(--bg-input)] border border-[var(--border)] rounded text-xs w-32" value={key} onChange={(e) => setKey(e.target.value)} placeholder="KEY" />
        <input className="px-2 py-1 bg-[var(--bg-input)] border border-[var(--border)] rounded text-xs flex-1" value={val} onChange={(e) => setVal(e.target.value)} placeholder="VALUE" />
        <button
          onClick={() => {
            if (key.trim()) {
              onChange({ ...value, [key.trim()]: val });
              setKey("");
              setVal("");
            }
          }}
          className="px-2 py-1 text-xs rounded bg-[var(--accent)] text-white"
        >
          추가
        </button>
      </div>
    </div>
  );
}
