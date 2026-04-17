"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Play, Square, Trash2, Pencil } from "lucide-react";

const SCOPES = [
  { value: "global", label: "Global" },
  { value: "user", label: "User" },
  { value: "project", label: "Project" },
  { value: "local", label: "Local" },
];

interface WorkflowItem {
  templateId: string;
  excludeTopLevelKeys?: string[];
  excludeExtraFiles?: string[];
}

interface Workflow {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  scope: string;
  projectId: string | null;
  items: WorkflowItem[];
  isActive?: boolean;
  activeCount?: number;
  createdAt: number;
  updatedAt: number;
}

interface Project {
  id: string;
  name: string;
  path: string;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createNameKo, setCreateNameKo] = useState("");
  const [createDescKo, setCreateDescKo] = useState("");
  const [createScope, setCreateScope] = useState("user");
  const [createProjectId, setCreateProjectId] = useState("");
  const [createItemsJson, setCreateItemsJson] = useState(`[\n  { "templateId": "security-basic" }\n]`);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [activating, setActivating] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workflows");
      const data = await res.json();
      // Enrich with activeCount per workflow
      const enriched = await Promise.all(
        data.map(async (w: Workflow) => {
          try {
            const r = await fetch(`/api/workflows/${w.id}`);
            if (r.ok) {
              const d = await r.json();
              return { ...w, isActive: d.isActive, activeCount: d.activeCount };
            }
          } catch { /* ignore */ }
          return w;
        }),
      );
      setWorkflows(enriched);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchWorkflows(); }, [fetchWorkflows]);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((d) => {
      setProjects(d);
      if (d.length > 0 && !createProjectId) setCreateProjectId(d[0].path);
    }).catch(() => {});
  }, []);

  const submitCreate = async () => {
    setCreateError(null);
    const n = createName.trim();
    if (!n || n.length > 100) { setCreateError("name 1-100자"); return; }
    if ((createScope === "project" || createScope === "local") && !createProjectId) {
      setCreateError("project/local scope 에는 프로젝트 선택 필수"); return;
    }
    let items: WorkflowItem[];
    try { items = JSON.parse(createItemsJson); }
    catch (e) { setCreateError(`items JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}`); return; }
    if (!Array.isArray(items) || items.length === 0) {
      setCreateError("items 는 비어있지 않은 배열이어야 함"); return;
    }
    setCreating(true);
    try {
      // Resolve projectId from path (project/local scope uses path, but API expects id)
      let projectId: string | undefined;
      if (createScope === "project" || createScope === "local") {
        const proj = projects.find((p) => p.path === createProjectId);
        if (!proj) { setCreateError("선택한 프로젝트를 찾을 수 없음"); setCreating(false); return; }
        projectId = proj.id;
      }
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: n,
          nameKo: createNameKo.trim() || undefined,
          descriptionKo: createDescKo.trim() || undefined,
          scope: createScope,
          projectId,
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || "생성 실패"); return; }
      setCreateOpen(false);
      setCreateName(""); setCreateNameKo(""); setCreateDescKo("");
      await fetchWorkflows();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "네트워크 오류");
    } finally { setCreating(false); }
  };

  const toggleActive = async (wf: Workflow) => {
    setActivating(wf.id);
    try {
      const url = wf.isActive
        ? `/api/workflows/${wf.id}/deactivate`
        : `/api/workflows/${wf.id}/activate`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) alert(data.error || "실패");
      await fetchWorkflows();
    } catch { alert("네트워크 오류"); }
    finally { setActivating(null); }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/workflows/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error || "삭제 실패");
        return;
      }
      setDeleteTarget(null);
      await fetchWorkflows();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "네트워크 오류");
    } finally { setDeleting(false); }
  };

  const needsProject = createScope === "project" || createScope === "local";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Workflows</h1>
            <p className="text-sm text-muted-foreground mt-1">
              템플릿 묶음을 기획 단위로 활성화/비활성화. 여러 카드를 한 번에 적용.
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" /><span className="ml-1">새 워크플로</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading...</div>
        ) : workflows.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            워크플로가 없습니다. "+ 새 워크플로" 로 생성하세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {workflows.map((wf) => (
              <Card key={wf.id} size="sm" className={wf.isActive ? "border-green-500/50 bg-green-500/5" : ""}>
                <CardHeader>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm">{wf.nameKo}</CardTitle>
                      {wf.descriptionKo && (
                        <CardDescription className="line-clamp-2 mt-1">{wf.descriptionKo}</CardDescription>
                      )}
                    </div>
                    {wf.isActive && (
                      <Badge variant="default" className="shrink-0 bg-green-600 text-[10px]">
                        ✓ Active ({wf.activeCount})
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">{wf.scope}</Badge>
                    <span>{wf.items.length} card{wf.items.length !== 1 ? "s" : ""}</span>
                  </div>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button
                    size="sm"
                    variant={wf.isActive ? "outline" : "default"}
                    onClick={() => toggleActive(wf)}
                    disabled={activating === wf.id}
                  >
                    {wf.isActive ? (
                      <><Square className="size-3.5" /><span className="ml-1">Deactivate</span></>
                    ) : (
                      <><Play className="size-3.5" /><span className="ml-1">Activate</span></>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setDeleteError(null); setDeleteTarget(wf); }}
                    disabled={wf.isActive}
                    aria-label="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>새 워크플로</DialogTitle>
            <DialogDescription>
              여러 템플릿 카드를 기획 단위로 묶습니다. activate 하면 일괄 적용, deactivate 하면 일괄 Undo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">name <span className="text-destructive">*</span></label>
              <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="frontend-dev" maxLength={100} />
            </div>
            <div>
              <label className="text-xs font-medium">nameKo</label>
              <Input value={createNameKo} onChange={(e) => setCreateNameKo(e.target.value)} placeholder="프론트엔드 개발" maxLength={100} />
            </div>
            <div>
              <label className="text-xs font-medium">descriptionKo</label>
              <Textarea value={createDescKo} onChange={(e) => setCreateDescKo(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">scope</label>
                <select
                  value={createScope}
                  onChange={(e) => setCreateScope(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                >
                  {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              {needsProject && (
                <div>
                  <label className="text-xs font-medium">project</label>
                  <select
                    value={createProjectId}
                    onChange={(e) => setCreateProjectId(e.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                  >
                    {projects.length === 0 && <option value="">No projects</option>}
                    {projects.map((p) => <option key={p.id} value={p.path}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium">items (JSON array)</label>
              <Textarea
                value={createItemsJson}
                onChange={(e) => setCreateItemsJson(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                예: <code>{"[{ \"templateId\": \"security-basic\", \"excludeTopLevelKeys\": [] }]"}</code>
              </p>
            </div>
            {createError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                {createError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={submitCreate} disabled={creating}>{creating ? "생성 중..." : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>워크플로 삭제</DialogTitle>
            <DialogDescription>
              <span className="font-medium">{deleteTarget?.nameKo}</span> 를 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다. 활성화된 apply 기록은 유지되지만 workflow 연결은 해제됩니다.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={submitDelete} disabled={deleting}>
              {deleting ? "삭제 중..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
