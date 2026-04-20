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

  // Detect frontmatter — handle LF/CRLF and EOF-terminated closing fence
  const fmRe = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
  const fmMatch = markdown.match(fmRe);
  let result: string;
  if (fmMatch) {
    const fmEnd = fmMatch[0].length;
    const before = markdown.slice(0, fmEnd);
    const after = markdown.slice(fmEnd);
    result = ensureTrailingNewline(before) + block + "\n\n" + after.replace(/^\n+/, "");
  } else {
    // No frontmatter: prepend block
    result = block + "\n\n" + markdown.replace(/^\n+/, "");
  }

  // Post-condition: if original had frontmatter, result must still start with ---
  if (fmMatch && !result.startsWith("---")) {
    throw new Error("frontmatter_lost");
  }

  return result;
}

/**
 * Remove the bounded common-header block if present.
 */
export function stripAgentHeader(markdown: string): string {
  return markdown.replace(/<!-- COMMON-HEADER:START -->[\s\S]*?<!-- COMMON-HEADER:END -->\n?\n?/, "");
}
