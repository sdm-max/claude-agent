"use client";

import { Badge } from "@/components/ui/badge";

const SCOPE_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  global: "default",
  user: "secondary",
  project: "outline",
  local: "outline",
};

export default function ScopeBadge({ scope }: { scope: string }) {
  return (
    <Badge variant={SCOPE_VARIANTS[scope] || "outline"}>
      {scope}
    </Badge>
  );
}
