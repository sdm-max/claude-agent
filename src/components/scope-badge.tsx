"use client";

const SCOPE_COLORS: Record<string, string> = {
  global: "bg-purple-900/30 text-purple-300 border-purple-700",
  user: "bg-blue-900/30 text-blue-300 border-blue-700",
  project: "bg-green-900/30 text-green-300 border-green-700",
  local: "bg-yellow-900/30 text-yellow-300 border-yellow-700",
};

export default function ScopeBadge({ scope }: { scope: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded border ${SCOPE_COLORS[scope] || ""}`}>
      {scope}
    </span>
  );
}
