"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  projectId: string;
  onApplied?: () => void;
}

export default function AgentHeaderButton({ projectId, onApplied }: Props) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const openDialog = async () => {
    setResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/agent-header`);
      if (res.ok) {
        const data = await res.json();
        const c = data.content || "";
        setContent(c);
        setSavedContent(c);
      }
    } catch { /* ignore */ }
    setOpen(true);
  };

  const saveHeader = async () => {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/agent-header`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setSavedContent(content);
        setResult("헤더 저장 완료");
      } else {
        setResult("저장 실패");
      }
    } catch { setResult("네트워크 오류"); }
    finally { setSaving(false); }
  };

  const applyMode = async (mode: "inject" | "strip") => {
    setApplying(true);
    setResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/agent-header/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`${mode === "inject" ? "주입" : "제거"} 완료: ${data.updated}/${data.total} 파일`);
        onApplied?.();
      } else {
        setResult(data.error || "일괄 적용 실패");
      }
    } catch { setResult("네트워크 오류"); }
    finally { setApplying(false); }
  };

  return (
    <>
      <Button variant="outline" size="xs" onClick={openDialog}>
        Header
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>공통 에이전트 헤더</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            모든 에이전트 파일 상단(YAML frontmatter 뒤)에 공통으로 주입될 헤더. 마커{" "}
            <code>{"<!-- COMMON-HEADER:START/END -->"}</code> 사이 블록은 일괄 업데이트 가능.
          </p>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            className="font-mono text-xs"
            placeholder={"## 필수 규칙\n- 근거 필수\n- governance.md 참조\n..."}
          />
          {result && (
            <div className="text-xs text-muted-foreground">{result}</div>
          )}
          <DialogFooter className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving || applying}
            >
              Close
            </Button>
            <Button
              onClick={saveHeader}
              disabled={saving || content === savedContent}
            >
              {saving ? "저장 중..." : "Save Header"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => applyMode("inject")}
              disabled={applying || !savedContent}
            >
              {applying ? "적용 중..." : "Apply to All"}
            </Button>
            <Button
              variant="outline"
              onClick={() => applyMode("strip")}
              disabled={applying}
            >
              Strip from All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
