/**
 * 권한 프리셋 — Allow/Deny 필드에서 클릭으로 등록할 수 있는 기본 항목
 */

export interface PermissionPreset {
  pattern: string;
  label: string;
  description: string;
  warning?: string; // deny에서 표시되는 경고
  allowWarning?: string; // allow에서 표시되는 주의사항
  category: "file" | "command" | "search" | "web" | "agent";
}

export const PERMISSION_PRESETS: PermissionPreset[] = [
  // 파일 관련
  {
    pattern: "Edit(*)",
    label: "모든 파일 편집",
    description: "Claude가 기존 파일의 내용을 수정할 수 있습니다.",
    warning: "차단하면 Claude가 코드 수정을 할 수 없게 됩니다.",
    allowWarning: "설정 파일, 환경변수 등 민감한 파일도 수정 가능합니다.",
    category: "file",
  },
  {
    pattern: "Write(*)",
    label: "모든 파일 생성",
    description: "Claude가 새 파일을 만들거나 기존 파일을 덮어쓸 수 있습니다.",
    warning: "차단하면 Claude가 새 파일을 만들 수 없게 됩니다.",
    allowWarning: "기존 파일을 덮어쓸 수 있으므로 주의가 필요합니다.",
    category: "file",
  },
  {
    pattern: "Write(*.md)",
    label: "마크다운 파일만 생성",
    description: ".md 파일만 생성/덮어쓰기 허용합니다.",
    category: "file",
  },
  {
    pattern: "Read(*)",
    label: "모든 파일 읽기",
    description: "Claude가 프로젝트 내 모든 파일을 읽을 수 있습니다.",
    warning: "차단하면 Claude가 파일 내용을 확인할 수 없게 됩니다.",
    allowWarning: ".env, secrets 등 민감한 파일도 읽을 수 있습니다. 민감 파일은 Deny에 추가하세요.",
    category: "file",
  },
  {
    pattern: "Read(.env)",
    label: ".env 파일 읽기",
    description: "환경변수 파일을 읽습니다. 시크릿이 포함될 수 있습니다.",
    warning: "보안을 위해 .env 파일 읽기를 차단하는 것을 권장합니다.",
    category: "file",
  },
  {
    pattern: "Read(.env.*)",
    label: ".env.* 파일 읽기",
    description: ".env.local, .env.production 등 환경변수 파일을 읽습니다.",
    warning: "보안을 위해 차단 권장합니다.",
    category: "file",
  },
  {
    pattern: "Read(./secrets/**)",
    label: "secrets 폴더 읽기",
    description: "secrets 디렉토리 내 모든 파일을 읽습니다.",
    warning: "민감한 인증 정보가 포함될 수 있어 차단 권장합니다.",
    category: "file",
  },
  // 명령 관련
  {
    pattern: "Bash(*)",
    label: "모든 셸 명령 실행",
    description: "Claude가 터미널에서 모든 명령을 실행할 수 있습니다.",
    warning: "차단하면 Claude가 빌드, 테스트, git 등 모든 명령을 실행할 수 없게 됩니다.",
    allowWarning: "rm -rf 등 위험한 명령도 실행 가능합니다. 필요한 명령만 개별 허용하는 것을 권장합니다.",
    category: "command",
  },
  {
    pattern: "Bash(npm run *)",
    label: "npm run 명령만 실행",
    description: "npm run dev, npm run build 등 npm 스크립트만 허용합니다.",
    category: "command",
  },
  {
    pattern: "Bash(git status)",
    label: "git status 실행",
    description: "현재 git 상태를 확인합니다.",
    category: "command",
  },
  {
    pattern: "Bash(git diff *)",
    label: "git diff 실행",
    description: "파일 변경 내용을 비교합니다.",
    category: "command",
  },
  {
    pattern: "Bash(git log *)",
    label: "git log 실행",
    description: "커밋 히스토리를 조회합니다.",
    category: "command",
  },
  {
    pattern: "Bash(git add *)",
    label: "git add 실행",
    description: "파일을 스테이징합니다.",
    category: "command",
  },
  {
    pattern: "Bash(git commit *)",
    label: "git commit 실행",
    description: "변경사항을 커밋합니다.",
    category: "command",
  },
  {
    pattern: "Bash(curl *)",
    label: "curl 명령 실행",
    description: "외부 URL에 HTTP 요청을 보냅니다.",
    warning: "외부 서버로 데이터가 전송될 수 있어 차단 권장합니다.",
    category: "command",
  },
  {
    pattern: "Bash(wget *)",
    label: "wget 명령 실행",
    description: "외부 파일을 다운로드합니다.",
    warning: "외부 서버 접근이 가능해 차단 권장합니다.",
    category: "command",
  },
  {
    pattern: "Bash(ssh *)",
    label: "SSH 명령 실행",
    description: "원격 서버에 SSH 접속합니다.",
    warning: "원격 서버 접근 권한이 필요하므로 차단 권장합니다.",
    category: "command",
  },
  // 검색 관련
  {
    pattern: "Glob",
    label: "파일 패턴 검색",
    description: "파일명 패턴으로 파일을 찾습니다.",
    category: "search",
  },
  {
    pattern: "Grep",
    label: "파일 내용 검색",
    description: "파일 내용에서 텍스트를 검색합니다.",
    category: "search",
  },
  // 웹 관련
  {
    pattern: "WebFetch",
    label: "웹 페이지 가져오기",
    description: "URL에서 웹 페이지 내용을 가져옵니다.",
    category: "web",
  },
  {
    pattern: "WebSearch",
    label: "웹 검색",
    description: "인터넷에서 정보를 검색합니다.",
    category: "web",
  },
  // 에이전트
  {
    pattern: "Agent",
    label: "서브에이전트 실행",
    description: "하위 에이전트를 생성하여 복잡한 작업을 분담합니다.",
    category: "agent",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  file: "파일",
  command: "명령",
  search: "검색",
  web: "웹",
  agent: "에이전트",
};

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
}
