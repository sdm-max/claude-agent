"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import CodeEditor from "./CodeEditor";
import EditorToolbar from "./EditorToolbar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

function getTemplate(type: "agents" | "rules" | "hooks", fileName: string): string {
  if (type === "agents") {
    return `# ${fileName.replace(/\.md$/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}

## Mandatory Rules
- Follow all governance rules
- Follow all project rules
- No speculation — evidence only

## Role
[Describe the agent's role and responsibilities]

## Required Actions
1. [First action]
2. [Second action]

## Prohibitions
- [What this agent must NOT do]

## Output Format
- [Expected output structure]
`;
  }
  if (type === "rules") {
    return `# ${fileName.replace(/\.md$/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}

## Rules

1. [Rule description]
   - Rationale: [Why this rule exists]

2. [Rule description]
   - Rationale: [Why this rule exists]
`;
  }
  // hooks (.sh)
  return `#!/bin/bash
# ${fileName.replace(/\.sh$/, "")}
# Hook script for Claude Code
#
# Input: JSON on stdin
# Output: JSON on stdout (optional)

set -euo pipefail

# Read input
INPUT=$(cat)

# Process
# echo "$INPUT" | jq '.tool_name' -r

# Output (optional - for blocking hooks)
# echo '{"decision": "block", "reason": "Blocked by hook"}'
`;
}

interface FileEntry {
  name: string;
  content: string;
  pinned?: boolean;
  memoryKey?: string;
  label?: string;
}

interface Props {
  projectId: string;
  type: "agents" | "rules" | "hooks";
  fileExtension: string;
  editorLanguage: "markdown" | "shell";
  onFilesChange?: (files: { name: string }[]) => void;
}

