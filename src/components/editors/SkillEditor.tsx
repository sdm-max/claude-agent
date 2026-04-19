"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import CodeEditor from "./CodeEditor";
import { useProjectEvents } from "@/hooks/use-project-events";
import { useHomeEvents } from "@/hooks/use-home-events";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, FolderOpen } from "lucide-react";

function getDefaultSkillTemplate(name: string): string {
  return `---
name: ${name}
description: ${name} skill — describe when Claude should invoke this
---

# ${name}

## When to use
Describe the task this skill handles. Claude uses the \`description\` field above
to decide when to apply this skill automatically.

## Steps
1. First step
2. Second step
3. Final step
`;
}

// Claude Code 공식 스펙: lowercase letters/numbers/hyphens, max 64 chars
function isValidSkillName(name: string): boolean {
  if (!name || name.length > 64) return false;
  return /^[a-z0-9-]+$/.test(name);
}

interface SkillEntry {
  name: string;
  content: string;
  hasSupportingFiles: boolean;
}

interface Props {
  projectId?: string | null;
}

export default function SkillEditor({ projectId }: Props) {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supportingFiles, setSupportingFiles] = useState<string[]>([]);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const hasChanges = content !== savedContent;
  const hasChangesRef = useRef(hasChanges);
  useEffect(() => { hasChangesRef.current = hasChanges; }, [hasChanges]);
  const selectedRef = useRef(selectedName);
  useEffect(() => { selectedRef.current = selectedName; }, [selectedName]);

  const apiBase = projectId ? `/api/projects/${projectId}/skills` : `/api/user/skills`;

  const fetchSkills = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(apiBase);
      if (res.ok) {
        const data: SkillEntry[] = await res.json();
        setSkills(data);
        const cur = selectedRef.current;
        if (cur && !data.some((s) => s.name === cur)) {
          if (!hasChangesRef.current) {
            setSelectedName(null);
            setContent("");
            setSavedContent("");
            setSupportingFiles([]);
          }
        }
      }
    } catch { /* ignore silent */ }
    finally { if (!silent) setLoading(false); }
  }, [apiBase]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchSkills(); }, [fetchSkills]);

  useProjectEvents(projectId ?? "", (event) => {
    if (!projectId) return;
    if (event.kind === "skills") void fetchSkills({ silent: true });
  });

  useHomeEvents((event) => {
    if (projectId) return;
    if (event.kind === "user-skills") void fetchSkills({ silent: true });
  });

  // beforeunload guard
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  const selectSkill = async (name: string) => {
    if (hasChanges && !confirm("저장하지 않은 변경사항이 있습니다. 계속 진행?")) return;
    setSelectedName(name);
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        setContent(data.content ?? "");
        setSavedContent(data.content ?? "");
        setSupportingFiles(data.supportingFiles ?? []);
      }
    } catch { /* ignore */ }
  };

  const save = async () => {
    if (!selectedName) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(selectedName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setSavedContent(content);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "저장 실패");
      }
    } catch { alert("네트워크 오류"); }
    finally { setSaving(false); }
  };

  const openNew = () => {
    setNewName("");
    setNewError(null);
    setShowNewDialog(true);
  };

  const submitNew = async () => {
    setNewError(null);
    const trimmed = newName.trim();
    if (!isValidSkillName(trimmed)) {
      setNewError("이름 규칙: lowercase letters, numbers, hyphens (최대 64자)");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, content: getDefaultSkillTemplate(trimmed) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNewError(data.error || "생성 실패");
        return;
      }
      setShowNewDialog(false);
      await fetchSkills();
      await selectSkill(trimmed);
    } catch (e) {
      setNewError(e instanceof Error ? e.message : "네트워크 오류");
    } finally { setCreating(false); }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(deleteTarget)}`, { method: "DELETE" });
      if (res.ok) {
        if (selectedName === deleteTarget) {
          setSelectedName(null);
          setContent("");
          setSavedContent("");
          setSupportingFiles([]);
        }
        setDeleteTarget(null);
        await fetchSkills();
      } else {
        alert("삭제 실패");
      }
    } catch { alert("네트워크 오류"); }
    finally { setDeleting(false); }
  };

  return (
    <div className="flex h-full">
      {/* Left: list */}
      <div className="w-64 border-r border-border flex flex-col">
        <div className="p-2 border-b border-border flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={openNew}>
            <Plus className="size-3.5" /> <span className="ml-1">New</span>
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {skills.length} skill{skills.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
          ) : skills.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No skills yet. Click New to create one.
            </div>
          ) : (
            skills.map((s) => (
              <div
                key={s.name}
                onClick={() => selectSkill(s.name)}
                className={`px-3 py-2 cursor-pointer hover:bg-accent border-b border-border/50 text-sm flex items-center gap-2 ${
                  selectedName === s.name ? "bg-accent" : ""
                }`}
              >
                <FolderOpen className="size-3.5 text-muted-foreground" />
                <span className="flex-1 truncate">{s.name}</span>
                {s.hasSupportingFiles && (
                  <span className="text-[10px] text-muted-foreground">+files</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedName ? (
          <>
            <div className="px-4 py-2 border-b border-border flex items-center gap-2">
              <span className="text-sm font-medium truncate">{selectedName}/SKILL.md</span>
              <div className="ml-auto flex items-center gap-2">
                {hasChanges && <span className="text-xs text-yellow-400">Unsaved</span>}
                <Button size="sm" onClick={save} disabled={!hasChanges || saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeleteTarget(selectedName)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
            {supportingFiles.length > 0 && (
              <div className="px-4 py-1.5 border-b border-border/50 bg-muted/30 text-xs text-muted-foreground">
                Supporting files: {supportingFiles.join(", ")}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <CodeEditor value={content} onChange={setContent} language="markdown" />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a skill or create a new one.
          </div>
        )}
      </div>

      {/* New dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Skill</DialogTitle>
            <DialogDescription>
              Lowercase letters, numbers, hyphens (max 64 chars). Creates \`&lt;name&gt;/SKILL.md\`.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="my-skill"
              autoFocus
            />
            {newError && (
              <div className="text-xs text-destructive">{newError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={submitNew} disabled={creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Skill</DialogTitle>
            <DialogDescription>
              <span className="font-medium">{deleteTarget}</span> directory will be deleted
              including all supporting files. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
