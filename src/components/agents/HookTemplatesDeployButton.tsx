"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface DeployInfo {
  templates: string[];
  variables: Record<string, string>;
}

interface DeployResult {
  templates: number;
  deployed: number;
  failed: number;
  deployedList: string[];
  failedList: string[];
  variables: Record<string, string>;
}

interface Props {
  projectId: string;
}

export default function HookTemplatesDeployButton({ projectId }: Props) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<DeployInfo | null>(null);
  const [result, setResult] = useState<DeployResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);

  const openDialog = async () => {
    setOpen(true);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/hook-templates/deploy`);
      if (res.ok) setInfo(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const runDeploy = async () => {
    setDeploying(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/hook-templates/deploy`, {
        method: "POST",
      });
      if (res.ok) setResult(await res.json());
    } catch { /* ignore */ }
    finally { setDeploying(false); }
  };

  const hasTemplates = info && info.templates.length > 0;

  return (
    <>
      <Button variant="outline" size="xs" onClick={openDialog}>
        Deploy Hooks
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hook Templates Deploy</DialogTitle>
            <DialogDescription>
              <code>.claude/hooks/*.tpl</code> 템플릿에 <code>{"{{AGENT_WHITELIST}}"}</code> 등
              변수를 치환하여 실제 <code>.sh</code> 로 배포.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="text-xs text-muted-foreground">Loading...</div>
          ) : (
            <>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold">현재 변수</h4>
                {info && Object.entries(info.variables).length > 0 ? (
                  <div className="rounded-lg border bg-muted/30 p-2 text-xs font-mono space-y-1">
                    {Object.entries(info.variables).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-muted-foreground shrink-0">{`{{${k}}}`}</span>
                        <span className="truncate" title={v}>= {v || "(empty)"}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">변수 없음</div>
                )}
              </div>

              <div className="space-y-2 mt-4">
                <h4 className="text-xs font-semibold">
                  Templates ({info?.templates.length ?? 0}개)
                </h4>
                {hasTemplates ? (
                  <ul className="rounded-lg border p-2 text-xs font-mono space-y-0.5 max-h-40 overflow-y-auto">
                    {info!.templates.map((t) => (
                      <li key={t}>
                        {t} <span className="text-muted-foreground">→ {t.replace(/\.tpl$/, "")}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    <code>.claude/hooks/*.tpl</code> 파일이 없습니다. 예시:
                    <pre className="mt-1 p-2 rounded bg-muted/50 font-mono text-[11px] whitespace-pre overflow-x-auto">{`# .claude/hooks/block-leader-agent-bypass.sh.tpl
#!/bin/bash
ALLOWED="{{AGENT_WHITELIST}}"
INPUT=$(cat)
AGENT=$(echo "$INPUT" | jq -r '.tool_input.subagent_type // empty')
if [[ -n "$AGENT" && ! " $ALLOWED " =~ " $AGENT " ]]; then
  echo '{"decision":"block","reason":"Agent not in whitelist"}'
fi`}</pre>
                  </div>
                )}
              </div>

              {result && (
                <div className="mt-4 rounded-lg border border-green-500/40 bg-green-500/5 p-2 text-xs">
                  <div className="font-semibold">Deploy 결과</div>
                  <div>배포 완료: {result.deployed}/{result.templates}</div>
                  {result.failed > 0 && (
                    <div className="text-destructive">실패: {result.failed}</div>
                  )}
                  {result.deployedList.length > 0 && (
                    <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                      {result.deployedList.map((l, i) => <li key={i}>• {l}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deploying}>
              Close
            </Button>
            <Button onClick={runDeploy} disabled={deploying || !hasTemplates}>
              {deploying ? "Deploying..." : "Deploy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
