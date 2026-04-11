"use client";

import { useState, useEffect } from "react";
import CodeEditor from "./CodeEditor";

interface Version {
  id: string;
  content: string;
  createdAt: number;
}

interface Props {
  projectId: string;
  fileId: string;
  open: boolean;
  onClose: () => void;
  onRestore: (content: string) => void;
  language?: "markdown" | "json";
}

export default function VersionHistory({ projectId, fileId, open, onClose, onRestore, language = "markdown" }: Props) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selected, setSelected] = useState<Version | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !fileId) return;
    setLoading(true);
    fetch(`/api/projects/${projectId}/files/${fileId}/versions`)
      .then((r) => r.json())
      .then((data) => {
        setVersions(data);
        setSelected(null);
      })
      .finally(() => setLoading(false));
  }, [open, projectId, fileId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[600px] bg-[var(--bg-card)] border-l border-[var(--border)] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="font-semibold">버전 히스토리</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            &times;
          </button>
        </div>

        {loading ? (
          <div className="p-4 text-[var(--text-muted)]">로딩 중...</div>
        ) : versions.length === 0 ? (
          <div className="p-4 text-[var(--text-muted)]">버전 히스토리가 없습니다.</div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="border-b border-[var(--border)] max-h-48 overflow-y-auto">
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelected(v)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--bg-input)] ${
                    selected?.id === v.id ? "bg-[var(--bg-input)]" : ""
                  }`}
                >
                  {new Date(v.createdAt).toLocaleString("ko-KR")}
                </button>
              ))}
            </div>

            {selected && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-2 border-b border-[var(--border)]">
                  <span className="text-sm text-[var(--text-muted)]">
                    {new Date(selected.createdAt).toLocaleString("ko-KR")}
                  </span>
                  <button
                    onClick={() => {
                      onRestore(selected.content);
                      onClose();
                    }}
                    className="px-3 py-1 text-sm rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white"
                  >
                    이 버전으로 복원
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <CodeEditor value={selected.content} onChange={() => {}} language={language} readOnly />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
