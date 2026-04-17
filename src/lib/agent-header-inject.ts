// Inject or replace a common header block inside an agent markdown file.
// Header is bounded by start/end markers so subsequent injections can update the
// same region idempotently.

export const HEADER_START = "<!-- COMMON-HEADER:START -->";
export const HEADER_END = "<!-- COMMON-HEADER:END -->";

function ensureTrailingNewline(s: string): string {
  return s.endsWith("\n") ? s : s + "\n";
}

/**
 * Inject headerContent into markdown. If a bounded block already exists, replace
 * it. Otherwise insert it immediately after YAML frontmatter (`---` block) or
 * at the top when no frontmatter is present.
 */
export function injectAgentHeader(markdown: string, headerContent: string): string {
  const trimmed = headerContent.trim();
  const block = `${HEADER_START}\n${trimmed}\n${HEADER_END}`;

  // Replace existing block if present
  const re = /<!-- COMMON-HEADER:START -->[\s\S]*?<!-- COMMON-HEADER:END -->/;
  if (re.test(markdown)) {
    return markdown.replace(re, block);
  }

  // Detect frontmatter (--- ... ---) at the top
  if (markdown.startsWith("---\n")) {
    const fmEnd = markdown.indexOf("\n---\n", 4);
    if (fmEnd > 0) {
      const afterFmIndex = fmEnd + 5; // past "\n---\n"
      const before = markdown.slice(0, afterFmIndex);
      const after = markdown.slice(afterFmIndex);
      return ensureTrailingNewline(before) + block + "\n\n" + after.replace(/^\n+/, "");
    }
  }

  // No frontmatter: prepend block
  return block + "\n\n" + markdown.replace(/^\n+/, "");
}

/**
 * Remove the bounded common-header block if present.
 */
export function stripAgentHeader(markdown: string): string {
  return markdown.replace(/<!-- COMMON-HEADER:START -->[\s\S]*?<!-- COMMON-HEADER:END -->\n?\n?/, "");
}
