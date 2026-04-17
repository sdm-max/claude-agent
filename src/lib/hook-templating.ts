import fs from "fs";
import path from "path";

/**
 * Hook template rendering engine — substitutes known variables in a raw
 * hook template string with values derived from project state.
 *
 * Supported variables (all caller-supplied):
 *   {{AGENT_WHITELIST}}   — space-separated agent names (no extension)
 *   {{AGENT_NAMES_LIST}}  — space-separated quoted agent names
 *   {{AGENT_COUNT}}       — numeric count
 *   {{DATE}}              — ISO date YYYY-MM-DD
 *   {{PROJECT_NAME}}      — basename of project path
 *
 * Usage:
 *   const vars = collectProjectVariables(projectPath);
 *   const rendered = renderTemplate(templateContent, vars);
 *
 * Template files should be named `<base>.sh.tpl` (or any extension + `.tpl`).
 * Deploy step writes rendered output to `<base>.sh` (.tpl stripped).
 */

export interface TemplateVariables {
  [key: string]: string;
}

/** List agent file basenames (without .md) from .claude/agents/ */
export function listAgents(projectPath: string): string[] {
  const agentsDir = path.join(projectPath, ".claude", "agents");
  if (!fs.existsSync(agentsDir)) return [];
  try {
    return fs.readdirSync(agentsDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => e.name.replace(/\.md$/, ""))
      .sort();
  } catch { return []; }
}

/** Collect the default variable set for a given project */
export function collectProjectVariables(projectPath: string): TemplateVariables {
  const agents = listAgents(projectPath);
  const today = new Date().toISOString().slice(0, 10);
  const projectName = path.basename(projectPath);
  return {
    AGENT_WHITELIST: agents.join(" "),
    AGENT_NAMES_LIST: agents.map((n) => `\"${n}\"`).join(" "),
    AGENT_COUNT: String(agents.length),
    DATE: today,
    PROJECT_NAME: projectName,
  };
}

/** Render a template content by substituting all {{VAR}} occurrences */
export function renderTemplate(content: string, vars: TemplateVariables): string {
  return content.replace(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g, (_match, key) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : _match;
  });
}

/** Enumerate all *.tpl files under .claude/hooks/ (non-recursive) */
export function listHookTemplates(projectPath: string): string[] {
  const hooksDir = path.join(projectPath, ".claude", "hooks");
  if (!fs.existsSync(hooksDir)) return [];
  try {
    return fs.readdirSync(hooksDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".tpl"))
      .map((e) => e.name)
      .sort();
  } catch { return []; }
}

/**
 * Render a single template file and write the result to the same directory
 * with the `.tpl` extension stripped.
 * Returns { output, rendered } or null if template missing.
 */
export function deployTemplate(
  projectPath: string,
  tplName: string,
  vars: TemplateVariables,
): { output: string; rendered: string } | null {
  const hooksDir = path.join(projectPath, ".claude", "hooks");
  const tplPath = path.join(hooksDir, tplName);
  if (!fs.existsSync(tplPath)) return null;
  const raw = fs.readFileSync(tplPath, "utf8");
  const rendered = renderTemplate(raw, vars);
  const outName = tplName.replace(/\.tpl$/, "");
  const outPath = path.join(hooksDir, outName);
  fs.writeFileSync(outPath, rendered, "utf8");
  // Preserve executable bit if original was executable
  try {
    const st = fs.statSync(tplPath);
    fs.chmodSync(outPath, st.mode | 0o111); // add execute bits
  } catch { /* ignore */ }
  return { output: outName, rendered };
}
