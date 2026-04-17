"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import SettingsForm from "./settings-form";
import JsonEditor from "./json-editor";
import ScopeBadge from "./scope-badge";
import VersionHistory from "./editors/VersionHistory";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SaveAsTemplateDialog from "@/components/settings/SaveAsTemplateDialog";
import type { ClaudeSettings } from "@/lib/settings-schema";
import { useHomeEvents } from "@/hooks/use-home-events";

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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);

  const hasChanges = rawContent !== savedContent;
  const hasChangesRef = useRef(hasChanges);
  useEffect(() => { hasChangesRef.current = hasChanges; }, [hasChanges]);

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
  }, [scope]);

  useEffect(() => { load(); }, [load]);

  useHomeEvents((event) => {
    if (event.kind !== "user-settings") return;
    if (hasChanges) return;
    void load();
  });

  // Fallback for Chrome ERR_NETWORK_IO_SUSPENDED on backgrounded tabs.
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
          <h1 className="text-xl font-bold">{title}</h1>
          <ScopeBadge scope={scope} />
        </div>
        <div className="flex items-center gap-2">
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
        defaultScope={scope}
      />

      <VersionHistory
        projectId={null}
        relativePath={scope === "global" ? "~/.claude/managed-settings.json" : "~/.claude/settings.json"}
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onRestore={(c) => setRawContent(c)}
        language="json"
      />

      <Tabs defaultValue="form" className="flex-1 flex flex-col overflow-hidden">
        <TabsList variant="line" className="px-4 border-b border-border">
          <TabsTrigger value="form">Form</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
          {parseError && (
            <span className="ml-auto self-center mr-4 text-xs text-destructive">JSON parse error: {parseError}</span>
          )}
        </TabsList>

        <TabsContent value="form" className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">Loading...</div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm max-w-md">
                {error}
                <Button variant="link" className="ml-2" onClick={load}>Retry</Button>
              </div>
            </div>
          ) : parseError ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm max-w-md">
                JSON is invalid. Switch to JSON tab to fix syntax errors.
              </div>
            </div>
          ) : (
            <SettingsForm settings={settings} onChange={handleFormChange} />
          )}
        </TabsContent>

        <TabsContent value="json" className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">Loading...</div>
          ) : (
            <JsonEditor value={rawContent} onChange={setRawContent} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
