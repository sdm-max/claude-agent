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

  const reset = () => {
    setStep(1);
    setAgentName("");
    setProfileId(null);
    setNameError(null);
    setPreview(null);
    setWarnings([]);
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

  const goToStep2 = async () => {
    const err = validateName(agentName);
    if (err) {
      setNameError(err);
      return;
    }
    setNameError(null);
    setPreviewLoading(true);

    try {
      const id = profileId ?? "none";
      const res = await fetch(`/api/agent-references/${id}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNameError(data.errors?.[0]?.messageKo ?? data.error ?? "오류 발생");
        return;
      }
      setPreview(data.md);
      setWarnings(data.warnings ?? []);
      setStep(2);
    } catch {
      setNameError("서버 연결 실패");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreate = () => {
    if (!preview) return;
    onCreate(agentName, preview);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "New Agent — Step 1: Name & Profile" : "New Agent — Step 2: Preview"}
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
            {warnings.length > 0 && (
              <div className="space-y-1">
                {warnings.map((w, i) => (
                  <p key={i} className="text-xs text-yellow-500">⚠ {w.messageKo}</p>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-hidden rounded-lg border border-border">
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
            <Button onClick={handleCreate}>
              Create
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
