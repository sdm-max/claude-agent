"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import SettingsForm from "@/components/settings-form";
import JsonEditor from "@/components/json-editor";
import ScopeBadge from "@/components/scope-badge";
import ClaudeMdEditor from "@/components/editors/ClaudeMdEditor";
import FileDirectoryEditor from "@/components/editors/FileDirectoryEditor";
import HooksUnifiedEditor from "@/components/editors/HooksUnifiedEditor";
import AgentEditor from "@/components/agents/AgentEditor";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import type { ClaudeSettings } from "@/lib/settings-schema";

interface Project {
  id: string;
  name: string;
  path: string;
  description: string;
  files: { id: string; type: string; scope: string; updatedAt: number }[];
}

type SettingsScope = "project" | "local" | "merged";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Settings state
  const [settingsScope, setSettingsScope] = useState<SettingsScope>("project");
  const [editMode, setEditMode] = useState<"form" | "json">("form");
  const [rawContent, setRawContent] = useState("{}");
  const [savedContent, setSavedContent] = useState("{}");
  const [settings, setSettings] = useState<ClaudeSettings>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hasChanges = rawContent !== savedContent;
  const isMergedView = settingsScope === "merged";

  const loadProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) setProject(await res.json());
    } catch {
      // network error — project stays null
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadProject(); }, [loadProject]);

  const loadSettings = useCallback(async (scope: SettingsScope) => {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const url = scope === "merged"
        ? `/api/projects/${id}/settings/merged`
        : `/api/projects/${id}/settings?scope=${scope}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSettingsError(data.error || `Failed to load settings (${res.status})`);
        return;
      }
      const data = await res.json();
      const config = scope === "merged"
        ? JSON.stringify(data.merged, null, 2)
        : (data.config || "{}");
      setRawContent(config); setSavedContent(config);
    } catch {
      setSettingsError("Failed to connect to server");
    } finally { setSettingsLoading(false); }
  }, [id]);

  useEffect(() => {
    try { setSettings(JSON.parse(rawContent)); setParseError(null); }
    catch (e) { setParseError(e instanceof Error ? e.message : "Invalid JSON"); }
  }, [rawContent]);

  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  const handleFormChange = (next: ClaudeSettings) => { setRawContent(JSON.stringify(next, null, 2)); };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}/settings?scope=${settingsScope}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: rawContent }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Save failed");
        return;
      }
      setSavedContent(rawContent);
    } finally { setSaving(false); }
  };

  const handleScopeChange = (newScope: string) => {
    if (hasChanges && !confirm("You have unsaved changes. Switch scope anyway?")) return;
    setSettingsScope(newScope as SettingsScope);
    loadSettings(newScope as SettingsScope);
  };

  const copyToOtherScope = async () => {
    const targetScope = settingsScope === "project" ? "local" : "project";
    if (!confirm(`Copy current settings to ${targetScope} scope?`)) return;
    try {
      const res = await fetch(`/api/projects/${id}/settings?scope=${targetScope}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: rawContent }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Copy failed");
        return;
      }
      alert(`Copied to ${targetScope} scope`);
    } catch {
      alert("Copy failed");
    }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (!project) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground mb-2">Project not found.</p>
        <Link href="/projects"><Button variant="link">Back to list</Button></Link>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/projects" className="text-muted-foreground hover:text-foreground">&larr;</Link>
          <h1 className="text-xl font-bold">{project.name}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{project.path}</p>
      </div>

      <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden" onValueChange={(val) => {
        if (val === "settings" || val === "hooks") loadSettings(settingsScope);
      }}>
        <TabsList variant="line" className="px-4 border-b border-border">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="claude-md">CLAUDE.md</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="hooks">Hooks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex-1 overflow-y-auto p-6 space-y-6">
          {project.description && <p className="text-muted-foreground">{project.description}</p>}
          <div>
            <h3 className="font-semibold mb-3">Config Files ({project.files.length})</h3>
            {project.files.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files yet. Use Import or the Settings/CLAUDE.md tabs.</p>
            ) : (
              <div className="space-y-1">
                {project.files.map((f) => (
                  <Card key={f.id} size="sm">
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{f.type}</span>
                          <ScopeBadge scope={f.scope} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{new Date(f.updatedAt).toLocaleDateString("ko-KR")}</span>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-6 w-6 p-0"
                            onClick={async () => {
                              if (!confirm("Delete this file?")) return;
                              try {
                                const res = await fetch(`/api/projects/${id}/files/${f.id}`, { method: "DELETE" });
                                if (!res.ok) {
                                  const data = await res.json().catch(() => ({}));
                                  alert(data.error || "Delete failed");
                                  return;
                                }
                                loadProject();
                              } catch {
                                alert("Delete failed");
                              }
                            }}
                          >
                            &times;
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center border-b border-border px-4 py-2 gap-2">
            {(["project", "local", "merged"] as const).map((s) => (
              <Button
                key={s}
                variant={settingsScope === s ? "secondary" : "ghost"}
                size="sm"
                onClick={() => handleScopeChange(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
            <div className="mx-2 h-4 w-px bg-border" />
            {(["form", "json"] as const).map((m) => (
              <Button
                key={m}
                variant={editMode === m ? "secondary" : "ghost"}
                size="xs"
                onClick={() => setEditMode(m)}
                disabled={isMergedView}
              >
                {m === "form" ? "Form" : "JSON"}
              </Button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {isMergedView && <span className="text-xs text-muted-foreground">Read-only</span>}
              {hasChanges && !isMergedView && <span className="text-xs text-yellow-400">Unsaved</span>}
              <Button onClick={saveSettings} disabled={!hasChanges || saving || isMergedView}>
                {saving ? "Saving..." : "Save"}
              </Button>
              {!isMergedView && (
                <Button variant="outline" onClick={copyToOtherScope} disabled={hasChanges}>
                  Copy to {settingsScope === "project" ? "Local" : "Project"}
                </Button>
              )}
            </div>
          </div>

          {settingsLoading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading...</div>
          ) : settingsError ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                {settingsError}
                <Button variant="link" className="ml-2" onClick={() => loadSettings(settingsScope)}>Retry</Button>
              </div>
            </div>
          ) : isMergedView ? (
            <div className="flex-1 overflow-hidden">
              <JsonEditor value={rawContent} onChange={setRawContent} readOnly />
            </div>
          ) : editMode === "form" ? (
            parseError ? (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">JSON is invalid. Switch to JSON mode to fix.</div>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <SettingsForm settings={settings} onChange={handleFormChange} hideHooks={!isMergedView} />
              </div>
            )
          ) : (
            <div className="flex-1 overflow-hidden">
              <JsonEditor value={rawContent} onChange={setRawContent} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="claude-md" className="flex-1 overflow-hidden">
          <ClaudeMdEditor projectId={id} />
        </TabsContent>

        <TabsContent value="agents" className="flex-1 overflow-hidden">
          <AgentEditor projectId={id} />
        </TabsContent>

        <TabsContent value="rules" className="flex-1 overflow-hidden">
          <FileDirectoryEditor projectId={id} type="rules" fileExtension=".md" editorLanguage="markdown" />
        </TabsContent>

        <TabsContent value="hooks" className="flex-1 overflow-hidden">
          <HooksUnifiedEditor
            projectId={id}
            settingsScope={settingsScope === "merged" ? "project" : settingsScope as "project" | "local"}
            projectPath={project.path}
            initialSettings={settings}
            onSettingsSaved={(updated) => {
              const json = JSON.stringify(updated, null, 2);
              setRawContent(json);
              setSavedContent(json);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
