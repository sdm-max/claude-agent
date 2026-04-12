import type { AgentFrontmatter, GovernanceProfile } from "./types";

/**
 * frontmatter 객체를 YAML 문자열로 변환
 */
function toYaml(obj: Record<string, unknown>, indent = 0): string {
  const pad = "  ".repeat(indent);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${pad}${key}: []`);
      } else if (typeof value[0] === "object") {
        lines.push(`${pad}${key}:`);
        for (const item of value) {
          const itemLines = toYaml(item as Record<string, unknown>, indent + 2).split("\n");
          if (itemLines.length > 0) {
            lines.push(`${pad}  - ${itemLines[0].trim()}`);
            for (let i = 1; i < itemLines.length; i++) {
              if (itemLines[i].trim()) {
                lines.push(`${pad}    ${itemLines[i].trim()}`);
              }
            }
          }
        }
      } else {
        lines.push(`${pad}${key}: [${value.map((v) => String(v)).join(", ")}]`);
      }
    } else if (typeof value === "object") {
      lines.push(`${pad}${key}:`);
      lines.push(toYaml(value as Record<string, unknown>, indent + 1));
    } else if (typeof value === "string" && value.includes("\n")) {
      lines.push(`${pad}${key}: |`);
      for (const line of value.split("\n")) {
        lines.push(`${pad}  ${line}`);
      }
    } else if (typeof value === "string") {
      // Quote strings that contain special YAML chars
      const needsQuote = /[:#{}[\],&*?|>!%@`]/.test(value) || value === "";
      lines.push(`${pad}${key}: ${needsQuote ? `"${value}"` : value}`);
    } else {
      lines.push(`${pad}${key}: ${value}`);
    }
  }

  return lines.join("\n");
}

/**
 * frontmatter를 YAML frontmatter 블록으로 변환
 */
function renderFrontmatter(frontmatter: AgentFrontmatter): string {
  const obj: Record<string, unknown> = {};

  // 순서 보장을 위해 명시적으로 나열
  if (frontmatter.name) obj.name = frontmatter.name;
  if (frontmatter.description) obj.description = frontmatter.description;
  if (frontmatter.model) obj.model = frontmatter.model;
  if (frontmatter.tools) obj.tools = frontmatter.tools;
  if (frontmatter.disallowedTools && frontmatter.disallowedTools.length > 0) {
    obj.disallowedTools = frontmatter.disallowedTools;
  }
  if (frontmatter.permissionMode) obj.permissionMode = frontmatter.permissionMode;
  if (frontmatter.maxTurns) obj.maxTurns = frontmatter.maxTurns;
  if (frontmatter.effort) obj.effort = frontmatter.effort;
  if (frontmatter.isolation) obj.isolation = frontmatter.isolation;
  if (frontmatter.memory) obj.memory = frontmatter.memory;
  if (frontmatter.background !== undefined) obj.background = frontmatter.background;
  if (frontmatter.color) obj.color = frontmatter.color;
  if (frontmatter.initialPrompt) obj.initialPrompt = frontmatter.initialPrompt;
  if (frontmatter.skills && frontmatter.skills.length > 0) obj.skills = frontmatter.skills;
  // hooks와 mcpServers는 복잡한 구조이므로 별도 처리
  if (frontmatter.hooks && Object.keys(frontmatter.hooks).length > 0) {
    obj.hooks = frontmatter.hooks;
  }
  if (frontmatter.mcpServers && Object.keys(frontmatter.mcpServers).length > 0) {
    obj.mcpServers = frontmatter.mcpServers;
  }

  return `---\n${toYaml(obj)}\n---`;
}

/**
 * bodyTemplate에서 {{name}} 등의 플레이스홀더를 치환
 */
function renderBody(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/**
 * GovernanceProfile + 사용자 입력 이름 → 완성된 .md 파일 내용
 */
export function renderAgentMd(
  profile: GovernanceProfile,
  agentName: string,
  overrides?: Partial<AgentFrontmatter>
): string {
  const frontmatter: AgentFrontmatter = {
    ...profile.frontmatter,
    ...overrides,
    name: agentName,
  };

  const yaml = renderFrontmatter(frontmatter);
  const body = renderBody(profile.bodyTemplate, { name: agentName });

  return `${yaml}\n\n${body}\n`;
}

/**
 * 빈 에이전트 .md 파일 생성 (참조문 없이)
 */
export function renderEmptyAgentMd(agentName: string): string {
  const frontmatter: AgentFrontmatter = {
    name: agentName,
    description: "",
    model: "sonnet",
    tools: [],
    disallowedTools: [],
    permissionMode: "default",
    maxTurns: 10,
    effort: "medium",
  };

  const yaml = renderFrontmatter(frontmatter);
  const body = `# ${agentName}\n\n## 역할\n[이 에이전트의 역할을 기술]\n\n## 규칙\n[에이전트가 따를 규칙을 기술]`;

  return `${yaml}\n\n${body}\n`;
}
