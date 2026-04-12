"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
  }, [pathname]);

  return (
    <nav className="w-56 shrink-0 bg-card border-r border-border p-3 flex flex-col gap-1 overflow-y-auto">
      <Link href="/" className="text-lg font-bold mb-4 px-2 hover:text-primary transition-colors">
        Claude Settings
      </Link>

      <SectionLabel>Settings</SectionLabel>
      <NavLink href="/settings/global" active={pathname === "/settings/global"}>
        Global
      </NavLink>
      <NavLink href="/settings/user" active={pathname === "/settings/user"}>
        User
      </NavLink>

      <Separator className="my-2" />

      <SectionLabel>Templates</SectionLabel>
      <NavLink href="/templates" active={pathname === "/templates"}>
        Settings Matrix
      </NavLink>

      <Separator className="my-2" />

      <SectionLabel>Projects</SectionLabel>
      {projects.map((p) => (
        <NavLink
          key={p.id}
          href={`/projects/${p.id}`}
          active={pathname === `/projects/${p.id}`}
        >
          <span className="truncate">{p.name}</span>
        </NavLink>
      ))}
      <Link href="/projects">
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
          + New Project
        </Button>
      </Link>
    </nav>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {children}
    </div>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href}>
      <Button
        variant={active ? "secondary" : "ghost"}
        size="sm"
        className={cn("w-full justify-start", active && "text-primary")}
      >
        {children}
      </Button>
    </Link>
  );
}
