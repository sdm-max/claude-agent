"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Copy,
  Check,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import type { ConflictReport } from "@/lib/templates/conflict-detector";

interface TemplateSummary {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  category: string;
  difficulty: number;
  scope: string;
  tags: string[];
  hasExtraFiles: boolean;
}

interface TemplateDetail {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  category: string;
  difficulty: number;
  scope: string;
  settings: Record<string, unknown>;
  settingsJson: string;
  extraFiles?: { path: string; content: string; description: string }[];
}

interface CategoryInfo {
  name: string;
  nameKo: string;
  icon: string;
}

interface Project {
  id: string;
  name: string;
  path: string;
}

const SCOPES = [
  { value: "global", label: "Global" },
  { value: "user", label: "User" },
  { value: "project", label: "Project" },
  { value: "local", label: "Local (Project)" },
];

const difficultyLabels = ["", "Easy", "Medium", "Advanced"];
const difficultyColors = [
  "",
  "text-green-400",
  "text-yellow-400",
  "text-orange-400",
];

export default function TemplatesPage() {
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category") || "security";

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [categories, setCategories] = useState<Record<string, CategoryInfo>>(
    {}
  );
  const [loading, setLoading] = useState(true);

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Apply bar state
  const [applyScope, setApplyScope] = useState("global");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectPath, setSelectedProjectPath] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);
  const [conflictReport, setConflictReport] = useState<ConflictReport | null>(null);
  const [appliedMap, setAppliedMap] = useState<Record<string, string[]>>({});

  // Detail dialog
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Detail dialog apply state
  const [dialogScope, setDialogScope] = useState("global");
  const [dialogProjectPath, setDialogProjectPath] = useState("");
  const [dialogApplying, setDialogApplying] = useState(false);
  const [dialogApplyResult, setDialogApplyResult] = useState<string | null>(
    null
  );

  // Phase 2-1: per-block exclusion state for Detail dialog Apply
  const [detailExcludedKeys, setDetailExcludedKeys] = useState<Set<string>>(
    new Set(),
  );
  const [detailExcludedFiles, setDetailExcludedFiles] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates);
        setCategories(data.categories);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data);
        if (data.length > 0) {
          setSelectedProjectPath(data[0].path);
          setDialogProjectPath(data[0].path);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selected.size === 0) {
      setConflictReport(null);
      return;
    }
    const needsProject = applyScope === "project" || applyScope === "local";
    if (needsProject && !selectedProjectPath) {
      setConflictReport(null);
      return;
    }
    const ctrl = new AbortController();
    fetch("/api/templates/preview-conflicts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateIds: [...selected],
        scope: applyScope,
        projectPath: needsProject ? selectedProjectPath : undefined,
      }),
      signal: ctrl.signal,
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setConflictReport(data))
      .catch(() => { /* aborted or network error — ignore */ });
    return () => ctrl.abort();
  }, [selected, applyScope, selectedProjectPath]);

  const loadAppliedMap = useCallback(async (signal?: AbortSignal) => {
    const needsProjectForApplied =
      applyScope === "project" || applyScope === "local";
    if (needsProjectForApplied && !selectedProjectPath) {
      setAppliedMap({});
      return;
    }
    try {
      const params = new URLSearchParams({ scope: applyScope });
      if (needsProjectForApplied) {
        const proj = projects.find((p) => p.path === selectedProjectPath);
        if (proj) params.set("projectId", proj.id);
      }
      const res = await fetch(`/api/templates/applied?${params.toString()}`, { signal });
      if (!res.ok) {
        setAppliedMap({});
        return;
      }
      const rows = (await res.json()) as { templateId: string }[];
      const next: Record<string, string[]> = {};
      for (const row of rows) {
        if (!next[row.templateId]) next[row.templateId] = [];
        if (!next[row.templateId].includes(applyScope))
          next[row.templateId].push(applyScope);
      }
      setAppliedMap(next);
    } catch {
      // ignore
    }
  }, [applyScope, selectedProjectPath, projects]);

  useEffect(() => {
    const ctrl = new AbortController();
    loadAppliedMap(ctrl.signal);
    return () => ctrl.abort();
  }, [loadAppliedMap]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setApplyResult(null);
  };

  const clearSelection = () => {
    setSelected(new Set());
    setApplyResult(null);
  };

  const batchApply = async () => {
    if (selected.size === 0) return;
    const needsProject = applyScope === "project" || applyScope === "local";
    if (needsProject && !selectedProjectPath) return;

    if (
      conflictReport?.hasCritical ||
      (conflictReport?.orderDependencies?.length ?? 0) > 0
    ) {
      const orderMsg = conflictReport?.orderSummary
        ? `\n\n순서 의존: ${conflictReport.orderSummary}`
        : "";
      const ok = confirm(
        `위험: ${conflictReport?.summary || ""}${orderMsg}\n\n계속 적용하시겠습니까?`,
      );
      if (!ok) return;
    }
    setApplying(true);
    setApplyResult(null);
    try {
      const res = await fetch("/api/templates/batch-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateIds: [...selected],
          scope: applyScope,
          projectPath: needsProject ? selectedProjectPath : undefined,
          mode: "merge",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const target = needsProject
          ? `${applyScope} (${selectedProjectPath.split("/").pop()})`
          : applyScope;
        setApplyResult(`${data.applied} templates applied to ${target}`);
        loadAppliedMap();
      } else {
        setApplyResult(`Error: ${data.error}`);
      }
    } catch {
      setApplyResult("Failed to apply");
    } finally {
      setApplying(false);
    }
  };

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDialogApplyResult(null);
    setDetailExcludedKeys(new Set());
    setDetailExcludedFiles(new Set());
    try {
      const res = await fetch(`/api/templates/${id}`);
      const data = await res.json();
      setDetail(data);
    } finally {
      setDetailLoading(false);
    }
  };

  const dialogApply = async () => {
    if (!detail) return;
    const needsProject = dialogScope === "project" || dialogScope === "local";
    if (needsProject && !dialogProjectPath) return;

    setDialogApplying(true);
    setDialogApplyResult(null);
    try {
      const res = await fetch(`/api/templates/${detail.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: dialogScope,
          projectPath: needsProject ? dialogProjectPath : undefined,
          mode: "merge",
          excludeTopLevelKeys: [...detailExcludedKeys],
          excludeExtraFiles: [...detailExcludedFiles],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const target = needsProject
          ? `${dialogScope} (${dialogProjectPath.split("/").pop()})`
          : dialogScope;
        setDialogApplyResult(`Applied to ${target}`);
        await loadAppliedMap();
        if (dialogScope !== applyScope) {
          try {
            const params = new URLSearchParams({ scope: dialogScope });
            if (dialogScope === "project" || dialogScope === "local") {
              const proj = projects.find((p) => p.path === dialogProjectPath);
              if (proj) params.set("projectId", proj.id);
            }
            const r = await fetch(`/api/templates/applied?${params.toString()}`);
            if (r.ok) {
              const rows = (await r.json()) as { templateId: string }[];
              setAppliedMap((prev) => {
                const next = { ...prev };
                for (const row of rows) {
                  if (!next[row.templateId]) next[row.templateId] = [];
                  if (!next[row.templateId].includes(dialogScope)) {
                    next[row.templateId].push(dialogScope);
                  }
                }
                return next;
              });
            }
          } catch { /* ignore */ }
        }
      } else {
        setDialogApplyResult(`Error: ${data.error}`);
      }
    } catch {
      setDialogApplyResult("Failed to apply");
    } finally {
      setDialogApplying(false);
    }
  };

  const copyJson = async (json: string, id: string) => {
    await navigator.clipboard.writeText(json);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Group templates by category
  const grouped = templates.reduce<Record<string, TemplateSummary[]>>(
    (acc, t) => {
      if (!acc[t.category]) acc[t.category] = [];
      acc[t.category].push(t);
      return acc;
    },
    {}
  );

  const needsProject = applyScope === "project" || applyScope === "local";
  const dialogNeedsProject =
    dialogScope === "project" || dialogScope === "local";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading templates...
      </div>
    );
  }

  const catInfo = categories[activeCategory];
  const items = grouped[activeCategory] || [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <h1 className="text-2xl font-bold">
          {catInfo?.nameKo || "Templates"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {items.length} templates. Select multiple to mix & apply to any scope.
        </p>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-6 pb-32">
        {items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {items.map((t) => {
                  const isSelected = selected.has(t.id);
                  return (
                    <Card
                      key={t.id}
                      size="sm"
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? "ring-2 ring-primary"
                          : "hover:ring-primary/30"
                      } ${
                        appliedMap[t.id] && appliedMap[t.id].length > 0
                          ? "bg-green-500/5 border-green-500/30"
                          : ""
                      }`}
                    >
                      <CardHeader>
                        <div className="flex items-start gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(t.id);
                            }}
                            className="mt-0.5 shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="size-4 text-primary" />
                            ) : (
                              <Square className="size-4 text-muted-foreground" />
                            )}
                          </button>
                          <div
                            className="flex-1 min-w-0"
                            onClick={() => openDetail(t.id)}
                          >
                            <CardTitle className="text-sm">
                              {t.nameKo}
                            </CardTitle>
                            <CardDescription className="line-clamp-2 mt-1">
                              {t.descriptionKo}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent onClick={() => openDetail(t.id)}>
                        <div className="flex flex-wrap gap-1">
                          {t.tags.map((tag, ti) => (
                            <span
                              key={ti}
                              className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter
                        className="gap-2"
                        onClick={() => openDetail(t.id)}
                      >
                        <Badge variant="outline" className="text-xs">
                          {t.scope}
                        </Badge>
                        {appliedMap[t.id] && appliedMap[t.id].length > 0 && (
                          <Badge
                            variant="default"
                            className="text-[10px] bg-green-600 hover:bg-green-700"
                          >
                            ✓ Applied
                          </Badge>
                        )}
                        <span
                          className={`text-xs ${
                            difficultyColors[t.difficulty]
                          }`}
                        >
                          {"★".repeat(t.difficulty)}
                          {"☆".repeat(3 - t.difficulty)}{" "}
                          {difficultyLabels[t.difficulty]}
                        </span>
                        {t.hasExtraFiles && (
                          <Badge
                            variant="secondary"
                            className="text-xs ml-auto"
                          >
                            + files
                          </Badge>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            No templates in this category.
          </div>
        )}
      </div>

      {/* Bottom Apply Bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-56 right-0 border-t border-border bg-card/95 backdrop-blur p-4 z-40">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Selected count */}
            <div className="flex items-center gap-2">
              <Badge variant="default">{selected.size} selected</Badge>
              {conflictReport && conflictReport.conflicts.length > 0 && (
                <Badge variant={conflictReport.hasCritical ? "destructive" : "secondary"} className="text-xs">
                  ⚠ 충돌 {conflictReport.conflicts.length}건
                </Badge>
              )}
              {conflictReport &&
                (conflictReport.orderDependencies?.length ?? 0) > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-xs bg-yellow-500/20 text-yellow-700"
                  >
                    ⚠ 순서 의존 {conflictReport.orderDependencies!.length}건
                  </Badge>
                )}
              <Button variant="ghost" size="icon-xs" onClick={clearSelection}>
                <X className="size-3" />
              </Button>
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Scope selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Scope:</span>
              <select
                value={applyScope}
                onChange={(e) => setApplyScope(e.target.value)}
                className="h-7 rounded-md border border-border bg-background px-2 text-sm"
              >
                {SCOPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Project selector */}
            {needsProject && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Project:</span>
                <select
                  value={selectedProjectPath}
                  onChange={(e) => setSelectedProjectPath(e.target.value)}
                  className="h-7 rounded-md border border-border bg-background px-2 text-sm max-w-48"
                >
                  {projects.length === 0 && (
                    <option value="">No projects</option>
                  )}
                  {projects.map((p) => (
                    <option key={p.id} value={p.path}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {applyResult && (
                <span
                  className={`text-xs ${
                    applyResult.startsWith("Error")
                      ? "text-destructive"
                      : "text-green-400"
                  }`}
                >
                  {applyResult}
                </span>
              )}
              <Button
                onClick={batchApply}
                disabled={
                  applying || (needsProject && !selectedProjectPath)
                }
                size="sm"
              >
                {applying
                  ? "Applying..."
                  : `Apply ${selected.size} templates`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          {detailLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading...
            </div>
          ) : detail ? (
            <>
              <DialogHeader>
                <DialogTitle>{detail.nameKo}</DialogTitle>
                <DialogDescription>{detail.descriptionKo}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Phase 2-1: per-block Apply checklist */}
                {detail.settings &&
                  Object.keys(detail.settings).length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold">
                        적용할 항목 선택
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        체크 해제한 항목은 Apply 시 머지에서 제외됩니다.
                      </p>
                      {Object.entries(
                        detail.settings as Record<string, unknown>,
                      ).map(([key, val]) => {
                        const checked = !detailExcludedKeys.has(key);
                        const preview = JSON.stringify(val, null, 2);
                        return (
                          <label
                            key={key}
                            className="flex items-start gap-2 p-2 border rounded cursor-pointer hover:bg-accent"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setDetailExcludedKeys((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(key)) next.delete(key);
                                  else next.add(key);
                                  return next;
                                });
                              }}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">{key}</div>
                              <pre className="text-xs text-muted-foreground mt-0.5 truncate">
                                {preview.length > 120
                                  ? preview.slice(0, 120) + "..."
                                  : preview}
                              </pre>
                            </div>
                          </label>
                        );
                      })}
                      {detail.extraFiles && detail.extraFiles.length > 0 && (
                        <>
                          <h4 className="text-xs font-semibold text-muted-foreground mt-3">
                            Extra Files
                          </h4>
                          {detail.extraFiles.map((f) => {
                            const checked = !detailExcludedFiles.has(f.path);
                            return (
                              <label
                                key={f.path}
                                className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-accent"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setDetailExcludedFiles((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(f.path))
                                        next.delete(f.path);
                                      else next.add(f.path);
                                      return next;
                                    });
                                  }}
                                />
                                <span className="text-sm font-mono">
                                  {f.path}
                                </span>
                              </label>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}

                {/* Settings JSON */}
                {detail.settingsJson !== "{}" && (
                  <div>
                    {detailExcludedKeys.size > 0 && (
                      <p className="text-xs text-yellow-600 mb-2">
                        ℹ 체크 해제된 항목({[...detailExcludedKeys].join(", ")})은 Apply 시 제외됩니다.
                      </p>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold">settings.json</h3>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          copyJson(detail.settingsJson, "settings")
                        }
                      >
                        {copiedId === "settings" ? (
                          <Check className="size-3 text-green-400" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        <span className="ml-1">Copy</span>
                      </Button>
                    </div>
                    <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto max-h-60">
                      {detail.settingsJson}
                    </pre>
                  </div>
                )}

                {/* Extra Files */}
                {detail.extraFiles?.map((f, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold">{f.path}</h3>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => copyJson(f.content, f.path)}
                      >
                        {copiedId === f.path ? (
                          <Check className="size-3 text-green-400" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        <span className="ml-1">Copy</span>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {f.description}
                    </p>
                    <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto max-h-48">
                      {f.content}
                    </pre>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <div className="flex flex-col gap-3 w-full">
                  {/* Scope + Project selector */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      Apply to:
                    </span>
                    <select
                      value={dialogScope}
                      onChange={(e) => setDialogScope(e.target.value)}
                      className="h-7 rounded-md border border-border bg-background px-2 text-sm"
                    >
                      {SCOPES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>

                    {dialogNeedsProject && (
                      <select
                        value={dialogProjectPath}
                        onChange={(e) =>
                          setDialogProjectPath(e.target.value)
                        }
                        className="h-7 rounded-md border border-border bg-background px-2 text-sm max-w-48"
                      >
                        {projects.length === 0 && (
                          <option value="">No projects</option>
                        )}
                        {projects.map((p) => (
                          <option key={p.id} value={p.path}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                      {dialogApplyResult && (
                        <span
                          className={`text-xs ${
                            dialogApplyResult.startsWith("Error")
                              ? "text-destructive"
                              : "text-green-400"
                          }`}
                        >
                          {dialogApplyResult}
                        </span>
                      )}
                      <Button
                        size="sm"
                        onClick={dialogApply}
                        disabled={
                          dialogApplying ||
                          (dialogNeedsProject && !dialogProjectPath)
                        }
                      >
                        {dialogApplying ? "Applying..." : "Apply"}
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
