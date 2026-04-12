"use client";

import { useState, useEffect, useCallback } from "react";
import CodeEditor from "./CodeEditor";
import EditorToolbar from "./EditorToolbar";
import VersionHistory from "./VersionHistory";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const SCOPE_OPTIONS = ["user", "project", "local"] as const;

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

export default function ClaudeMdEditor({ projectId, onHasChanges }: Props) {
  const [scope, setScope] = useState("project");
  const [file, setFile] = useState<FileRecord | null>(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingScope, setPendingScope] = useState<string | null>(null);
  const [importingMd, setImportingMd] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [exportingMd, setExportingMd] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);

  const hasChanges = content !== savedContent;

  useEffect(() => { onHasChanges?.(hasChanges); }, [hasChanges, onHasChanges]);

  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  const loadFile = useCallback(async (s: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/files?type=claude-md&scope=${s}`);
      const data = await res.json();
      if (data.length > 0) { setFile(data[0]); setContent(data[0].content); setSavedContent(data[0].content); }
      else { setFile(null); setContent(""); setSavedContent(""); }
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { loadFile(scope); }, [scope, loadFile]);

  const handleScopeChange = (newScope: string) => {
    if (hasChanges) { setPendingScope(newScope); } else { setScope(newScope); }
  };

  const confirmScopeSwitch = () => {
    if (pendingScope) { setScope(pendingScope); setPendingScope(null); }
  };

  const importFromDisk = async () => {
    setImportingMd(true);
    setImportResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/import-claudemd?scope=${scope}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setImportResult(`Imported from ${data.path}`);
        loadFile(scope);
      } else {
        setImportResult(`Error: ${data.error}`);
      }
    } catch {
      setImportResult("Import failed");
    } finally { setImportingMd(false); }
  };

  const exportToDisk = async () => {
    setExportingMd(true);
    setExportResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/export-claudemd?scope=${scope}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setExportResult(`Exported to ${data.path}`);
      } else {
        setExportResult(`Error: ${data.error}`);
      }
    } catch {
      setExportResult("Export failed");
    } finally { setExportingMd(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      if (file) {
        const res = await fetch(`/api/projects/${projectId}/files/${file.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
        if (!res.ok) { alert("Save failed"); return; }
      } else {
        const res = await fetch(`/api/projects/${projectId}/files`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "claude-md", scope, content }) });
        if (!res.ok) { alert("Save failed"); return; }
        setFile(await res.json());
      }
      setSavedContent(content);
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
      </div>
      <EditorToolbar
        hasChanges={hasChanges}
        onSave={save}
        onHistory={file ? () => setShowHistory(true) : undefined}
        saving={saving}
        extraButtons={
          <>
            <Button variant="outline" size="sm" onClick={importFromDisk} disabled={importingMd || hasChanges}>
              {importingMd ? "Importing..." : "Import from disk"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportToDisk} disabled={exportingMd || hasChanges || !file}>
              {exportingMd ? "Exporting..." : "Export to disk"}
            </Button>
            {importResult && <span className={`text-xs ${importResult.startsWith("Error") ? "text-destructive" : "text-green-400"}`}>{importResult}</span>}
            {exportResult && <span className={`text-xs ${exportResult.startsWith("Error") ? "text-destructive" : "text-green-400"}`}>{exportResult}</span>}
          </>
        }
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

      {file && (
        <VersionHistory
          projectId={projectId}
          fileId={file.id}
          open={showHistory}
          onClose={() => setShowHistory(false)}
          onRestore={(c) => setContent(c)}
          language="markdown"
        />
      )}
    </div>
  );
}
