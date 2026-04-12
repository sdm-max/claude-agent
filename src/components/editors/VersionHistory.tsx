"use client";

import { useState, useEffect } from "react";
import CodeEditor from "./CodeEditor";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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
      .then((data) => { setVersions(data); setSelected(null); })
      .finally(() => setLoading(false));
  }, [open, projectId, fileId]);

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
            <div className="border-b border-border max-h-48 overflow-y-auto">
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelected(v)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors ${
                    selected?.id === v.id ? "bg-muted" : ""
                  }`}
                >
                  {new Date(v.createdAt).toLocaleString("ko-KR")}
                </button>
              ))}
            </div>

            {selected && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">
                    {new Date(selected.createdAt).toLocaleString("ko-KR")}
                  </span>
                  <Button size="sm" onClick={() => { onRestore(selected.content); onClose(); }}>
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
