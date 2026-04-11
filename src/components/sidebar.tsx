"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  path: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(data))
      .catch(() => {});
  }, []);

  return (
    <nav className="w-56 shrink-0 bg-[var(--bg-card)] border-r border-[var(--border)] p-4 flex flex-col gap-0.5 overflow-y-auto">
      <Link href="/" className="text-lg font-bold mb-6 px-2 hover:text-[var(--accent)] transition-colors">
        Claude Settings
      </Link>

      <SectionLabel>Settings</SectionLabel>
      <NavLink href="/settings/global" active={pathname === "/settings/global"}>
        Global
      </NavLink>
      <NavLink href="/settings/user" active={pathname === "/settings/user"}>
        User
      </NavLink>

      <SectionLabel className="mt-4">Projects</SectionLabel>
      {projects.map((p) => (
        <NavLink
          key={p.id}
          href={`/projects/${p.id}`}
          active={pathname === `/projects/${p.id}`}
        >
          <span className="truncate">{p.name}</span>
        </NavLink>
      ))}
      <NavLink href="/projects" active={pathname === "/projects"}>
        <span className="text-[var(--text-muted)]">+ New Project</span>
      </NavLink>
    </nav>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-2 py-1 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider", className)}>
      {children}
    </div>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "px-3 py-1.5 rounded text-sm transition-colors flex items-center",
        active
          ? "bg-[var(--bg-input)] text-[var(--accent)]"
          : "hover:bg-[var(--bg-input)] text-[var(--text)]"
      )}
    >
      {children}
    </Link>
  );
}
