"use client";

import CodeEditor from "@/components/editors/CodeEditor";

interface Props {
  content: string;
}

export default function AgentPreview({ content }: Props) {
  return (
    <div className="h-full overflow-hidden">
      <CodeEditor value={content} onChange={() => {}} language="markdown" readOnly />
    </div>
  );
}
