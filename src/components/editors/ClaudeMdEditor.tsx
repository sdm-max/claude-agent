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

  const hasChanges = content !== savedContent;

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

  // Load file for current scope
  const loadFile = useCallback(async (s: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/files?type=claude-md&scope=${s}`);
      const data = await res.json();
      if (data.length > 0) {
        setFile(data[0]);
        setContent(data[0].content);
        setSavedContent(data[0].content);
      } else {
        setFile(null);
        setContent("");
        setSavedContent("");
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

  const save = async () => {
    setSaving(true);
    try {
      if (file) {
        await fetch(`/api/projects/${projectId}/files/${file.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
      } else {
        const res = await fetch(`/api/projects/${projectId}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "claude-md", scope, content }),
        });
        const created = await res.json();
        setFile(created);
      }
      setSavedContent(content);
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = (restoredContent: string) => {
    setContent(restoredContent);
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs tabs={SCOPE_TABS} activeTab={scope} onTabChange={handleScopeChange} />
      <EditorToolbar
        hasChanges={hasChanges}
        onSave={save}
        onHistory={file ? () => setShowHistory(true) : undefined}
        saving={saving}
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">로딩 중...</div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <CodeEditor value={content} onChange={setContent} language="markdown" />
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
          language="markdown"
        />
      )}
    </div>
  );
}
