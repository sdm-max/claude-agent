import { NextRequest, NextResponse } from "next/server";
import { parseAgentMd } from "@/lib/agent-references/parser";
import { validateProjectAgents } from "@/lib/agent-references/validator";
import { estimateProjectCost, buildDependencyGraph, estimateAgentCost } from "@/lib/agent-references/cost-estimator";

// GET /api/projects/[id]/agents/analysis — 에이전트 비용 추정 + 의존성 그래프 + 검증
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch agent files from the project
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/projects/${id}/agents`);
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }

  const files: { name: string; content: string }[] = await res.json();

  // Parse all agent files
  const parsed = files.map((f) => {
    const { frontmatter, body } = parseAgentMd(f.content);
    return {
      name: frontmatter.name || f.name.replace(/\.md$/, ""),
      frontmatter,
      body,
    };
  });

  // Cost estimation
  const costSummary = estimateProjectCost(parsed.map((p) => p.frontmatter));
  const perAgent = parsed.map((p) => ({
    name: p.name,
    ...estimateAgentCost(p.frontmatter),
  }));

  // Dependency graph
  const graph = buildDependencyGraph(parsed);

  // Validation
  const validationErrors = validateProjectAgents(
    parsed.map((p) => ({ name: p.name, frontmatter: p.frontmatter }))
  );

  return NextResponse.json({
    costSummary,
    perAgent,
    graph,
    validationErrors,
  });
}
