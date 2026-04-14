"use client";

import { useState, useEffect, useCallback } from "react";
import CodeEditor from "./CodeEditor";
import EditorToolbar from "./EditorToolbar";
import VersionHistory from "./VersionHistory";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useProjectEvents } from "@/hooks/use-project-events";

const SCOPE_OPTIONS = ["user", "project", "local"] as const;
type Scope = (typeof SCOPE_OPTIONS)[number];

interface Props {
  projectId: string;
  onHasChanges?: (v: boolean) => void;
}

export default function ClaudeMdEditor({ projectId, onHasChanges }: Props) {
  const [scope, setScope] = useState<Scope>("project");
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [relativePath, setRelativePath] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingScope, setPendingScope] = useState<Scope | null>(null);

  const hasChanges = content !== savedContent;

  useEffect(() => { onHasChanges?.(hasChanges); }, [hasChanges, onHasChanges]);

  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  const loadFile = useCallback(async (s: Scope) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/claudemd?scope=${s}`);
      if (!res.ok) {
        setContent(""); setSavedContent(""); setRelativePath(null); setExists(false);
        return;
      }
      const data = await res.json();
      setContent(data.content || "");
      setSavedContent(data.content || "");
      setRelativePath(data.relativePath);
      setExists(!!data.exists);
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { loadFile(scope); }, [scope, loadFile]);

  useProjectEvents(projectId, (event) => {
    if (event.kind !== "claudemd") return;
    if (hasChanges) return;
    void loadFile(scope);
  });

  const handleScopeChange = (newScope: Scope) => {
    if (hasChanges) { setPendingScope(newScope); } else { setScope(newScope); }
  };

  const confirmScopeSwitch = () => {
    if (pendingScope) { setScope(pendingScope); setPendingScope(null); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/claudemd?scope=${scope}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Save failed");
        return;
      }
      const data = await res.json();
      setSavedContent(content);
      setExists(!!data.exists);
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        {SCOPE_OPTIONS.map((s) => (
          <Button key={s} variant={scope === s ? "secondary" : "ghost"} size="sm" onClick={() => handleScopeChange(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
        {relativePath && <span className="ml-2 text-xs text-muted-foreground">{relativePath}{!exists && " (new)"}</span>}
      </div>
      <EditorToolbar
        hasChanges={hasChanges}
        onSave={save}
        onHistory={relativePath ? () => setShowHistory(true) : undefined}
        saving={saving}
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading...</div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <CodeEditor value={content} onChange={setContent} language="markdown" />
        </div>
      )}

      <Dialog open={!!pendingScope} onOpenChange={(open) => { if (!open) setPendingScope(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Unsaved Changes</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">You have unsaved changes. Switch scope anyway?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingScope(null)}>Cancel</Button>
            <Button onClick={confirmScopeSwitch}>Switch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {relativePath && (
        <VersionHistory
          projectId={scope === "user" ? null : projectId}
          relativePath={relativePath}
          open={showHistory}
          onClose={() => setShowHistory(false)}
          onRestore={(c) => setContent(c)}
          language="markdown"
        />
      )}
    </div>
  );
}
