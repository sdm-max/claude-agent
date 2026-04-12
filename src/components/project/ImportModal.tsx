"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

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
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/import`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Scan failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setFiles(data.files || []);
      setSelected(new Set(data.files?.map((_: unknown, i: number) => i) || []));
      setScanned(true);
    } catch {
      setError("Failed to connect to server");
    } finally { setScanning(false); }
  };

  const doImport = async () => {
    setImporting(true);
    setError(null);
    try {
      const selectedFiles = files.filter((_, i) => selected.has(i));
      const res = await fetch(`/api/projects/${projectId}/import`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: selectedFiles }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Import failed (${res.status})`);
        return;
      }
      onImported();
      onClose();
    } catch {
      setError("Import failed");
    } finally { setImporting(false); }
  };

  const toggle = (i: number) => {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i); else next.add(i);
    setSelected(next);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Files</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        {!scanned ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Scan the project path for Claude configuration files.</p>
            <Button onClick={scan} disabled={scanning} className="w-full">
              {scanning ? "Scanning..." : "Start Scan"}
            </Button>
          </div>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files found.</p>
        ) : (
          <div className="space-y-4">
            <div className="max-h-60 overflow-y-auto space-y-1">
              {files.map((f, i) => (
                <label key={i} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                  <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} className="accent-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{f.path}</div>
                    <div className="flex gap-1 mt-0.5">
                      <Badge variant="outline" className="text-xs">{f.type}</Badge>
                      <Badge variant="secondary" className="text-xs">{f.scope}</Badge>
                      <span className="text-xs text-muted-foreground">{f.content.length} chars</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={doImport} disabled={importing || selected.size === 0} className="w-full sm:w-auto">
                {importing ? "Importing..." : `Import ${selected.size} file(s)`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
