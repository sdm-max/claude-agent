"use client";

import { useState, useEffect } from "react";
import CodeEditor from "./CodeEditor";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface VersionListItem {
  id: string;
  createdAt: number;
  relativePath: string;
  preview?: string;
}

interface VersionDetail extends VersionListItem {
  content: string;
}

interface Props {
  projectId: string | null;
  relativePath: string;
  open: boolean;
  onClose: () => void;
  onRestore: (content: string) => void;
  language?: "markdown" | "json";
}

export default function VersionHistory({ projectId, relativePath, open, onClose, onRestore, language = "markdown" }: Props) {
  const [versions, setVersions] = useState<VersionListItem[]>([]);
  const [selected, setSelected] = useState<VersionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const listUrl = projectId
    ? `/api/projects/${projectId}/versions?relativePath=${encodeURIComponent(relativePath)}`
    : `/api/user/versions?relativePath=${encodeURIComponent(relativePath)}`;

  useEffect(() => {
    if (!open || !relativePath) return;
    setLoading(true);
    fetch(listUrl)
      .then((r) => r.json())
      .then((data) => { setVersions(Array.isArray(data) ? data : []); setSelected(null); })
      .finally(() => setLoading(false));
  }, [open, listUrl, relativePath]);

  const loadDetail = async (v: VersionListItem) => {
    const detailUrl = projectId
      ? `/api/projects/${projectId}/versions/${v.id}`
      : `/api/user/versions/${v.id}`;
    const res = await fetch(detailUrl);
    if (res.ok) {
      const data = await res.json();
      setSelected({ id: v.id, createdAt: v.createdAt, relativePath: v.relativePath, content: data.content });
    }
  };

  const restore = async () => {
    if (!selected) return;
    const url = projectId ? `/api/projects/${projectId}/versions` : `/api/user/versions`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId: selected.id }),
    });
    if (res.ok) {
      const data = await res.json();
      onRestore(data.content || selected.content);
      onClose();
    } else {
      alert("Restore failed");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-[600px] sm:max-w-[600px] flex flex-col p-0">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle>Version History</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="p-4 text-muted-foreground">Loading...</div>
        ) : versions.length === 0 ? (
          <div className="p-4 text-muted-foreground">No version history.</div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="border-b border-border max-h-64 overflow-y-auto">
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => loadDetail(v)}
                  className={`w-full text-left px-4 py-2 hover:bg-muted transition-colors border-b border-border/50 last:border-b-0 ${
                    selected?.id === v.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="text-xs text-muted-foreground">
                    {new Date(v.createdAt).toLocaleString("ko-KR")}
                  </div>
                  <div className="text-sm font-mono truncate mt-0.5">
                    {v.preview || <span className="text-muted-foreground italic">(empty)</span>}
                  </div>
                </button>
              ))}
            </div>

            {selected && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">
                    {new Date(selected.createdAt).toLocaleString("ko-KR")}
                  </span>
                  <Button size="sm" onClick={restore}>
                    Restore this version
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <CodeEditor value={selected.content} onChange={() => {}} language={language} readOnly />
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
