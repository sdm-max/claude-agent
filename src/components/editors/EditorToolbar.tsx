"use client";

interface Props {
  hasChanges: boolean;
  onSave: () => void;
  onHistory?: () => void;
  saving?: boolean;
  extraButtons?: React.ReactNode;
}

export default function EditorToolbar({ hasChanges, onSave, onHistory, saving, extraButtons }: Props) {
  return (
    <div className="flex items-center gap-2 p-2 border-b border-[var(--border)] bg-[var(--bg-card)]">
      <button
        onClick={onSave}
        disabled={!hasChanges || saving}
        className="px-3 py-1.5 text-sm rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
      >
        {saving ? "저장 중..." : "저장"}
      </button>
      {onHistory && (
        <button
          onClick={onHistory}
          className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:bg-[var(--bg-input)] transition-colors"
        >
          히스토리
        </button>
      )}
      {hasChanges && (
        <span className="text-xs text-[var(--warning)]">변경사항 있음</span>
      )}
      {extraButtons}
    </div>
  );
}
