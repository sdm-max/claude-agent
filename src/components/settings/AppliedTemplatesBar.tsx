"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface AppliedRow {
  id: string;
  templateId: string;
  templateName: string;
  appliedAt: number;
}

interface Props {
  scope: "global" | "user" | "project" | "local";
  projectId?: string | null;
  onUndo?: () => void;
}

function formatAgo(ts: number): string {
  // M11: 음수 방어 (시계 왜곡 / 미래 타임스탬프)
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}초 전`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

export default function AppliedTemplatesBar({ scope, projectId, onUndo }: Props) {
  const [rows, setRows] = useState<AppliedRow[]>([]);
  const [undoing, setUndoing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ scope });
    if (projectId) params.set("projectId", projectId);
    try {
      const res = await fetch(`/api/templates/applied?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as AppliedRow[];
      setRows(data);
    } catch {
      /* ignore */
    }
  }, [scope, projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (rows.length === 0) return null;

  const handleUndo = async (row: AppliedRow) => {
    const ok = confirm(`"${row.templateName}" 카드의 설정을 제거하시겠습니까?\n\n이 카드가 추가한 설정만 제거되며, 다른 카드/수동 수정은 보존됩니다.`);
    if (!ok) return;
    setUndoing(row.id);
    try {
      const res = await fetch(`/api/templates/applied/${row.id}/undo`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Undo 실패");
        return;
      }
      await load();
      onUndo?.();
    } catch {
      alert("Undo 실패 — 네트워크");
    } finally {
      setUndoing(null);
    }
  };

  return (
    <div className="px-4 py-2 border-b border-border bg-muted/30">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground shrink-0">Applied:</span>
        {rows.map((row) => (
          <div
            key={row.id}
            className="inline-flex items-center gap-1 bg-primary/10 text-xs rounded-md px-2 py-0.5"
          >
            <span className="font-medium">{row.templateName}</span>
            <span className="text-muted-foreground">{formatAgo(row.appliedAt)}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => handleUndo(row)}
              disabled={undoing === row.id}
              className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive"
              title="제거"
            >
              <X className="size-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
