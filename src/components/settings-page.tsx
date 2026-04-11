"use client";

import { useState, useEffect, useCallback } from "react";
import SettingsForm from "./settings-form";
import JsonEditor from "./json-editor";
import ScopeBadge from "./scope-badge";
import type { ClaudeSettings } from "@/lib/settings-schema";

interface Props {
  scope: "global" | "user";
  title: string;
}

export default function SettingsPage({ scope, title }: Props) {
  const [rawContent, setRawContent] = useState("{}");
  const [savedContent, setSavedContent] = useState("{}");
  const [settings, setSettings] = useState<ClaudeSettings>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"form" | "json">("form");

  const hasChanges = rawContent !== savedContent;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/settings?scope=${scope}`);
      const data = await res.json();
      const config = data.config || "{}";
      setRawContent(config);
      setSavedContent(config);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { load(); }, [load]);

  // Parse rawContent -> settings
  useEffect(() => {
    try {
      setSettings(JSON.parse(rawContent));
      setParseError(null);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }, [rawContent]);

  // Warn on unload
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  const handleFormChange = (next: ClaudeSettings) => {
    const json = JSON.stringify(next, null, 2);
    setRawContent(json);
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`/api/settings?scope=${scope}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: rawContent }),
      });
      setSavedContent(rawContent);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">{title}</h1>
          <ScopeBadge scope={scope} />
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && <span className="text-xs text-[var(--warning)]">Unsaved changes</span>}
          <button
            onClick={save}
            disabled={!hasChanges || saving}
            className="px-4 py-1.5 text-sm rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex border-b border-[var(--border)]">
        <button
          onClick={() => setMode("form")}
          className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
            mode === "form"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          Form
        </button>
        <button
          onClick={() => setMode("json")}
          className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
            mode === "json"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          JSON
        </button>
        {parseError && mode === "form" && (
          <span className="ml-auto self-center mr-4 text-xs text-[var(--danger)]">JSON parse error: {parseError}</span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">Loading...</div>
      ) : mode === "form" ? (
        parseError ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="p-4 rounded bg-red-900/30 border border-red-700 text-sm max-w-md">
              JSON is invalid. Switch to JSON tab to fix syntax errors.
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <SettingsForm settings={settings} onChange={handleFormChange} />
          </div>
        )
      ) : (
        <div className="flex-1 overflow-hidden">
          <JsonEditor value={rawContent} onChange={setRawContent} />
        </div>
      )}
    </div>
  );
}
