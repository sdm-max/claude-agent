"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  path: string;
  fileCount: number;
  updatedAt: number;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(data))
      .finally(() => setLoading(false));
  }, []);

  const totalFiles = projects.reduce((sum, p) => sum + (p.fileCount || 0), 0);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Projects" value={projects.length} />
        <StatCard label="Config Files" value={totalFiles} />
        <StatCard label="Scopes" value="Global, User, Project, Local" isText />
      </div>

      <h2 className="text-lg font-semibold mb-4">Recent Projects</h2>
      {loading ? (
        <p className="text-[var(--text-muted)]">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <p className="mb-2">No projects registered.</p>
          <Link href="/projects" className="text-[var(--accent)] hover:underline">
            Add a project
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.slice(0, 5).map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="block p-4 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] bg-[var(--bg-card)] transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-[var(--text-muted)]">{p.path}</div>
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  {p.fileCount} files
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, isText }: { label: string; value: number | string; isText?: boolean }) {
  return (
    <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
      <div className="text-sm text-[var(--text-muted)]">{label}</div>
      <div className={isText ? "text-sm font-medium mt-1" : "text-2xl font-bold mt-1"}>{value}</div>
    </div>
  );
}
