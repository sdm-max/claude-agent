"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import SettingsForm from "@/components/settings-form";
import JsonEditor from "@/components/json-editor";
import ScopeBadge from "@/components/scope-badge";
import ClaudeMdEditor from "@/components/editors/ClaudeMdEditor";
import ImportModal from "@/components/project/ImportModal";
import type { ClaudeSettings } from "@/lib/settings-schema";

interface Project {
  id: string;
  name: string;
  path: string;
  description: string;
  files: { id: string; type: string; scope: string; updatedAt: number }[];
}

type PageTab = "overview" | "settings" | "claude-md";
type SettingsScope = "project" | "local";
type EditMode = "form" | "json";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PageTab>("overview");
  const [showImport, setShowImport] = useState(false);

  // Settings state
  const [settingsScope, setSettingsScope] = useState<SettingsScope>("project");
  const [editMode, setEditMode] = useState<EditMode>("form");
  const [rawContent, setRawContent] = useState("{}");
  const [savedContent, setSavedContent] = useState("{}");
  const [settings, setSettings] = useState<ClaudeSettings>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasChanges = rawContent !== savedContent;

  const loadProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) {
      setProject(await res.json());
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadProject(); }, [loadProject]);

  // Load settings for current scope
  const loadSettings = useCallback(async (scope: SettingsScope) => {
    setSettingsLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/settings?scope=${scope}`);
      const data = await res.json();
      const config = data.config || "{}";
      setRawContent(config);
      setSavedContent(config);
    } finally {
      setSettingsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === "settings") {
      loadSettings(settingsScope);
    }
  }, [activeTab, settingsScope, loadSettings]);

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
    setRawContent(JSON.stringify(next, null, 2));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await fetch(`/api/projects/${id}/settings?scope=${settingsScope}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: rawContent }),
      });
      setSavedContent(rawContent);
    } finally {
      setSaving(false);
    }
  };

  const handleScopeChange = (scope: SettingsScope) => {
    if (hasChanges) {
      if (!confirm("You have unsaved changes. Switch scope anyway?")) return;
    }
    setSettingsScope(scope);
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">Loading...</div>;
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--text-muted)] mb-2">Project not found.</p>
          <Link href="/projects" className="text-[var(--accent)] hover:underline">Back to list</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/projects" className="text-[var(--text-muted)] hover:text-[var(--text)]">&larr;</Link>
          <h1 className="text-xl font-bold">{project.name}</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)]">{project.path}</p>
      </div>

      {/* Page tabs */}
      <div className="flex border-b border-[var(--border)]">
        {(["overview", "settings", "claude-md"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {tab === "overview" ? "Overview" : tab === "settings" ? "Settings" : "CLAUDE.md"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === "overview" && (
          <div className="p-6 space-y-6 overflow-y-auto">
            {project.description && (
              <p className="text-[var(--text-muted)]">{project.description}</p>
            )}
            <button
              onClick={() => setShowImport(true)}
              className="px-4 py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm"
            >
              Import from disk
            </button>
            <div>
              <h3 className="font-semibold mb-3">Config Files ({project.files.length})</h3>
              {project.files.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No files yet. Use Import or the Settings/CLAUDE.md tabs.</p>
              ) : (
                <div className="space-y-1">
                  {project.files.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-3 rounded border border-[var(--border)] bg-[var(--bg-card)]">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{f.type}</span>
                        <ScopeBadge scope={f.scope} />
                      </div>
                      <span className="text-xs text-[var(--text-muted)]">
                        {new Date(f.updatedAt).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <>
            {/* Scope tabs + save */}
            <div className="flex items-center border-b border-[var(--border)]">
              <div className="flex">
                {(["project", "local"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleScopeChange(s)}
                    className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                      settingsScope === s
                        ? "border-[var(--accent)] text-[var(--accent)]"
                        : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              <div className="ml-4 flex">
                {(["form", "json"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setEditMode(m)}
                    className={`px-3 py-1.5 text-xs rounded transition-colors ${
                      editMode === m
                        ? "bg-[var(--bg-input)] text-[var(--accent)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {m === "form" ? "Form" : "JSON"}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2 pr-4">
                {hasChanges && <span className="text-xs text-[var(--warning)]">Unsaved</span>}
                <button
                  onClick={saveSettings}
                  disabled={!hasChanges || saving}
                  className="px-3 py-1.5 text-sm rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 text-white transition-colors"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {settingsLoading ? (
              <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">Loading...</div>
            ) : editMode === "form" ? (
              parseError ? (
                <div className="flex-1 flex items-center justify-center p-4">
                  <div className="p-4 rounded bg-red-900/30 border border-red-700 text-sm">
                    JSON is invalid. Switch to JSON mode to fix.
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
          </>
        )}

        {activeTab === "claude-md" && (
          <ClaudeMdEditor projectId={id} />
        )}
      </div>

      <ImportModal
        projectId={id}
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={loadProject}
      />
    </div>
  );
}
