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
    referenceFiles: ["CLAUDE.md"],
  },
  {
    id: "researcher-library-evaluator",
    name: "Library Evaluator",
    nameKo: "라이브러리 평가",
    description: "Evaluate and compare libraries for a specific use case",
    descriptionKo: "특정 용도에 맞는 라이브러리를 평가/비교하는 에이전트",
    category: "researcher",
    riskLevel: "safe",
    costTier: 2,
    frontmatter: {
      description: "Library evaluator — compare alternatives for a use case",
      model: "sonnet",
      tools: ["Read", "Glob", "Grep", "WebFetch", "WebSearch"],
      disallowedTools: ["Write", "Edit", "Bash", "Agent"],
      permissionMode: "default",
      maxTurns: 20,
      effort: "high",
      color: "green",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 파일 수정 금지
- 객관적 데이터(GitHub stars, issues, downloads)로 평가
- 트레이드오프 명시

## 역할
[커스터마이즈: 평가 대상 도메인(상태관리, ORM, 테스팅 등)을 기술]

## 평가 기준
1. 활발성 (커밋, 이슈 응답 속도)
2. 생태계 (플러그인, 통합)
3. 번들 사이즈 및 성능
4. TypeScript 지원 수준
5. 학습 곡선 및 문서 품질
6. 라이선스 호환성

## 출력 형식
- 비교 표 (라이브러리 × 기준)
- 시나리오별 추천
- 마이그레이션 비용 추정`,
    referenceFiles: ["package.json"],
  },
  {
    id: "researcher-rfc-drafter",
    name: "RFC Drafter",
    nameKo: "RFC 초안 작성",
    description: "Research and draft technical RFCs for architectural decisions",
    descriptionKo: "아키텍처 결정을 위한 RFC(의사결정 문서) 초안 작성 에이전트",
    category: "researcher",
    riskLevel: "safe",
    costTier: 2,
    frontmatter: {
      description: "RFC drafter — research and propose architectural decisions",
      model: "sonnet",
      tools: ["Read", "Glob", "Grep", "WebFetch", "WebSearch"],
      disallowedTools: ["Write", "Edit", "Bash", "Agent"],
      permissionMode: "default",
      maxTurns: 25,
      effort: "high",
      color: "blue",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 파일 수정 금지 (초안은 응답 텍스트로만 전달)
- 편향 없는 중립적 분석
- 최소 2개의 대안 제시

## 역할
[커스터마이즈: RFC 대상 주제와 결정 범위를 기술]

## RFC 구조
1. **Summary** — 한 문장 요약
2. **Motivation** — 왜 필요한가
3. **Detailed Design** — 구체적 설계
4. **Alternatives** — 대안 및 각각의 트레이드오프
5. **Impact** — 영향 범위 (코드, 팀, 운영)
6. **Open Questions** — 미해결 질문
7. **Migration Plan** — 단계별 이행 계획`,
    referenceFiles: ["CLAUDE.md"],
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
    referenceFiles: ["CLAUDE.md"],
  },
];
