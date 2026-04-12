import type { AgentFrontmatter } from "./types";

interface ParseResult {
  frontmatter: AgentFrontmatter;
  body: string;
}

/**
 * YAML 값을 JS 값으로 변환
 */
function parseYamlValue(value: string): unknown {
  const trimmed = value.trim();

  // Boolean
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

  // Inline array: [a, b, c]
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((s) => {
      const v = s.trim();
      // Remove quotes
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        return v.slice(1, -1);
      }
      return v;
    });
  }

  // Quoted string
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

/**
 * 간단한 YAML frontmatter 파서
 * 복잡한 중첩 구조(hooks, mcpServers)는 JSON으로 파싱 시도 후 fallback
 */
function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (match) {
      const key = match[1];
      const value = match[2].trim();

      if (value === "" || value === "|") {
        // Check if it's a block or nested object
        const nextIndent = i + 1 < lines.length ? lines[i + 1].match(/^(\s+)/)?.[1]?.length ?? 0 : 0;
        if (nextIndent > 0) {
          // Collect indented block
          const blockLines: string[] = [];
          let j = i + 1;
          while (j < lines.length) {
            const indentMatch = lines[j].match(/^(\s+)/);
            if (!indentMatch || indentMatch[1].length < nextIndent) break;
            blockLines.push(lines[j].slice(nextIndent));
            j++;
          }

          if (value === "|") {
            // Literal block scalar
            result[key] = blockLines.join("\n");
          } else {
            // Try to parse as nested object
            try {
              result[key] = JSON.parse(`{${blockLines.join("")}}`);
            } catch {
              // Store as raw string for complex nested structures
              result[key] = blockLines.join("\n");
            }
          }
          i = j;
          continue;
        } else {
          result[key] = value === "" ? "" : value;
        }
      } else {
        result[key] = parseYamlValue(value);
      }
    }
    i++;
  }

  return result;
}

/**
 * .md 파일 내용을 frontmatter + body로 파싱
 */
export function parseAgentMd(content: string): ParseResult {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!fmMatch) {
    return {
      frontmatter: { name: "", description: "" },
      body: content.trim(),
    };
  }

  const yamlStr = fmMatch[1];
  const body = fmMatch[2].trim();
  const raw = parseSimpleYaml(yamlStr);

  const frontmatter: AgentFrontmatter = {
    name: (raw.name as string) ?? "",
    description: (raw.description as string) ?? "",
  };

  if (raw.model) frontmatter.model = raw.model as string;
  if (raw.tools) frontmatter.tools = raw.tools as string[];
  if (raw.disallowedTools) frontmatter.disallowedTools = raw.disallowedTools as string[];
  if (raw.permissionMode) frontmatter.permissionMode = raw.permissionMode as string;
  if (raw.maxTurns) frontmatter.maxTurns = raw.maxTurns as number;
  if (raw.effort) frontmatter.effort = raw.effort as string;
  if (raw.isolation) frontmatter.isolation = raw.isolation as string;
  if (raw.memory) frontmatter.memory = raw.memory as string;
  if (raw.background !== undefined) frontmatter.background = raw.background as boolean;
  if (raw.color) frontmatter.color = raw.color as string;
  if (raw.initialPrompt) frontmatter.initialPrompt = raw.initialPrompt as string;
  if (raw.skills) frontmatter.skills = raw.skills as string[];
  if (raw.hooks) frontmatter.hooks = raw.hooks as Record<string, unknown>;
  if (raw.mcpServers) frontmatter.mcpServers = raw.mcpServers as Record<string, unknown>;

  return { frontmatter, body };
}

/**
 * frontmatter에서 특정 필드 추출 (빠른 조회용)
 */
export function extractFrontmatterField(content: string, field: string): string | undefined {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return undefined;

  const regex = new RegExp(`^${field}:\\s*(.+)`, "m");
  const match = fmMatch[1].match(regex);
  return match?.[1]?.trim();
}
