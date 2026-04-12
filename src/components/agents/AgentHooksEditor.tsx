"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { HOOK_EVENTS } from "@/lib/settings-schema";
import type { HookEvent } from "@/lib/settings-schema";

interface HookEntry {
  type: string;
  command?: string;
  timeout?: number;
}

interface HookRule {
  matcher?: string;
  hooks: HookEntry[];
}

interface Props {
  hooks: Record<string, unknown>;
  onChange: (hooks: Record<string, unknown>) => void;
}

export default function AgentHooksEditor({ hooks, onChange }: Props) {
  const typedHooks = hooks as Record<string, HookRule[]>;

  const updateEvent = (event: string, rules: HookRule[]) => {
    const next = { ...typedHooks };
    if (rules.length > 0) {
      next[event] = rules;
    } else {
      delete next[event];
    }
    onChange(next);
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <p className="text-xs text-muted-foreground mb-2">
        에이전트 전용 훅 설정. 이 에이전트가 활성화될 때만 실행됩니다.
      </p>
      {HOOK_EVENTS.map((event) => (
        <EventBlock
          key={event}
          event={event}
          rules={typedHooks[event] ?? []}
          onChange={(rules) => updateEvent(event, rules)}
        />
      ))}
    </div>
  );
}

function EventBlock({
  event,
  rules,
  onChange,
}: {
  event: HookEvent;
  rules: HookRule[];
  onChange: (rules: HookRule[]) => void;
}) {
  const [expanded, setExpanded] = useState(rules.length > 0);

  const addRule = () => {
    onChange([...rules, { hooks: [{ type: "command", command: "" }] }]);
    setExpanded(true);
  };

  return (
    <div className="rounded-lg border border-border">
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{expanded ? "▼" : "▶"}</span>
          <Label className="cursor-pointer text-sm">{event}</Label>
          {rules.length > 0 && (
            <Badge variant="secondary" className="text-xs">{rules.length}</Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="xs"
          onClick={(e) => { e.stopPropagation(); addRule(); }}
        >
          + Rule
        </Button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {rules.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">No rules</p>
          )}
          {rules.map((rule, i) => (
            <RuleBlock
              key={i}
              rule={rule}
              onUpdate={(r) => {
                const next = [...rules];
                next[i] = r;
                onChange(next);
              }}
              onRemove={() => onChange(rules.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RuleBlock({
  rule,
  onUpdate,
  onRemove,
}: {
  rule: HookRule;
  onUpdate: (r: HookRule) => void;
  onRemove: () => void;
}) {
  return (
    <div className="p-3 bg-muted/30 rounded-md border border-border space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-xs shrink-0 w-16">Matcher</Label>
        <Input
          className="flex-1"
          value={rule.matcher ?? ""}
          onChange={(e) => onUpdate({ ...rule, matcher: e.target.value || undefined })}
          placeholder="Tool pattern (e.g. Bash|Write)"
        />
        <Button variant="ghost" size="icon-xs" onClick={onRemove} className="text-destructive">
          &times;
        </Button>
      </div>

      {rule.hooks.map((hook, hi) => (
        <div key={hi} className="flex items-start gap-2">
          <Textarea
            className="flex-1 font-mono text-xs min-h-[36px]"
            value={hook.command ?? ""}
            onChange={(e) => {
              const hooks = [...rule.hooks];
              hooks[hi] = { ...hooks[hi], command: e.target.value };
              onUpdate({ ...rule, hooks });
            }}
            placeholder="Shell command"
            rows={(hook.command ?? "").includes("\n") ? 3 : 1}
          />
          <Input
            type="number"
            className="w-20 shrink-0"
            value={hook.timeout ?? ""}
            onChange={(e) => {
              const hooks = [...rule.hooks];
              hooks[hi] = { ...hooks[hi], timeout: e.target.value ? Number(e.target.value) : undefined };
              onUpdate({ ...rule, hooks });
            }}
            placeholder="sec"
          />
          {rule.hooks.length > 1 && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => {
                const hooks = rule.hooks.filter((_, j) => j !== hi);
                onUpdate({ ...rule, hooks });
              }}
            >
              &times;
            </Button>
          )}
        </div>
      ))}

      <Button
        variant="link"
        size="xs"
        className="p-0 h-auto text-xs"
        onClick={() => onUpdate({ ...rule, hooks: [...rule.hooks, { type: "command", command: "" }] })}
      >
        + Command
      </Button>
    </div>
  );
}
