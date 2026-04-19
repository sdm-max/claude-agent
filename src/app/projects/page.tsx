"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface Project {
  id: string;
  name: string;
  path: string;
  description: string;
  fileCount: number;
  updatedAt: number;
}

interface PathValidation {
  exists: boolean;
  isDirectory: boolean;
  hasClaudeDir: boolean;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formPath, setFormPath] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [pathValidation, setPathValidation] = useState<PathValidation | null>(null);
  const [validating, setValidating] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadProjects = async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadProjects(); }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!formPath.trim()) { setPathValidation(null); return; }
    const timeout = setTimeout(async () => {
      setValidating(true);
      try {
        const res = await fetch("/api/projects/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: formPath }),
        });
        setPathValidation(await res.json());
      } catch { setPathValidation(null); }
      finally { setValidating(false); }
    }, 300);
    return () => clearTimeout(timeout);
  }, [formPath]);

  const filtered = projects.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.path.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingId(null); setFormName(""); setFormPath(""); setFormDesc(""); setPathValidation(null); setModalOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditingId(p.id); setFormName(p.name); setFormPath(p.path); setFormDesc(p.description || ""); setModalOpen(true);
  };

  const saveProject = async () => {
    setFormSaving(true);
    try {
      if (editingId) {
        await fetch(`/api/projects/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formName, path: formPath, description: formDesc }) });
      } else {
        await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formName, path: formPath, description: formDesc }) });
      }
      setModalOpen(false);
      loadProjects();
    } finally { setFormSaving(false); }
  };

  const deleteProject = async () => {
    if (!deleteId) return;
    await fetch(`/api/projects/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    loadProjects();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button onClick={openCreate}>New Project</Button>
      </div>

      <Input className="mb-4" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No projects found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Card key={p.id} size="sm">
              <CardContent>
                <div className="flex items-center gap-4">
                  <Link href={`/projects/${p.id}`} className="flex-1 min-w-0">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-muted-foreground truncate">{p.path}</div>
                    {p.description && <div className="text-sm text-muted-foreground mt-1">{p.description}</div>}
                  </Link>
                  <div className="text-sm text-muted-foreground">{p.fileCount} files</div>
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteId(p.id)}>Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Project" : "New Project"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input className="mt-1" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div>
              <Label>Path</Label>
              <Input className="mt-1" value={formPath} onChange={(e) => setFormPath(e.target.value)} placeholder="/Users/..." />
              {validating && <p className="text-xs text-muted-foreground mt-1">Validating path...</p>}
              {pathValidation && !validating && (
                <div className="mt-1 space-y-0.5">
                  {!pathValidation.exists && <p className="text-xs text-yellow-400">Path does not exist</p>}
                  {pathValidation.exists && !pathValidation.isDirectory && <p className="text-xs text-yellow-400">Path is not a directory</p>}
                  {pathValidation.exists && pathValidation.isDirectory && <p className="text-xs text-green-400">Valid directory</p>}
                  {pathValidation.hasClaudeDir && <p className="text-xs text-green-400">.claude/ directory found</p>}
                </div>
              )}
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveProject} disabled={!formName || !formPath || formSaving} className="w-full sm:w-auto">
              {formSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will delete the project and all its settings. Continue?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteProject}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
