import { EditorView, Decoration, type DecorationSet, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { KEY_COMMENTS } from "@/lib/templates/annotate";

/**
 * CodeMirror extension: JSON 키 라인 끝에 회색 인라인 설명 표시
 * 예: "model": "claude-sonnet-4-6"  ← 사용할 Claude 모델
 */

class HintWidget extends WidgetType {
  constructor(private desc: string) {
    super();
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-json-hint";
    span.style.cssText = "color:#6b7280;font-size:11px;margin-left:12px;opacity:0.6;pointer-events:none;font-style:italic;";
    span.textContent = `← ${this.desc}`;
    return span;
  }
  eq(other: HintWidget) {
    return this.desc === other.desc;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const decorations: Array<{ pos: number; deco: Decoration }> = [];
  const tree = syntaxTree(view.state);

  tree.iterate({
    enter(node) {
      if (node.name === "PropertyName") {
        const text = view.state.doc.sliceString(node.from, node.to);
        const key = text.replace(/^"|"$/g, "");
        const desc = KEY_COMMENTS[key];
        if (desc) {
          const line = view.state.doc.lineAt(node.from);
          decorations.push({
            pos: line.to,
            deco: Decoration.widget({ widget: new HintWidget(desc), side: 1 }),
          });
        }
      }
    },
  });

  decorations.sort((a, b) => a.pos - b.pos);
  return Decoration.set(decorations.map((d) => d.deco.range(d.pos)));
}

const plugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

export function jsonInlineHints() {
  return plugin;
}
