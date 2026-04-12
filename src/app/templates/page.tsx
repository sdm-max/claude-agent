"use client";

import { useState, useEffect } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Shield,
  Lock,
  Webhook,
  BookOpen,
  Plug,
  FileText,
  GitBranch,
  Bot,
  Zap,
  Cpu,
  Terminal,
  Monitor,
  Copy,
  Check,
  CheckSquare,
  Square,
  X,
} from "lucide-react";

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

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield,
  Lock,
  Webhook,
  BookOpen,
  Plug,
  FileText,
  GitBranch,
  Bot,
  Zap,
  Cpu,
  Terminal,
  Monitor,
};

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

const categoryOrder = [
  "security",
  "permissions",
  "hooks",
  "skills",
  "mcp",
  "claude-md",
  "cicd",
  "agents",
  "model",
  "env",
  "ui",
  "optimization",
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [categories, setCategories] = useState<Record<string, CategoryInfo>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("security");

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Apply bar state
  const [applyScope, setApplyScope] = useState("global");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectPath, setSelectedProjectPath] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);

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
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const target = needsProject
          ? `${dialogScope} (${dialogProjectPath.split("/").pop()})`
          : dialogScope;
        setDialogApplyResult(`Applied to ${target}`);
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-0">
        <h1 className="text-2xl font-bold">Settings Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          12 categories. Select multiple to mix & apply to any scope.
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as string)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-6 pt-4 border-b border-border">
          <TabsList variant="line" className="gap-0">
            {categoryOrder.map((cat) => {
              const info = categories[cat];
              if (!info) return null;
              const IconComp = iconMap[info.icon];
              const count = grouped[cat]?.length || 0;
              return (
                <TabsTrigger key={cat} value={cat} className="gap-1.5 px-3">
                  {IconComp && <IconComp className="size-4" />}
                  <span>{info.nameKo}</span>
                  <span className="text-xs text-muted-foreground">
                    {count}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {categoryOrder.map((cat) => {
          const items = grouped[cat];
          if (!items) return null;
          return (
            <TabsContent
              key={cat}
              value={cat}
              className="flex-1 overflow-y-auto p-6 pb-32"
            >
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
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Bottom Apply Bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-56 right-0 border-t border-border bg-card/95 backdrop-blur p-4 z-40">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Selected count */}
            <div className="flex items-center gap-2">
              <Badge variant="default">{selected.size} selected</Badge>
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
                {/* Settings JSON */}
                {detail.settingsJson !== "{}" && (
                  <div>
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
