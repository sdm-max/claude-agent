"use client";

import { useState } from "react";
import type { AgentFrontmatter } from "@/lib/agent-references/types";
import { parseReferenceSection } from "@/lib/agent-references/renderer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const AVAILABLE_TOOLS = [
  "Read", "Write", "Edit", "Bash", "Glob", "Grep",
  "Agent", "WebFetch", "WebSearch", "NotebookEdit",
];

const MODELS = [
  { value: "opus", label: "Opus ($$$$)" },
  { value: "sonnet", label: "Sonnet ($$)" },
  { value: "haiku", label: "Haiku ($)" },
  { value: "inherit", label: "Inherit (세션 모델)" },
];

const PERMISSION_MODES = [
  { value: "default", label: "Default" },
  { value: "acceptEdits", label: "Accept Edits" },
  { value: "plan", label: "Plan" },
  { value: "auto", label: "Auto" },
  { value: "dontAsk", label: "Don't Ask" },
  { value: "bypassPermissions", label: "Bypass Permissions" },
];

const EFFORT_LEVELS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "max", label: "Max" },
];

const COLORS = [
  "blue", "green", "purple", "cyan", "orange", "red", "yellow", "pink",
];

interface Props {
  frontmatter: AgentFrontmatter;
  onChange: (fm: AgentFrontmatter) => void;
  lockedFields?: string[];
  body?: string;
  onBodyChange?: (body: string) => void;
}

