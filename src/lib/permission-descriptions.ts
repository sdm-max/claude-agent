/**
 * Claude Code 권한 패턴을 사람이 읽을 수 있는 한글 설명으로 변환
 */

const TOOL_DESCRIPTIONS: Record<string, string> = {
  Edit: "파일 편집",
  Write: "파일 생성/덮어쓰기",
  Read: "파일 읽기",
  Bash: "셸 명령 실행",
  Glob: "파일 패턴 검색",
  Grep: "파일 내용 검색",
  WebFetch: "웹 페이지 가져오기",
  WebSearch: "웹 검색",
  Agent: "서브에이전트 실행",
  AskUserQuestion: "사용자 질문",
  ExitPlanMode: "플랜 모드 종료",
};

/**
 * 권한 패턴을 한글 설명으로 변환
 * @example
 *   "Edit(*)" → "모든 파일 편집"
 *   "Read(.env)" → ".env 파일 읽기"
 *   "Bash(npm run *)" → "npm run * 명령 실행"
 *   "Glob" → "파일 패턴 검색"
 */
export function describePermission(pattern: string): string {
  // 도구명만 있는 경우: "Glob", "Grep"
  if (TOOL_DESCRIPTIONS[pattern]) {
    return TOOL_DESCRIPTIONS[pattern];
  }

  // 도구명(패턴) 형식 파싱
  const match = pattern.match(/^(\w+)\((.+)\)$/);
  if (!match) return pattern;

  const [, tool, arg] = match;
  const toolDesc = TOOL_DESCRIPTIONS[tool];
  if (!toolDesc) return pattern;

  // 와일드카드 패턴 해석
  if (arg === "*") {
    return `모든 ${toolDesc.replace("파일 ", "파일 ").replace("명령 ", "")}`;
  }

  // 구체적 패턴
  if (tool === "Bash") {
    return `${arg} 명령 실행`;
  }
  if (tool === "Read" || tool === "Edit" || tool === "Write") {
    return `${arg} ${toolDesc.split(" ")[1] || ""}`.trim();
  }

  return `${arg} ${toolDesc}`;
}
