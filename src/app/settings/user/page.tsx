"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import SettingsForm, { type PermissionsTrace } from "@/components/settings-form";
import JsonEditor from "@/components/json-editor";
import ScopeBadge from "@/components/scope-badge";
import VersionHistory from "@/components/editors/VersionHistory";
import ClaudeMdEditor from "@/components/editors/ClaudeMdEditor";
import FileDirectoryEditor from "@/components/editors/FileDirectoryEditor";
import HooksUnifiedEditor from "@/components/editors/HooksUnifiedEditor";
import ConflictBanner from "@/components/settings/ConflictBanner";
import AppliedTemplatesBar from "@/components/settings/AppliedTemplatesBar";
import SaveAsTemplateDialog from "@/components/settings/SaveAsTemplateDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ClaudeSettings } from "@/lib/settings-schema";
import { useHomeEvents } from "@/hooks/use-home-events";

export default function UserSettingsPage() {
  const scope = "user";

  // ── Settings state (inline from SettingsPage) ──
  const [rawContent, setRawContent] = useState("{}");
  const [savedContent, setSavedContent] = useState("{}");
  const [settings, setSettings] = useState<ClaudeSettings>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState<"form" | "json">("form");
  const [showHistory, setShowHistory] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [trace, setTrace] = useState<PermissionsTrace | null>(null);

  // For Hooks tab: homePath from /api/user/info
  const [homePath, setHomePath] = useState<string | null>(null);

  const hasChanges = rawContent !== savedContent;
  const hasChangesRef = useRef(hasChanges);
  useEffect(() => { hasChangesRef.current = hasChanges; }, [hasChanges]);

  // ── Load user info ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/info");
        if (res.ok) {
          const data = await res.json();
          setHomePath(data.homePath);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // ── Load settings ──
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/settings?scope=${scope}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Failed to load settings (${res.status})`);
        return;
      }
      const data = await res.json();
      const config = data.config || "{}";
      setRawContent(config);
      setSavedContent(config);
    } catch {
      setError("Failed to connect to server");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Load trace ──
  const loadTrace = useCallback(async () => {
    try {
      const res = await fetch(`/api/templates/applied/trace?scope=user`);
      if (!res.ok) { setTrace(null); return; }
      setTrace(await res.json());
    } catch { setTrace(null); }
  }, []);

  useEffect(() => { loadTrace(); }, [loadTrace]);

  // ── SSE ──
  useHomeEvents((event) => {
    if (event.kind !== "user-settings") return;
    if (hasChangesRef.current) return;
    void load();
    void loadTrace();
  });

  // ── Focus fallback ──
  useEffect(() => {
    const refresh = () => {
      if (hasChangesRef.current) return;
      void load();
    };
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  // ── Parse JSON ──
  useEffect(() => {
    try { setSettings(JSON.parse(rawContent)); setParseError(null); }
    catch (e) { setParseError(e instanceof Error ? e.message : "Invalid JSON"); }
  }, [rawContent]);

  // ── beforeunload ──
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  const handleFormChange = (next: ClaudeSettings) => {
    setRawContent(JSON.stringify(next, null, 2));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/settings?scope=${scope}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: rawContent }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Save failed");
        return;
      }
      setSavedContent(rawContent);
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">User Settings</h1>
          <ScopeBadge scope="user" />
        </div>
      </div>

      <Tabs defaultValue="settings" className="flex-1 flex flex-col overflow-hidden" onValueChange={(val) => {
        if (val === "settings" || val === "hooks") { void load(); void loadTrace(); }
      }}>
        <TabsList variant="line" className="px-4 border-b border-border">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="claude-md">CLAUDE.md</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="hooks">Hooks</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
        </TabsList>

        {/* ── Settings Tab ── */}
        <TabsContent value="settings" className="flex-1 flex flex-col overflow-hidden">
          <ConflictBanner settings={settings} />
          <AppliedTemplatesBar scope="user" onUndo={() => { void load(); void loadTrace(); }} />
          <div className="flex items-center border-b border-border px-4 py-2 gap-2">
            {(["form", "json"] as const).map((m) => (
              <Button
                key={m}
                variant={editMode === m ? "secondary" : "ghost"}
                size="xs"
                onClick={() => setEditMode(m)}
              >
                {m === "form" ? "Form" : "JSON"}
              </Button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {hasChanges && <span className="text-xs text-yellow-400">Unsaved changes</span>}
              <Button onClick={save} disabled={!hasChanges || saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={() => setShowHistory(true)}>
                History
              </Button>
              <Button variant="outline" onClick={() => setSaveAsOpen(true)} disabled={!!parseError}>
                Save as Card
              </Button>
            </div>
          </div>

          <SaveAsTemplateDialog
            open={saveAsOpen}
            onOpenChange={setSaveAsOpen}
            currentSettings={settings}
            defaultScope="user"
          />

          <VersionHistory
            projectId={null}
            relativePath="~/.claude/settings.json"
            open={showHistory}
            onClose={() => setShowHistory(false)}
            onRestore={async (c) => {
              setRawContent(c);
              try {
                await fetch("/api/templates/applied/invalidate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ scope: "user" }),
                });
                void loadTrace();
              } catch (e) { console.error("Failed to invalidate applied templates:", e); }
            }}
            language="json"
          />

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">Loading...</div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm max-w-md">
                {error}
                <Button variant="link" className="ml-2" onClick={load}>Retry</Button>
              </div>
            </div>
          ) : editMode === "form" ? (
            parseError ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm max-w-md">
                  JSON is invalid. Switch to JSON tab to fix syntax errors.
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <SettingsForm settings={settings} onChange={handleFormChange} trace={trace} />
              </div>
            )
          ) : (
            <div className="flex-1 overflow-hidden">
              <JsonEditor value={rawContent} onChange={setRawContent} />
            </div>
          )}
        </TabsContent>

        {/* ── CLAUDE.md Tab ── */}
        <TabsContent value="claude-md" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-yellow-500/10">
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              This file is ~/.claude/CLAUDE.md and applies to all Claude sessions across all projects.
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <ClaudeMdEditor projectId={null} fixedScope="user" />
          </div>
        </TabsContent>

        {/* ── Rules Tab ── */}
        <TabsContent value="rules" className="flex-1 overflow-hidden">
          <FileDirectoryEditor
            projectId={null}
            type="rules"
            fileExtension=".md"
            editorLanguage="markdown"
          />
        </TabsContent>

        {/* ── Hooks Tab ── */}
        <TabsContent value="hooks" className="flex-1 overflow-hidden">
          <HooksUnifiedEditor
            projectId={null}
            settingsScope="user"
            projectPath={homePath}
            initialSettings={settings}
            onSettingsSaved={(updated) => {
              const json = JSON.stringify(updated, null, 2);
              setRawContent(json);
              setSavedContent(json);
            }}
          />
        </TabsContent>

        {/* ── Agents Tab ── */}
        <TabsContent value="agents" className="flex-1 overflow-hidden">
          <FileDirectoryEditor
            projectId={null}
            type="agents"
            fileExtension=".md"
            editorLanguage="markdown"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
