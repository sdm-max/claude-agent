"use client";

import { Button } from "@/components/ui/button";

interface Props {
  hasChanges: boolean;
  onSave: () => void;
  onHistory?: () => void;
  saving?: boolean;
  extraButtons?: React.ReactNode;
}

export default function EditorToolbar({ hasChanges, onSave, onHistory, saving, extraButtons }: Props) {
  return (
    <div className="flex items-center gap-2 p-2 border-b border-border bg-card">
      <Button onClick={onSave} disabled={!hasChanges || saving}>
        {saving ? "Saving..." : "Save"}
      </Button>
      {onHistory && (
        <Button variant="outline" onClick={onHistory}>History</Button>
      )}
      {hasChanges && <span className="text-xs text-yellow-400">Unsaved changes</span>}
      {extraButtons}
    </div>
  );
}