export default function AgentSettingsForm({ frontmatter, onChange, lockedFields = [], body, onBodyChange }: Props) {
  const update = (partial: Partial<AgentFrontmatter>) => {
    onChange({ ...frontmatter, ...partial });
  };

  const isLocked = (field: string) => lockedFields.includes(field);

  // ── 참조 문서 관리 ──
  const parsed = body !== undefined ? parseReferenceSection(body) : { files: [], bodyWithoutRef: body ?? "" };
  const referenceFiles = parsed.files;
  const [newRefPath, setNewRefPath] = useState("");

  const rebuildBody = (files: string[]) => {
    if (!body || onBodyChange === undefined) return;
    const cleaned = parsed.bodyWithoutRef;
    if (files.length === 0) {
      onBodyChange(cleaned);
      return;
    }
    // body의 첫 번째 `# 제목` 뒤에 섹션 재삽입
    const section =
      "## 참조 문서 (작업 시작 전 Read 툴로 반드시 읽을 것)\n" +
      files.map((f) => `- \`${f}\``).join("\n") +
      "\n\n";
    const m = cleaned.match(/^(#[^\n]*\n\n?)([\s\S]*)$/);
    const next = m ? `${m[1]}${section}${m[2]}` : `${section}${cleaned}`;
    onBodyChange(next);
  };

  const addRef = () => {
    const p = newRefPath.trim().replace(/^@/, "");
    if (!p || referenceFiles.includes(p)) return;
    rebuildBody([...referenceFiles, p]);
    setNewRefPath("");
  };

  const removeRef = (path: string) => {
    rebuildBody(referenceFiles.filter((f) => f !== path));
  };

  const toggleTool = (tool: string, list: "tools" | "disallowedTools") => {
    const current = frontmatter[list] ?? [];
    const otherList = list === "tools" ? "disallowedTools" : "tools";
    const otherCurrent = frontmatter[otherList] ?? [];

    if (current.includes(tool)) {
      update({ [list]: current.filter((t) => t !== tool) });
    } else {
      update({
        [list]: [...current, tool],
        [otherList]: otherCurrent.filter((t) => t !== tool),
      });
    }
  };

  return (
    <div className="space-y-6 p-4 overflow-y-auto h-full">
      {/* Name & Description */}
      <Section title="기본 정보">
        <Field label="Name" locked={isLocked("name")}>
          <Input
            value={frontmatter.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="agent-name"
            className="font-mono"
          />
        </Field>
        <Field label="Description" locked={isLocked("description")}>
          <Input
            value={frontmatter.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Agent description"
          />
        </Field>
      </Section>

      {/* Model & Effort */}
      <Section title="모델 설정">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Model" locked={isLocked("model")}>
            <Select value={frontmatter.model ?? "sonnet"} onValueChange={(v) => v && update({ model: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Effort" locked={isLocked("effort")}>
            <Select value={frontmatter.effort ?? "medium"} onValueChange={(v) => v && update({ effort: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EFFORT_LEVELS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      {/* Permission & Turns */}
      <Section title="권한">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Permission Mode" locked={isLocked("permissionMode")}>
            <Select
              value={frontmatter.permissionMode ?? "default"}
              onValueChange={(v) => v && update({ permissionMode: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERMISSION_MODES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Max Turns" locked={isLocked("maxTurns")}>
            <Input
              type="number"
              min={1}
              max={100}
              value={frontmatter.maxTurns ?? 10}
              onChange={(e) => update({ maxTurns: Number(e.target.value) || 10 })}
            />
          </Field>
        </div>
      </Section>

      {/* Tools */}
      <Section title="허용 도구 (tools)">
        {isLocked("tools") && <LockedBadge />}
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_TOOLS.map((tool) => {
            const allowed = frontmatter.tools?.includes(tool);
            return (
              <Badge
                key={tool}
                variant={allowed ? "default" : "outline"}
                className="cursor-pointer select-none"
                onClick={() => toggleTool(tool, "tools")}
              >
                {allowed ? "✓ " : ""}{tool}
              </Badge>
            );
          })}
        </div>
      </Section>

      {/* Disallowed Tools */}
      <Section title="차단 도구 (disallowedTools)">
        {isLocked("disallowedTools") && <LockedBadge />}
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_TOOLS.map((tool) => {
            const blocked = frontmatter.disallowedTools?.includes(tool);
            return (
              <Badge
                key={tool}
                variant={blocked ? "destructive" : "outline"}
                className="cursor-pointer select-none"
                onClick={() => toggleTool(tool, "disallowedTools")}
              >
                {blocked ? "✗ " : ""}{tool}
              </Badge>
            );
          })}
        </div>
      </Section>

      {/* Advanced */}
      <Section title="고급 설정">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Isolation" locked={isLocked("isolation")}>
            <Select
              value={frontmatter.isolation ?? "none"}
              onValueChange={(v) => v != null && update({ isolation: v === "none" ? undefined : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="worktree">Worktree</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Color" locked={isLocked("color")}>
            <Select
              value={frontmatter.color ?? "none"}
              onValueChange={(v) => v != null && update({ color: v === "none" ? undefined : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {COLORS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Memory" locked={isLocked("memory")}>
            <Select
              value={frontmatter.memory ?? "none"}
              onValueChange={(v) => v != null && update({ memory: v === "none" ? undefined : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="local">Local</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Background">
            <div className="flex items-center gap-2 h-9">
              <Switch
                checked={frontmatter.background ?? false}
                onCheckedChange={(v) => update({ background: v || undefined })}
              />
              <span className="text-sm text-muted-foreground">
                {frontmatter.background ? "Yes" : "No"}
              </span>
            </div>
          </Field>
        </div>
      </Section>

      {/* 참조 문서 — body에 Read 툴 지시 섹션으로 삽입됨 */}
      {body !== undefined && onBodyChange !== undefined && (
        <Section title="참조 문서 (작업 시작 전 Read 툴로 읽음)">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              에이전트가 작업을 시작하기 전에 Read 툴로 먼저 읽을 파일 경로를 지정합니다.
              body의 `## 참조 문서` 섹션에 저장되며 일반 body 편집과 자동 동기화됩니다.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {referenceFiles.length === 0 && (
                <span className="text-xs text-muted-foreground">참조 파일 없음</span>
              )}
              {referenceFiles.map((path) => (
                <span
                  key={path}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border bg-muted/50 font-mono"
                >
                  {path}
                  <button
                    type="button"
                    onClick={() => removeRef(path)}
                    className="text-muted-foreground hover:text-destructive ml-0.5"
                    aria-label={`${path} 제거`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="CLAUDE.md"
                value={newRefPath}
                onChange={(e) => setNewRefPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRef();
                  }
                }}
                className="h-8 text-xs font-mono"
              />
              <Button type="button" size="sm" variant="outline" onClick={addRef} disabled={!newRefPath.trim()}>
                추가
              </Button>
            </div>
            {referenceFiles.length > 0 && !frontmatter.tools?.includes("Read") && frontmatter.tools && frontmatter.tools.length > 0 && (
              <p className="text-xs text-yellow-500">
                ⚠ 참조 파일이 지정되었지만 tools에 Read가 없습니다 — 에이전트가 파일을 읽을 수 없습니다
              </p>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, locked, children }: { label: string; locked?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs">{label}</Label>
        {locked && <LockedBadge />}
      </div>
      {children}
    </div>
  );
}

function LockedBadge() {
  return <Badge variant="outline" className="text-[10px] py-0 px-1 text-yellow-500 border-yellow-500/30">🔒</Badge>;
}
