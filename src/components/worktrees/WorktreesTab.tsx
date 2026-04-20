"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Worktree {
  path: string;
  branch: string | null;
  head: string | null;
  isMain: boolean;
}

type DiffStatus = "only-in-master" | "only-in-worktree" | "same" | "differ";
type SyncAction = "copy-to-worktree" | "copy-to-master" | "skip";

interface DiffFile {
  name: string;
  status: DiffStatus;
  masterSha: string | null;
  worktreeSha: string | null;
}

interface DiffResponse {
  masterPath: string;
  worktreePath: string;
  files: DiffFile[];
}

interface SyncResponse {
  applied: number;
  errors: Array<{ file: string; error: string }>;
}

const STATUS_LABEL: Record<DiffStatus, { text: string; className: string }> = {
  same: { text: "same", className: "text-muted-foreground" },
  differ: { text: "differ", className: "text-yellow-500" },
  "only-in-master": { text: "only in master", className: "text-blue-400" },
  "only-in-worktree": { text: "only in worktree", className: "text-purple-400" },
};

function shortSha(sha: string | null): string {
  return sha ? sha.slice(0, 7) : "—";
}

function defaultAction(status: DiffStatus): SyncAction {
  if (status === "same") return "skip";
  if (status === "only-in-worktree") return "skip";
  // differ or only-in-master → propose push from master
  return "copy-to-worktree";
}

export default function WorktreesTab({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const [actions, setActions] = useState<Record<string, SyncAction>>({});

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);

  const loadWorktrees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/worktrees`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Failed (${res.status})`);
        setWorktrees([]);
        return;
      }
      setWorktrees(Array.isArray(data.worktrees) ? data.worktrees : []);
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadWorktrees(); }, [loadWorktrees]);

  const loadDiff = useCallback(async (worktreePath: string) => {
    setDiffLoading(true);
    setDiffError(null);
    setSyncResult(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/worktrees/rules-diff?worktree=${encodeURIComponent(worktreePath)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDiffError(data.error || `Failed (${res.status})`);
        setDiff(null);
        return;
      }
      setDiff(data as DiffResponse);
      const nextActions: Record<string, SyncAction> = {};
      for (const f of (data as DiffResponse).files) {
        nextActions[f.name] = defaultAction(f.status);
      }
      setActions(nextActions);
    } catch {
      setDiffError("Failed to connect to server");
    } finally {
      setDiffLoading(false);
    }
  }, [projectId]);

  const handleSelect = (wt: Worktree) => {
    if (wt.isMain) return; // nothing to diff against itself
    setSelected(wt.path);
    loadDiff(wt.path);
  };

  const setAction = (name: string, action: SyncAction) => {
    setActions((prev) => ({ ...prev, [name]: action }));
  };

  const runSync = async () => {
    if (!selected || !diff) return;
    const files = diff.files
      .map((f) => ({ name: f.name, action: actions[f.name] ?? "skip" }))
      .filter((e) => e.action !== "skip");
    if (files.length === 0) {
      setSyncResult({ applied: 0, errors: [] });
      return;
    }
    if (!confirm(`Apply ${files.length} change(s)? This will overwrite files on disk.`)) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/worktrees/rules-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worktree: selected, files }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncResult({ applied: 0, errors: [{ file: "*", error: data.error || `HTTP ${res.status}` }] });
      } else {
        setSyncResult(data as SyncResponse);
        // Re-fetch diff to refresh status
        loadDiff(selected);
      }
    } catch {
      setSyncResult({ applied: 0, errors: [{ file: "*", error: "Network error" }] });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading worktrees…</div>;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
          <Button variant="link" className="ml-2" onClick={loadWorktrees}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Git Worktrees ({worktrees.length})</h3>
          <p className="text-xs text-muted-foreground">Select a worktree to diff its <code>.claude/rules/*.md</code> against master.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadWorktrees}>Refresh</Button>
      </div>

      {worktrees.length === 0 ? (
        <p className="text-sm text-muted-foreground">No worktrees found.</p>
      ) : (
        <div className="space-y-2">
          {worktrees.map((wt) => {
            const isSelected = selected === wt.path;
            return (
              <Card key={wt.path} size="sm" className={isSelected ? "border-primary" : undefined}>
                <CardContent>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium truncate">{wt.path}</span>
                        {wt.isMain && <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">master</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span>branch: {wt.branch ?? "—"}</span>
                        <span className="mx-2">·</span>
                        <span>HEAD: {shortSha(wt.head)}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={isSelected ? "secondary" : "outline"}
                      disabled={wt.isMain}
                      onClick={() => handleSelect(wt)}
                    >
                      {wt.isMain ? "master" : isSelected ? "selected" : "Diff rules"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">
              Rules diff vs{" "}
              <code className="text-xs">{selected}</code>
            </h4>
            <Button size="sm" onClick={runSync} disabled={syncing || diffLoading || !diff}>
              {syncing ? "Syncing…" : "Synchronize"}
            </Button>
          </div>

          {diffLoading ? (
            <p className="text-sm text-muted-foreground">Loading diff…</p>
          ) : diffError ? (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{diffError}</div>
          ) : !diff || diff.files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rule files found in either location.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4">File</th>
                    <th className="text-left py-2 pr-4">Status</th>
                    <th className="text-left py-2 pr-4">master</th>
                    <th className="text-left py-2 pr-4">worktree</th>
                    <th className="text-left py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.files.map((f) => {
                    const label = STATUS_LABEL[f.status];
                    const act = actions[f.name] ?? "skip";
                    const disableToWorktree = f.status === "only-in-worktree";
                    const disableToMaster = f.status === "only-in-master";
                    return (
                      <tr key={f.name} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-mono text-xs truncate max-w-[260px]">{f.name}</td>
                        <td className={`py-2 pr-4 text-xs ${label.className}`}>{label.text}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{shortSha(f.masterSha)}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{shortSha(f.worktreeSha)}</td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            <Button
                              size="xs"
                              variant={act === "copy-to-worktree" ? "secondary" : "ghost"}
                              disabled={disableToWorktree || f.status === "same"}
                              onClick={() => setAction(f.name, "copy-to-worktree")}
                              title="Copy master → worktree"
                            >
                              → worktree
                            </Button>
                            <Button
                              size="xs"
                              variant={act === "copy-to-master" ? "secondary" : "ghost"}
                              disabled={disableToMaster || f.status === "same"}
                              onClick={() => setAction(f.name, "copy-to-master")}
                              title="Copy worktree → master"
                            >
                              ← master
                            </Button>
                            <Button
                              size="xs"
                              variant={act === "skip" ? "secondary" : "ghost"}
                              onClick={() => setAction(f.name, "skip")}
                            >
                              skip
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {syncResult && (
            <div
              className={`p-3 rounded-lg text-sm ${
                syncResult.errors.length === 0
                  ? "bg-green-500/10 text-green-500"
                  : "bg-yellow-500/10 text-yellow-500"
              }`}
            >
              <div>Applied: {syncResult.applied}</div>
              {syncResult.errors.length > 0 && (
                <ul className="mt-1 text-xs list-disc list-inside">
                  {syncResult.errors.map((e, i) => (
                    <li key={i}><span className="font-mono">{e.file}</span>: {e.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
