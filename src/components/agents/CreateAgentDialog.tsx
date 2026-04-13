"use client";

import { useState } from "react";
import ProfileSelector from "./ProfileSelector";
import AgentPreview from "./AgentPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, content: string) => void;
}

export default function CreateAgentDialog({ open, onClose, onCreate }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [agentName, setAgentName] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  // Step 2 state
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [warnings, setWarnings] = useState<{ messageKo: string }[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<string[]>([]);
  const [newRefPath, setNewRefPath] = useState("");

  const reset = () => {
    setStep(1);
    setAgentName("");
    setProfileId(null);
    setNameError(null);
    setPreview(null);
    setWarnings([]);
    setReferenceFiles([]);
    setNewRefPath("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const validateName = (name: string): string | null => {
    if (!name.trim()) return "이름을 입력하세요";
    if (!/^[a-z][a-z0-9-]*$/.test(name)) return "소문자로 시작, a-z/0-9/하이픈만 가능";
    if (name.length > 50) return "50자 이하";
    return null;
  };

  const fetchPreview = async (refs: string[], useDefaultsIfFirst: boolean) => {
    const id = profileId ?? "none";
    const body: Record<string, unknown> = { agentName };
    if (!useDefaultsIfFirst) body.referenceFiles = refs;
    const res = await fetch(`/api/agent-references/${id}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.errors?.[0]?.messageKo ?? data.error ?? "오류 발생");
    }
    return data as {
      md: string;
      warnings: { messageKo: string }[];
      defaultReferenceFiles?: string[];
    };
  };

  const goToStep2 = async () => {
    const err = validateName(agentName);
    if (err) {
      setNameError(err);
      return;
    }
    setNameError(null);
    setPreviewLoading(true);

    try {
      const data = await fetchPreview([], true);
      setPreview(data.md);
      setWarnings(data.warnings ?? []);
      setReferenceFiles(data.defaultReferenceFiles ?? []);
      setStep(2);
    } catch (e) {
      setNameError(e instanceof Error ? e.message : "서버 연결 실패");
    } finally {
      setPreviewLoading(false);
    }
  };

  const refreshPreview = async (refs: string[]) => {
    setPreviewLoading(true);
    try {
      const data = await fetchPreview(refs, false);
      setPreview(data.md);
      setWarnings(data.warnings ?? []);
    } catch {
      // keep prior preview
    } finally {
      setPreviewLoading(false);
    }
  };

  const addRef = async () => {
    const path = newRefPath.trim();
    if (!path || referenceFiles.includes(path)) return;
    const next = [...referenceFiles, path];
    setReferenceFiles(next);
    setNewRefPath("");
    await refreshPreview(next);
  };

  const removeRef = async (path: string) => {
    const next = referenceFiles.filter((p) => p !== path);
    setReferenceFiles(next);
    await refreshPreview(next);
  };

  const handleCreate = () => {
    if (!preview) return;
    onCreate(agentName, preview);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "New Agent — Step 1: Name & Profile" : "New Agent — Step 2: Preview & References"}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            <div className="space-y-2">
              <Label>Agent Name</Label>
              <Input
                autoFocus
                placeholder="code-reviewer"
                value={agentName}
                onChange={(e) => {
                  setAgentName(e.target.value);
                  setNameError(null);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") goToStep2(); }}
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>

            <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
              <Label>Governance Profile (참조문)</Label>
              <div className="flex-1 overflow-hidden">
                <ProfileSelector selected={profileId} onSelect={setProfileId} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            {/* 참조 문서 관리 */}
            <div className="space-y-2">
              <Label className="text-xs">참조 문서 (작업 시작 전 Read 툴로 읽음)</Label>
              <div className="flex flex-wrap gap-1.5">
                {referenceFiles.length === 0 && (
                  <p className="text-xs text-muted-foreground">참조 파일 없음 — 아래에 경로를 추가하세요</p>
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
                  placeholder="docs/architecture.md"
                  value={newRefPath}
                  onChange={(e) => setNewRefPath(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRef(); } }}
                  className="h-8 text-xs font-mono"
                />
                <Button type="button" size="sm" variant="outline" onClick={addRef} disabled={!newRefPath.trim()}>
                  추가
                </Button>
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="space-y-1">
                {warnings.map((w, i) => (
                  <p key={i} className="text-xs text-yellow-500">⚠ {w.messageKo}</p>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-hidden rounded-lg border border-border relative">
              {previewLoading && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                  <span className="text-xs text-muted-foreground">렌더링...</span>
                </div>
              )}
              <AgentPreview content={preview ?? ""} />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              ← Back
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {step === 1 ? (
            <Button onClick={goToStep2} disabled={!agentName.trim() || previewLoading}>
              {previewLoading ? "Loading..." : "Next →"}
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={previewLoading}>
              Create
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
