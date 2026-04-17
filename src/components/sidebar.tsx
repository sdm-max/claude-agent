"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  Star,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  path: string;
}

const templateCategories = [
  { key: "security", nameKo: "보안 가드", icon: Shield },
  { key: "permissions", nameKo: "권한 설정", icon: Lock },
  { key: "hooks", nameKo: "훅 엔지니어", icon: Webhook },
  { key: "skills", nameKo: "스킬 아키텍트", icon: BookOpen },
  { key: "mcp", nameKo: "MCP 통합", icon: Plug },
  { key: "claude-md", nameKo: "CLAUDE.md", icon: FileText },
  { key: "cicd", nameKo: "CI/CD 자동화", icon: GitBranch },
  { key: "agents", nameKo: "에이전트", icon: Bot },
  { key: "model", nameKo: "모델 설정", icon: Cpu },
  { key: "env", nameKo: "환경변수", icon: Terminal },
  { key: "ui", nameKo: "UI / UX", icon: Monitor },
  { key: "optimization", nameKo: "최적화", icon: Zap },
  { key: "custom", nameKo: "내 템플릿", icon: Star },
];

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);

  const activeCategory = searchParams.get("category") || "security";

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
      {templateCategories.map((cat) => {
        const isActive = pathname === "/templates" && activeCategory === cat.key;
        const Icon = cat.icon;
        return (
          <NavLink
            key={cat.key}
            href={`/templates?category=${cat.key}`}
            active={isActive}
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">{cat.nameKo}</span>
          </NavLink>
        );
      })}

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
        className={cn("w-full justify-start gap-1.5", active && "text-primary")}
      >
        {children}
      </Button>
    </Link>
  );
}
