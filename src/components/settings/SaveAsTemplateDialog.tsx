"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ClaudeSettings } from "@/lib/settings-schema";

const CATEGORY_OPTIONS = [
  "security", "permissions", "hooks", "skills", "mcp", "claude-md",
  "cicd", "agents", "model", "env", "ui", "optimization", "custom",
];

const SCOPE_OPTIONS = [
  { value: "global", label: "Global" },
  { value: "user", label: "User" },
  { value: "project", label: "Project" },
  { value: "local", label: "Local" },
  { value: "both", label: "Both" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSettings: ClaudeSettings;
  defaultScope?: string;
  onSaved?: (id: string) => void;
}

export default function SaveAsTemplateDialog({
  open,
  onOpenChange,
  currentSettings,
  defaultScope = "project",
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [nameKo, setNameKo] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionKo, setDescriptionKo] = useState("");
  const [category, setCategory] = useState("custom");
  const [scope, setScope] = useState(defaultScope);
  const [difficulty, setDifficulty] = useState(1);
  const [tagsInput, setTagsInput] = useState("");
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const topLevelKeys = Object.keys(currentSettings || {});

  useEffect(() => {
    if (open) {
      setName("");
      setNameKo("");
      setDescription("");
      setDescriptionKo("");
      setCategory("custom");
      setScope(defaultScope);
      setDifficulty(1);
      setTagsInput("");
      setExcludedKeys(new Set());
      setError(null);
    }
  }, [open, defaultScope]);

  const toggleKey = (key: string) => {
    setExcludedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const submit = async () => {
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("name은 필수입니다 (1-100자).");
      return;
    }
    if (trimmedName.length > 100) {
      setError("name은 100자 이내여야 합니다.");
      return;
    }
    if (description.length > 500) {
      setError("description은 500자 이내여야 합니다.");
      return;
    }

    // 체크된 항목만 포함 (excludedKeys에 있는 키는 제외)
    const filteredSettings: Record<string, unknown> = {};
    for (const key of topLevelKeys) {
      if (!excludedKeys.has(key)) {
        filteredSettings[key] = (currentSettings as Record<string, unknown>)[key];
      }
    }

    if (Object.keys(filteredSettings).length === 0) {
      setError("최소 1개 항목은 포함되어야 합니다.");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setSaving(true);
    try {
      const res = await fetch("/api/custom-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          nameKo: nameKo.trim() || undefined,
          description: description.trim() || undefined,
          descriptionKo: descriptionKo.trim() || undefined,
          category,
          scope,
          difficulty,
          tags,
          settings: filteredSettings,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "저장 실패");
        return;
      }
      onSaved?.(data.id);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save as Card</DialogTitle>
          <DialogDescription>
            현재 settings를 커스텀 템플릿으로 저장합니다. 체크 해제한 항목은 제외됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">
              name <span className="text-destructive">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-settings-card"
              maxLength={100}
            />
          </div>
          <div>
            <label className="text-xs font-medium">nameKo</label>
            <Input
              value={nameKo}
              onChange={(e) => setNameKo(e.target.value)}
              placeholder="내 설정 카드"
              maxLength={100}
            />
          </div>
          <div>
            <label className="text-xs font-medium">description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>
          <div>
            <label className="text-xs font-medium">descriptionKo</label>
            <Textarea
              value={descriptionKo}
              onChange={(e) => setDescriptionKo(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium">category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
              >
                {SCOPE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value))}
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
              >
                <option value={1}>1 - Easy</option>
                <option value={2}>2 - Medium</option>
                <option value={3}>3 - Advanced</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">tags (comma-separated)</label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="tag1, tag2"
            />
          </div>

          {topLevelKeys.length > 0 ? (
            <div className="space-y-1">
              <label className="text-xs font-medium">
                포함할 settings 항목 ({topLevelKeys.length - excludedKeys.size}/{topLevelKeys.length})
              </label>
              <p className="text-[11px] text-muted-foreground">
                체크 해제한 항목은 카드에 포함되지 않습니다.
              </p>
              <div className="border rounded-lg p-2 max-h-48 overflow-y-auto space-y-1">
                {topLevelKeys.map((key) => {
                  const checked = !excludedKeys.has(key);
                  const val = (currentSettings as Record<string, unknown>)[key];
                  const preview = JSON.stringify(val);
                  return (
                    <label
                      key={key}
                      className="flex items-start gap-2 p-1.5 rounded cursor-pointer hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleKey(key)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{key}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {preview.length > 80 ? preview.slice(0, 80) + "..." : preview}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-2 text-xs">
              현재 settings가 비어있습니다. 저장할 항목이 없습니다.
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving || topLevelKeys.length === 0}
          >
            {saving ? "저장 중..." : "Save as Card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
