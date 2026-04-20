"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  BASH_BUILDER_PRESETS,
  buildDefaultOptions,
  findBuilderPreset,
  isValidPattern,
  testPatternAgainst,
  type BashBuilderPreset,
} from "@/lib/bash-matcher-builder";

interface BashMatcherBuilderProps {
  /** Called when the user accepts a generated pattern ("이 패턴 사용"). */
  onPatternSelect: (pattern: string) => void;
  /** Optional — parent can close the wrapping dialog/sheet. */
  onClose?: () => void;
  /** Optional — initial pattern to prefill the test input / preview. */
  initialPattern?: string;
}

export default function BashMatcherBuilder({
  onPatternSelect,
  onClose,
  initialPattern,
}: BashMatcherBuilderProps) {
  const [presetId, setPresetId] = useState<string>(BASH_BUILDER_PRESETS[0].id);
  const preset: BashBuilderPreset =
    findBuilderPreset(presetId) ?? BASH_BUILDER_PRESETS[0];
  const [options, setOptions] = useState<Record<string, boolean>>(() =>
    buildDefaultOptions(preset),
  );
  const [testInput, setTestInput] = useState<string>(initialPattern ?? "");

  const pattern = useMemo(() => preset.buildPattern(options), [preset, options]);
  const valid = useMemo(() => isValidPattern(pattern), [pattern]);
  const matches = useMemo(
    () => (testInput ? testPatternAgainst(pattern, testInput) : null),
    [pattern, testInput],
  );

  const selectPreset = (id: string | null) => {
    if (!id) return;
    const next = findBuilderPreset(id);
    if (!next) return;
    setPresetId(id);
    setOptions(buildDefaultOptions(next));
  };

  const toggleOption = (key: string) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-4">
      {/* Preset selector */}
      <div className="space-y-1.5">
        <Label className="text-xs">프리셋</Label>
        <Select value={presetId} onValueChange={selectPreset}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BASH_BUILDER_PRESETS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{preset.description}</p>
      </div>

      {/* Options */}
      <div className="space-y-1.5">
        <Label className="text-xs">옵션</Label>
        <div className="grid grid-cols-1 gap-1 rounded-md border border-border bg-card p-2">
          {preset.options.map((opt) => {
            const checked = !!options[opt.key];
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggleOption(opt.key)}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                  checked
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent"
                }`}
              >
                <span
                  className={`size-3.5 shrink-0 rounded-sm border flex items-center justify-center ${
                    checked
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground"
                  }`}
                >
                  {checked && <span className="text-[9px] leading-none">✓</span>}
                </span>
                <span className="font-medium">{opt.label}</span>
                {opt.sample && (
                  <code className="ml-auto truncate text-[10px] text-muted-foreground">
                    {opt.sample}
                  </code>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pattern preview */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label className="text-xs">생성된 regex</Label>
          {!valid && (
            <Badge variant="destructive" className="text-[10px]">
              invalid
            </Badge>
          )}
        </div>
        <pre className="overflow-x-auto rounded-md border border-border bg-muted/50 px-2 py-1.5 font-mono text-[11px] leading-tight break-all whitespace-pre-wrap">
          {pattern || "(옵션을 하나 이상 선택하세요)"}
        </pre>
        <p className="text-[10px] text-muted-foreground">
          ERE 표기(POSIX) 로 생성됩니다. 미리보기 테스트에서는 [[:space:]] 을
          \s 로 치환해 매칭합니다.
        </p>
      </div>

      {/* Tester */}
      <div className="space-y-1.5">
        <Label className="text-xs">테스트 입력 (예: 실제 bash 명령줄)</Label>
        <div className="flex items-center gap-2">
          <Input
            className="font-mono text-xs"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="git commit --no-verify -m 'skip hooks'"
          />
          {matches === true && (
            <Badge variant="destructive" className="shrink-0">
              match
            </Badge>
          )}
          {matches === false && (
            <Badge variant="secondary" className="shrink-0">
              no match
            </Badge>
          )}
        </div>
        {preset.options.some((o) => o.sample) && (
          <div className="flex flex-wrap gap-1">
            {preset.options
              .filter((o) => o.sample)
              .map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setTestInput(o.sample!)}
                  className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-accent"
                >
                  {o.sample}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
        )}
        <Button
          size="sm"
          disabled={!valid || !pattern || pattern === ".*"}
          onClick={() => onPatternSelect(pattern)}
        >
          이 패턴 사용
        </Button>
      </div>
    </div>
  );
}
