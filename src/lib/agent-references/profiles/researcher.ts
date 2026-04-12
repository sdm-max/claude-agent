import type { GovernanceProfile } from "../types";

export const researcherProfiles: GovernanceProfile[] = [
  {
    id: "researcher-light",
    name: "Light Researcher",
    nameKo: "경량 조사",
    description: "Background web research with minimal cost",
    descriptionKo: "백그라운드에서 저비용으로 웹 조사를 수행하는 에이전트",
    category: "researcher",
    riskLevel: "safe",
    costTier: 1,
    frontmatter: {
      description: "Lightweight background researcher — search and summarize",
      model: "haiku",
      tools: ["Read", "Glob", "Grep", "WebFetch", "WebSearch"],
      disallowedTools: ["Write", "Edit", "Bash", "Agent"],
      permissionMode: "default",
      maxTurns: 15,
      effort: "low",
      background: true,
      color: "cyan",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 파일 수정 금지
- 셸 명령 실행 금지
- 백그라운드에서 실행됨
- 조사 결과를 간결하게 요약

## 역할
[커스터마이즈: 조사 주제와 범위를 기술]

## 조사 절차
1. WebSearch로 키워드 검색
2. WebFetch로 상세 정보 수집
3. 핵심 포인트 요약
4. 출처 URL 포함 보고`,
    lockedFields: ["tools", "disallowedTools", "background"],
  },
  {
    id: "researcher-deep",
    name: "Deep Researcher",
    nameKo: "심층 조사",
    description: "Foreground deep research with higher quality analysis",
    descriptionKo: "포그라운드에서 고품질 심층 분석을 수행하는 조사 에이전트",
    category: "researcher",
    riskLevel: "safe",
    costTier: 2,
    frontmatter: {
      description: "Deep researcher — thorough analysis with web and codebase",
      model: "sonnet",
      tools: ["Read", "Glob", "Grep", "WebFetch", "WebSearch"],
      disallowedTools: ["Write", "Edit", "Bash", "Agent"],
      permissionMode: "default",
      maxTurns: 25,
      effort: "high",
      color: "green",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 파일 수정 금지
- 셸 명령 실행 금지
- 심층적이고 구조화된 분석 결과 제출

## 역할
[커스터마이즈: 조사 주제, 비교 대상, 판단 기준을 기술]

## 조사 프레임워크
1. 프로젝트 코드베이스 분석 (Read/Glob/Grep)
2. 외부 문서/레퍼런스 조사 (WebSearch/WebFetch)
3. 비교 분석 및 트레이드오프 정리
4. 권장사항 + 근거 보고

## 출력 형식
### 조사 결과
- 핵심 발견 사항
- 비교 분석 표
- 권장사항 (근거 포함)
- 참고 자료 링크`,
    lockedFields: ["tools", "disallowedTools"],
  },
];
