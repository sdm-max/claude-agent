"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

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

  useEffect(() => { loadProjects(); }, []);

  // Validate path on change
  useEffect(() => {
    if (!formPath.trim()) {
      setPathValidation(null);
      return;
    }
    const timeout = setTimeout(async () => {
      setValidating(true);
      try {
        const res = await fetch("/api/projects/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: formPath }),
        });
        setPathValidation(await res.json());
      } catch {
        setPathValidation(null);
      } finally {
        setValidating(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [formPath]);

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.path.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingId(null);
    setFormName("");
    setFormPath("");
    setFormDesc("");
    setPathValidation(null);
    setModalOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditingId(p.id);
    setFormName(p.name);
    setFormPath(p.path);
    setFormDesc(p.description || "");
    setModalOpen(true);
  };

  const saveProject = async () => {
    setFormSaving(true);
    try {
      if (editingId) {
        await fetch(`/api/projects/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, path: formPath, description: formDesc }),
        });
      } else {
        await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, path: formPath, description: formDesc }),
        });
      }
      setModalOpen(false);
      loadProjects();
    } finally {
      setFormSaving(false);
    }
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
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm"
        >
          New Project
        </button>
      </div>

      <input
        className="input-base mb-4"
        placeholder="Search projects..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p className="text-[var(--text-muted)]">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center py-12 text-[var(--text-muted)]">No projects found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"
            >
              <Link href={`/projects/${p.id}`} className="flex-1 min-w-0">
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-[var(--text-muted)] truncate">{p.path}</div>
                {p.description && (
                  <div className="text-sm text-[var(--text-muted)] mt-1">{p.description}</div>
                )}
              </Link>
              <div className="text-sm text-[var(--text-muted)]">{p.fileCount} files</div>
              <button onClick={() => openEdit(p)} className="px-3 py-1 text-sm rounded border border-[var(--border)] hover:bg-[var(--bg-input)]">
                Edit
              </button>
              <button onClick={() => setDeleteId(p.id)} className="px-3 py-1 text-sm rounded border border-red-800 text-red-400 hover:bg-red-900/20">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Project" : "New Project"}>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Name</label>
            <input className="input-base" value={formName} onChange={(e) => setFormName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Path</label>
            <input className="input-base" value={formPath} onChange={(e) => setFormPath(e.target.value)} placeholder="/Users/..." />
            {validating && <p className="text-xs text-[var(--text-muted)] mt-1">Validating path...</p>}
            {pathValidation && !validating && (
              <div className="mt-1 space-y-0.5">
                {!pathValidation.exists && (
                  <p className="text-xs text-[var(--warning)]">Path does not exist</p>
                )}
                {pathValidation.exists && !pathValidation.isDirectory && (
                  <p className="text-xs text-[var(--warning)]">Path is not a directory</p>
                )}
                {pathValidation.exists && pathValidation.isDirectory && (
                  <p className="text-xs text-[var(--success)]">Valid directory</p>
                )}
                {pathValidation.hasClaudeDir && (
                  <p className="text-xs text-[var(--success)]">.claude/ directory found</p>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Description</label>
            <textarea className="input-base" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={2} />
          </div>
          <button
            onClick={saveProject}
            disabled={!formName || !formPath || formSaving}
            className="w-full py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-sm"
          >
            {formSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Project"
        message="This will delete the project and all its settings. Continue?"
        confirmLabel="Delete"
        onConfirm={deleteProject}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
