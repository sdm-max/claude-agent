"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
        <Card size="sm">
          <CardHeader><CardTitle className="text-muted-foreground text-sm font-normal">Projects</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{projects.length}</div></CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle className="text-muted-foreground text-sm font-normal">Config Files</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalFiles}</div></CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle className="text-muted-foreground text-sm font-normal">Scopes</CardTitle></CardHeader>
          <CardContent><div className="text-sm font-medium">Global, User, Project, Local</div></CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold mb-4">Recent Projects</h2>
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-2">No projects registered.</p>
          <Link href="/projects">
            <Button variant="link">Add a project</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.slice(0, 5).map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card size="sm" className="hover:ring-primary/30 transition-all cursor-pointer">
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-sm text-muted-foreground">{p.path}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">{p.fileCount} files</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
