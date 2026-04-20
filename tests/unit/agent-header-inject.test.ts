import { describe, it, expect } from "vitest";
import {
  injectAgentHeader,
  stripAgentHeader,
  HEADER_START,
  HEADER_END,
} from "@/lib/agent-header-inject";

const HEADER = "Common header content";

describe("injectAgentHeader", () => {
  it("inserts block AFTER frontmatter (LF + trailing newline)", () => {
    const input = "---\nname: a\n---\nBody\n";
    const out = injectAgentHeader(input, HEADER);
    expect(out.startsWith("---\nname: a\n---")).toBe(true);
    expect(out).toContain(HEADER_START);
    expect(out).toContain(HEADER_END);
    expect(out).toContain("Body");
    // Block must come AFTER the closing fence, not before/inside it.
    const fenceEnd = out.indexOf("---", 4);
    const headerIdx = out.indexOf(HEADER_START);
    expect(headerIdx).toBeGreaterThan(fenceEnd);
    // Body still present after the header block.
    expect(out.indexOf("Body")).toBeGreaterThan(out.indexOf(HEADER_END));
  });

  it("inserts block AFTER frontmatter when closing fence has NO trailing newline (EOF)", () => {
    // This is the bug case: previously fell through to prepend, destroying frontmatter.
    const input = "---\nname: a\n---";
    const out = injectAgentHeader(input, HEADER);
    expect(out.startsWith("---")).toBe(true);
    expect(out.indexOf(HEADER_START)).toBeGreaterThan(out.indexOf("name: a"));
    // Original frontmatter intact (not duplicated, not relocated).
    expect(out.match(/^---\nname: a\n---/)).not.toBeNull();
  });

  it("handles CRLF line endings", () => {
    const input = "---\r\nname: a\r\n---\r\nBody\r\n";
    const out = injectAgentHeader(input, HEADER);
    expect(out.startsWith("---")).toBe(true);
    expect(out).toContain(HEADER_START);
    // Frontmatter close must precede header block.
    const fmCloseIdx = out.indexOf("---\r\n", 4);
    expect(fmCloseIdx).toBeGreaterThan(0);
    expect(out.indexOf(HEADER_START)).toBeGreaterThan(fmCloseIdx);
    expect(out).toContain("Body");
  });

  it("prepends block when there is NO frontmatter", () => {
    const input = "# Title\nBody";
    const out = injectAgentHeader(input, HEADER);
    expect(out.startsWith(HEADER_START)).toBe(true);
    expect(out).toContain("# Title");
    expect(out).toContain("Body");
  });

  it("REPLACES existing block on second call (idempotent — only one block)", () => {
    const input = "---\nname: a\n---\nBody\n";
    const first = injectAgentHeader(input, "first header");
    const second = injectAgentHeader(first, "second header");
    const occurrences = second.split(HEADER_START).length - 1;
    expect(occurrences).toBe(1);
    expect(second).toContain("second header");
    expect(second).not.toContain("first header");
  });

  it("does NOT split frontmatter when a value contains '---'", () => {
    const input = "---\nname: my---prefix\ndescription: x\n---\nBody\n";
    const out = injectAgentHeader(input, HEADER);
    expect(out.startsWith("---")).toBe(true);
    // The header block must appear AFTER the real terminating fence
    // (after `description: x\n---`), not after the inline `my---prefix`.
    const realFenceCloseIdx = out.indexOf("\n---", out.indexOf("description: x"));
    expect(realFenceCloseIdx).toBeGreaterThan(0);
    const headerIdx = out.indexOf(HEADER_START);
    expect(headerIdx).toBeGreaterThan(realFenceCloseIdx);
    // Frontmatter content remains intact (name + description preserved together).
    expect(out).toMatch(/---\nname: my---prefix\ndescription: x\n---/);
    expect(out).toContain("Body");
  });

  it("stripAgentHeader round-trip removes the injected block cleanly", () => {
    const input = "---\nname: a\n---\nBody\n";
    const injected = injectAgentHeader(input, HEADER);
    expect(injected).toContain(HEADER_START);
    const stripped = stripAgentHeader(injected);
    expect(stripped).not.toContain(HEADER_START);
    expect(stripped).not.toContain(HEADER_END);
    expect(stripped).toContain("name: a");
    expect(stripped).toContain("Body");
  });
});
