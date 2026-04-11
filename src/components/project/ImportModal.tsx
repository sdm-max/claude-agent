"use client";

import { useState } from "react";
import Modal from "../ui/Modal";

interface DetectedFile {
  type: string;
  scope: string;
  path: string;
  content: string;
}

interface Props {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function ImportModal({ projectId, open, onClose, onImported }: Props) {
  const [files, setFiles] = useState<DetectedFile[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [scanned, setScanned] = useState(false);

  const scan = async () => {
    setScanning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/import`, { method: "POST" });
      const data = await res.json();
      setFiles(data.files || []);
      setSelected(new Set(data.files?.map((_: unknown, i: number) => i) || []));
      setScanned(true);
    } finally {
      setScanning(false);
    }
  };

  const doImport = async () => {
    setImporting(true);
    try {
      const selectedFiles = files.filter((_, i) => selected.has(i));
      await fetch(`/api/projects/${projectId}/import`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: selectedFiles }),
      });
      onImported();
      onClose();
    } finally {
      setImporting(false);
    }
  };

  const toggle = (i: number) => {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
  };

  return (
    <Modal open={open} onClose={onClose} title="파일 임포트">
      {!scanned ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">
            프로젝트 경로를 스캔하여 Claude 설정 파일을 찾습니다.
          </p>
          <button
            onClick={scan}
            disabled={scanning}
            className="w-full py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-sm"
          >
            {scanning ? "스캔 중..." : "스캔 시작"}
          </button>
        </div>
      ) : files.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">발견된 파일이 없습니다.</p>
      ) : (
        <div className="space-y-4">
          <div className="max-h-60 overflow-y-auto space-y-1">
            {files.map((f, i) => (
              <label key={i} className="flex items-center gap-2 p-2 rounded hover:bg-[var(--bg-input)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggle(i)}
                  className="accent-[var(--accent)]"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{f.path}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {f.type} · {f.scope} · {f.content.length} chars
                  </div>
                </div>
              </label>
            ))}
          </div>
          <button
            onClick={doImport}
            disabled={importing || selected.size === 0}
            className="w-full py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-sm"
          >
            {importing ? "임포트 중..." : `선택한 ${selected.size}개 파일 임포트`}
          </button>
        </div>
      )}
    </Modal>
  );
}
