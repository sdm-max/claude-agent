"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useProjectEvents } from "@/hooks/use-project-events";
import CodeEditor from "@/components/editors/CodeEditor";
import EditorToolbar from "@/components/editors/EditorToolbar";
import AgentSettingsForm from "./AgentSettingsForm";
import AgentHooksEditor from "./AgentHooksEditor";
import AgentPreview from "./AgentPreview";
import CreateAgentDialog from "./CreateAgentDialog";
import AgentHeaderButton from "./AgentHeaderButton";
import HookTemplatesDeployButton from "./HookTemplatesDeployButton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { parseAgentMd } from "@/lib/agent-references/parser";
import { renderAgentMd } from "@/lib/agent-references/renderer";
import { getProfileById } from "@/lib/agent-references";
import type { AgentFrontmatter } from "@/lib/agent-references/types";

interface FileEntry {
  name: string;
  content: string;
}

interface Props {
  projectId: string;
}

export default function AgentEditor({ projectId }: Props) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Parsed state for form editing
  const [frontmatter, setFrontmatter] = useState<AgentFrontmatter>({ name: "", description: "" });
  const [body, setBody] = useState("");
  const [activeTab, setActiveTab] = useState("settings");

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);

  const hasChanges = content !== savedContent;
  const apiBase = `/api/projects/${projectId}/agents`;

  // ── Sync content → frontmatter/body when switching to form tabs ──
  const syncFromContent = useCallback((raw: string) => {
    const parsed = parseAgentMd(raw);
    setFrontmatter(parsed.frontmatter);
    setBody(parsed.body);
  }, []);

  // ── Sync frontmatter/body → content ──
  const syncToContent = useCallback(() => {
    // Find matching profile for locked fields display
    const profile = frontmatter.name ? null : null; // Profile tracking not needed for content sync

    // Build YAML frontmatter manually for accurate round-trip
    const lines: string[] = ["---"];
    const fm = frontmatter;
    if (fm.name) lines.push(`name: ${fm.name}`);
    if (fm.description) lines.push(`description: ${fm.description}`);
    if (fm.model) lines.push(`model: ${fm.model}`);
    if (fm.tools && fm.tools.length > 0) lines.push(`tools: [${fm.tools.join(", ")}]`);
    if (fm.disallowedTools && fm.disallowedTools.length > 0) lines.push(`disallowedTools: [${fm.disallowedTools.join(", ")}]`);
    if (fm.permissionMode) lines.push(`permissionMode: ${fm.permissionMode}`);
    if (fm.maxTurns) lines.push(`maxTurns: ${fm.maxTurns}`);
    if (fm.effort) lines.push(`effort: ${fm.effort}`);
    if (fm.isolation) lines.push(`isolation: ${fm.isolation}`);
    if (fm.memory) lines.push(`memory: ${fm.memory}`);
    if (fm.background) lines.push(`background: ${fm.background}`);
    if (fm.color) lines.push(`color: ${fm.color}`);
    if (fm.initialPrompt) lines.push(`initialPrompt: ${fm.initialPrompt}`);
    if (fm.skills && fm.skills.length > 0) lines.push(`skills: [${fm.skills.join(", ")}]`);
    // hooks as inline JSON if present
    if (fm.hooks && Object.keys(fm.hooks).length > 0) {
      lines.push(`hooks: ${JSON.stringify(fm.hooks)}`);
    }
    lines.push("---");

    void profile;
    const newContent = `${lines.join("\n")}\n\n${body}\n`;
    setContent(newContent);
  }, [frontmatter, body]);

  // When frontmatter or body changes from form, update content
  useEffect(() => {
    if (activeTab === "settings" || activeTab === "hooks") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      syncToContent();
    }
  }, [frontmatter, body, syncToContent, activeTab]);

  // ── Fetch files ──
  const hasChangesRef = useRef(hasChanges);
  useEffect(() => { hasChangesRef.current = hasChanges; }, [hasChanges]);
  const selectedNameRef = useRef(selectedName);
  useEffect(() => { selectedNameRef.current = selectedName; }, [selectedName]);

  const fetchFiles = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(apiBase);
      if (res.ok) {
        const data: FileEntry[] = await res.json();
        setFiles(data);
        const currentSelected = selectedNameRef.current;
        if (currentSelected && !data.some((f) => f.name === currentSelected)) {
          if (!hasChangesRef.current) {
            setSelectedName(null);
            setContent("");
            setSavedContent("");
          }
        }
      }
    } catch { /* ignore */ }
    finally { if (!silent) setLoading(false); }
  }, [apiBase]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // ── Real-time sync via SSE + focus/visibility fallback ──
  useProjectEvents(projectId, (event) => {
    if (event.kind === "agents") void fetchFiles({ silent: true });
  });

  useEffect(() => {
    const refresh = () => { void fetchFiles({ silent: true }); };
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchFiles]);

  // ── beforeunload ──
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  // ── Select file ──
  const selectFile = (name: string) => {
    if (name === selectedName) return;
    if (hasChanges) { setPendingSelect(name); return; }
    applySelect(name);
  };

  const applySelect = (name: string) => {
    const file = files.find((f) => f.name === name);
    if (!file) return;
    setSelectedName(name);
    setContent(file.content);
    setSavedContent(file.content);
    syncFromContent(file.content);
    setActiveTab("settings");
  };

  // ── Save ──
  const save = async () => {
    if (!selectedName) return;
    setSaving(true);
    try {
      const res = await fetch(apiBase, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedName, content }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Save failed");
        return;
      }
      setSavedContent(content);
      setFiles((prev) => prev.map((f) => f.name === selectedName ? { ...f, content } : f));
    } finally { setSaving(false); }
  };

  // ── Create (from dialog) ──
  const handleCreate = async (name: string, templateContent: string) => {
    const fileName = name.endsWith(".md") ? name : name + ".md";
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fileName, content: templateContent }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Create failed");
        return;
      }
      const newFile: FileEntry = { name: fileName, content: templateContent };
      setFiles((prev) => [...prev, newFile]);
      setSelectedName(fileName);
      setContent(templateContent);
      setSavedContent(templateContent);
      syncFromContent(templateContent);
    } catch {
      alert("Network error");
    }
  };

  // ── Delete ──
  const deleteFile = async (name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const res = await fetch(`${apiBase}?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Delete failed");
        return;
      }
      setFiles((prev) => prev.filter((f) => f.name !== name));
      if (selectedName === name) {
        setSelectedName(null);
        setContent("");
        setSavedContent("");
      }
    } catch { alert("Delete failed"); }
  };

  // ── Handle tab change ──
  const handleTabChange = (tab: string) => {
    // When switching FROM editor tab, parse content into frontmatter/body
    if (activeTab === "editor" && (tab === "settings" || tab === "hooks")) {
      syncFromContent(content);
    }
    setActiveTab(tab);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: File list ── */}
      <div className="w-64 shrink-0 flex flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-medium">
            Agents <span className="ml-1 text-xs text-muted-foreground">({files.length})</span>
          </span>
          <AgentHeaderButton projectId={projectId} onApplied={() => fetchFiles({ silent: true })} />
          <HookTemplatesDeployButton projectId={projectId} />
          <Button variant="outline" size="xs" onClick={() => setShowCreate(true)}>
            New
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {loading && <p className="px-3 py-2 text-xs text-muted-foreground">Loading...</p>}
          {!loading && files.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No agents yet</p>
          )}
          {files.map((file) => {
            const isActive = file.name === selectedName;
            return (
              <div
                key={file.name}
                className={`group flex items-center justify-between px-3 py-1.5 cursor-pointer ${
                  isActive ? "bg-secondary text-primary" : "hover:bg-accent text-foreground"
                }`}
                onClick={() => selectFile(file.name)}
              >
                <span className="text-xs truncate min-w-0 flex-1 font-mono">{file.name}</span>
                <button
                  className="ml-1 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity text-sm leading-none"
                  onClick={(e) => { e.stopPropagation(); deleteFile(file.name); }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: 4-tab editor ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedName ? (
          <>
            <EditorToolbar hasChanges={hasChanges} onSave={save} saving={saving} />
            <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
              <TabsList variant="line" className="px-4 border-b border-border">
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="hooks">Hooks</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="settings" className="flex-1 overflow-hidden">
                <AgentSettingsForm
                  frontmatter={frontmatter}
                  onChange={setFrontmatter}
                  body={body}
                  onBodyChange={setBody}
                />
              </TabsContent>

              <TabsContent value="editor" className="flex-1 overflow-hidden">
                <CodeEditor
                  value={content}
                  onChange={(val) => {
                    setContent(val);
                  }}
                  language="markdown"
                />
              </TabsContent>

              <TabsContent value="hooks" className="flex-1 overflow-hidden">
                <AgentHooksEditor
                  hooks={frontmatter.hooks ?? {}}
                  onChange={(hooks) => {
                    setFrontmatter((prev) => ({
                      ...prev,
                      hooks: Object.keys(hooks).length > 0 ? hooks : undefined,
                    }));
                  }}
                />
              </TabsContent>

              <TabsContent value="preview" className="flex-1 overflow-hidden">
                <AgentPreview content={content} />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select an agent or create a new one
          </div>
        )}
      </div>

      {/* ── Create Agent Dialog ── */}
      <CreateAgentDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />

      {/* ── Unsaved changes guard ── */}
      <Dialog open={!!pendingSelect} onOpenChange={(open) => { if (!open) setPendingSelect(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Unsaved Changes</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">You have unsaved changes. Switch files and discard them?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingSelect(null)}>Cancel</Button>
            <Button onClick={() => { if (pendingSelect) { applySelect(pendingSelect); setPendingSelect(null); } }}>
              Discard &amp; Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