export default function FileDirectoryEditor({
  projectId,
  type,
  fileExtension,
  editorLanguage,
  onFilesChange,
}: Props) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // New file dialog
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [creating, setCreating] = useState(false);

  // Unsaved-changes guard when switching files
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);

  const hasChanges = content !== savedContent;
  const hasChangesRef = useRef(hasChanges);
  useEffect(() => { hasChangesRef.current = hasChanges; }, [hasChanges]);
  const selectedNameRef = useRef(selectedName);
  useEffect(() => { selectedNameRef.current = selectedName; }, [selectedName]);

  const apiBase = `/api/projects/${projectId}/${type}`;

  // ── Fetch file list ──────────────────────────────────────────────────────
  // silent=true skips alert on error (used by focus listener) and skips spinner
  const fetchFiles = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (!silent) setLoading(true);
      try {
        const res = await fetch(apiBase);
        if (res.ok) {
          const data: FileEntry[] = await res.json();
          setFiles(data);
          onFilesChange?.(data);

          // Stale-safe: if the currently selected file vanished externally and
          // user has no unsaved edits, close the editor. If user is editing,
          // keep their buffer — list updates but editor is untouched.
          const currentSelected = selectedNameRef.current;
          if (currentSelected && !data.some((f) => f.name === currentSelected)) {
            if (!hasChangesRef.current) {
              setSelectedName(null);
              setContent("");
              setSavedContent("");
            }
          }
        } else if (!silent) {
          const err = await res.json().catch(() => ({}));
          alert(err.error || `Failed to load files (${res.status})`);
        }
      } catch {
        if (!silent) alert("Network error: Failed to load files");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [apiBase, onFilesChange],
  );

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // ── Auto-refresh on window focus (catches external filesystem changes) ──
  useEffect(() => {
    const onFocus = () => { void fetchFiles({ silent: true }); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchFiles]);

  // ── beforeunload guard ───────────────────────────────────────────────────
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  // ── Select a file ────────────────────────────────────────────────────────
  const selectFile = (name: string) => {
    if (name === selectedName) return;
    if (hasChanges) {
      setPendingSelect(name);
      return;
    }
    applySelect(name);
  };

  const applySelect = (name: string) => {
    const file = files.find((f) => f.name === name);
    if (!file) return;
    setSelectedName(name);
    setContent(file.content);
    setSavedContent(file.content);
  };

  const confirmSwitch = () => {
    if (pendingSelect) {
      applySelect(pendingSelect);
      setPendingSelect(null);
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!selectedName) return;
    const selected = files.find((f) => f.name === selectedName);
    setSaving(true);
    try {
      const res = await fetch(apiBase, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedName,
          content,
          pinned: selected?.pinned,
          memoryKey: selected?.memoryKey,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Save failed");
        return;
      }
      setSavedContent(content);
      // Sync local cache
      setFiles((prev) =>
        prev.map((f) =>
          f.name === selectedName ? { ...f, content } : f
        )
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Create new file ──────────────────────────────────────────────────────
  const openNewDialog = () => {
    setNewFileName("");
    setShowNewDialog(true);
  };

  const createFile = async () => {
    const rawName = newFileName.trim();
    if (!rawName) return;
    const name = rawName.endsWith(fileExtension)
      ? rawName
      : rawName + fileExtension;
    setCreating(true);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content: getTemplate(type, name) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Create failed");
        return;
      }
      const tmpl = getTemplate(type, name);
      const newEntry: FileEntry = { name, content: tmpl };
      setFiles((prev) => [...prev, newEntry]);
      setShowNewDialog(false);
      setSelectedName(name);
      setContent(tmpl);
      setSavedContent(tmpl);
    } catch {
      alert("Network error: Create failed");
    } finally {
      setCreating(false);
    }
  };

  // ── Delete file ──────────────────────────────────────────────────────────
  const deleteFile = async (name: string) => {
    const entry = files.find((f) => f.name === name);
    if (entry?.pinned) {
      alert("프로젝트 메모리 파일(CLAUDE.md)은 UI에서 삭제할 수 없습니다");
      return;
    }
    if (!confirm(`Delete "${name}"?`)) return;
    let res: Response;
    try {
      res = await fetch(`${apiBase}?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
    } catch {
      alert("Network error: Delete failed");
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Delete failed");
      return;
    }
    setFiles((prev) => prev.filter((f) => f.name !== name));
    if (selectedName === name) {
      setSelectedName(null);
      setContent("");
      setSavedContent("");
    }
  };

  // ── Label helpers ─────────────────────────────────────────────────────────
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel: file list ── */}
      <div className="w-64 shrink-0 flex flex-col border-r border-border bg-card">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-medium text-foreground">
            {typeLabel}
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({files.length})
            </span>
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="xs"
              onClick={() => fetchFiles()}
              disabled={loading}
              title="Refresh file list"
            >
              {loading ? "..." : "↻"}
            </Button>
            <Button variant="outline" size="xs" onClick={openNewDialog}>
              New
            </Button>
          </div>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto py-1">
          {loading && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Loading...
            </p>
          )}
          {!loading && files.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No files yet
            </p>
          )}
          {(() => {
            const pinnedFiles = files.filter((f) => f.pinned);
            const regularFiles = files.filter((f) => !f.pinned);
            const renderRow = (file: FileEntry) => {
              const isActive = file.name === selectedName;
              return (
                <div
                  key={file.name}
                  className={`group flex items-center justify-between px-3 py-1.5 cursor-pointer ${
                    isActive
                      ? "bg-secondary text-primary"
                      : "hover:bg-accent text-foreground"
                  }`}
                  onClick={() => selectFile(file.name)}
                  title={file.label ?? (file.pinned ? "Project memory" : undefined)}
                >
                  <span className="text-xs truncate min-w-0 flex-1 font-mono">
                    {file.pinned ? "📌 " : ""}
                    {file.name}
                  </span>
                  {!file.pinned && (
                    <button
                      className="ml-1 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity text-sm leading-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFile(file.name);
                      }}
                      title={`Delete ${file.name}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            };
            return (
              <>
                {pinnedFiles.length > 0 && (
                  <>
                    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Project Memory
                    </div>
                    {pinnedFiles.map(renderRow)}
                    {regularFiles.length > 0 && (
                      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {typeLabel}
                      </div>
                    )}
                  </>
                )}
                {regularFiles.map(renderRow)}
              </>
            );
          })()}
        </div>
      </div>

      {/* ── Right panel: editor ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedName ? (
          <>
            <EditorToolbar
              hasChanges={hasChanges}
              onSave={save}
              saving={saving}
            />
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                value={content}
                onChange={setContent}
                language={editorLanguage}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a file or create a new one
          </div>
        )}
      </div>

      {/* ── Unsaved changes switch guard ── */}
      <Dialog
        open={!!pendingSelect}
        onOpenChange={(open) => {
          if (!open) setPendingSelect(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You have unsaved changes. Switch files and discard them?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingSelect(null)}>
              Cancel
            </Button>
            <Button onClick={confirmSwitch}>Discard &amp; Switch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New file dialog ── */}
      <Dialog
        open={showNewDialog}
        onOpenChange={(open) => {
          if (!open) setShowNewDialog(false);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New {typeLabel.slice(0, -1)} File</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted-foreground">
              File name
              <span className="ml-1 text-xs opacity-60">
                ({fileExtension} will be appended if omitted)
              </span>
            </label>
            <Input
              autoFocus
              placeholder={`example${fileExtension}`}
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createFile();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={createFile}
              disabled={!newFileName.trim() || creating}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
