import { hoverTooltip, type Tooltip } from "@codemirror/view";
import { type EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { KEY_COMMENTS } from "@/lib/templates/annotate";

function extractJsonKeyAtPos(state: EditorState, pos: number): string | null {
  const tree = syntaxTree(state);
  const node = tree.resolveInner(pos, 1);
  if (node.name === "PropertyName") {
    const text = state.doc.sliceString(node.from, node.to);
    return text.replace(/^"|"$/g, "");
  }
  return null;
}

export function jsonHoverTooltip() {
  return hoverTooltip((view, pos) => {
    const key = extractJsonKeyAtPos(view.state, pos);
    if (!key) return null;
    const comment = KEY_COMMENTS[key];
    if (!comment) return null;

    return {
      pos,
      above: true,
      create() {
        const dom = document.createElement("div");
        dom.style.padding = "4px 8px";
        dom.style.fontSize = "12px";
        dom.style.maxWidth = "300px";
        dom.textContent = comment;
        return { dom };
      },
    } satisfies Tooltip;
  });
}
