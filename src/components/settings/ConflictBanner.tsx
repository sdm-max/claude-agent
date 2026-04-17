"use client";

import { useMemo } from "react";
import type { ClaudeSettings } from "@/lib/settings-schema";
import { detectInternalConflicts } from "@/lib/templates/conflict-detector";

interface Props {
  settings: ClaudeSettings;
}

export default function ConflictBanner({ settings }: Props) {
  const report = useMemo(() => {
    if (!settings) return { conflicts: [], hasCritical: false, summary: "" };
    return detectInternalConflicts(settings);
  }, [settings]);

  if (report.conflicts.length === 0) return null;

  const bg = report.hasCritical
    ? "bg-destructive/10 border-destructive/30"
    : "bg-yellow-500/10 border-yellow-500/30";
  const textColor = report.hasCritical ? "text-destructive" : "text-yellow-700";

  return (
    <div className={`px-4 py-3 border-b ${bg}`}>
      <p className={`text-sm font-semibold ${textColor}`}>
        {report.hasCritical ? "⚠ 권한 충돌 (위험)" : "⚠ 권한 충돌 (주의)"}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{report.summary}</p>
      <details className="mt-2">
        <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
          충돌 상세 ({report.conflicts.length}건)
        </summary>
        <ul className="mt-2 space-y-1 text-xs">
          {report.conflicts.map((c, i) => (
            <li key={i} className={c.severity === "critical" ? "text-destructive" : "text-yellow-700"}>
              <code className="bg-muted px-1 rounded">{c.denyPattern}</code>{" "}
              deny가{" "}
              <code className="bg-muted px-1 rounded">{c.blockedPattern}</code>{" "}
              {c.type === "deny-blocks-allow" ? "allow" : "ask"}를 차단
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
