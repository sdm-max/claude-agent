"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ProfileSummary {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  riskLevel: string;
  costTier: number;
  model: string;
}

interface CategoryGroup {
  key: string;
  nameKo: string;
  profiles: ProfileSummary[];
}

const RISK_EMOJI: Record<string, string> = {
  safe: "🟢",
  moderate: "🟡",
  elevated: "🟠",
  high: "🔴",
};

const COST_STR: Record<number, string> = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

const MODEL_LABEL: Record<string, string> = {
  opus: "Opus",
  sonnet: "Sonnet",
  haiku: "Haiku",
  inherit: "Inherit",
};

interface Props {
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export default function ProfileSelector({ selected, onSelect }: Props) {
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agent-references")
      .then((r) => r.json())
      .then((data) => setCategories(data.categories))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading profiles...</div>;
  }

  return (
    <div className="border border-border rounded-lg overflow-y-auto max-h-[400px]">
      {/* None option */}
      <ProfileRow
        id={null}
        nameKo="빈 템플릿"
        descriptionKo="참조문 없이 빈 에이전트 생성"
        riskLevel=""
        costTier={0}
        model=""
        isSelected={selected === null}
        onSelect={() => onSelect(null)}
      />

      {categories.map((cat) => (
        <div key={cat.key}>
          <div className="px-3 py-1.5 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t border-border">
            {cat.nameKo}
          </div>
          {cat.profiles.map((p) => (
            <ProfileRow
              key={p.id}
              id={p.id}
              nameKo={p.nameKo}
              descriptionKo={p.descriptionKo}
              riskLevel={p.riskLevel}
              costTier={p.costTier}
              model={p.model}
              isSelected={selected === p.id}
              onSelect={() => onSelect(p.id)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ProfileRow({
  id,
  nameKo,
  descriptionKo,
  riskLevel,
  costTier,
  model,
  isSelected,
  onSelect,
}: {
  id: string | null;
  nameKo: string;
  descriptionKo: string;
  riskLevel: string;
  costTier: number;
  model: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 cursor-pointer border-t border-border first:border-t-0",
        isSelected ? "bg-primary/10 text-primary" : "hover:bg-accent"
      )}
      onClick={onSelect}
    >
      <div
        className={cn(
          "w-3.5 h-3.5 rounded-full border-2 shrink-0",
          isSelected ? "border-primary bg-primary" : "border-muted-foreground"
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{nameKo}</div>
        <div className="text-xs text-muted-foreground truncate">{descriptionKo}</div>
      </div>
      {riskLevel && (
        <div className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{RISK_EMOJI[riskLevel] ?? ""}</span>
          <span>{COST_STR[costTier] ?? ""}</span>
          <span className="text-[10px] font-mono">{MODEL_LABEL[model] ?? model}</span>
        </div>
      )}
    </div>
  );
}
