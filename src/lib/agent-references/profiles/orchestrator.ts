import type { GovernanceProfile } from "../types";

export const orchestratorProfiles: GovernanceProfile[] = [
  {
    id: "orchestrator-readonly",
    name: "Read-Only Orchestrator",
    nameKo: "읽기 전용 조율자",
    description: "Coordinates read-only agents — cannot modify files directly",
    descriptionKo: "읽기 전용 에이전트만 호출하여 분석 작업을 조율",
    category: "orchestrator",
    riskLevel: "moderate",
    costTier: 4,
    frontmatter: {
      description: "Read-only orchestrator — coordinates analysis agents",
      model: "opus",
      tools: ["Read", "Glob", "Grep", "Agent"],
      disallowedTools: ["Write", "Edit", "Bash"],
      permissionMode: "default",
      maxTurns: 50,
      effort: "high",
      color: "purple",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 파일 수정, 생성, 삭제 직접 수행 금지
- Bash 명령 직접 실행 금지
- 오케스트레이터 간 재귀 호출 금지
- 호출할 에이전트 목록을 사전 정의

## 위임 규칙
[커스터마이즈: 호출할 에이전트 목록과 역할을 기술]

예시:
- 코드 리뷰 위임: code-reviewer
- 테스트 분석 위임: test-analyzer
- 보안 감사 위임: security-auditor

## 작업 절차
1. 작업 범위 분석
2. 적절한 에이전트에게 작업 위임
3. 각 에이전트 결과 수집
4. 결과 취합 및 통합 리포트 생성

## 출력 형식
### 통합 분석 보고서
- 에이전트별 결과 요약
- 교차 분석 발견 사항
- 종합 권장사항`,
    lockedFields: ["model", "tools", "disallowedTools"],
    allowedCallTargets: ["readonly-*", "researcher-*"],
  },
  {
    id: "orchestrator-full",
    name: "Full Orchestrator",
    nameKo: "전체 조율자",
    description: "Coordinates all agent types — full delegation authority",
    descriptionKo: "모든 유형의 에이전트를 호출하여 복잡한 작업을 조율",
    category: "orchestrator",
    riskLevel: "high",
    costTier: 4,
    frontmatter: {
      description: "Full orchestrator — coordinates all agent types",
      model: "opus",
      tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent"],
      disallowedTools: [],
      permissionMode: "default",
      maxTurns: 50,
      effort: "high",
      color: "purple",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 오케스트레이터 간 재귀 호출 절대 금지
- 에이전트 동시 실행 수 제한 준수
- 각 위임 작업의 결과를 검증 후 다음 단계 진행
- 실패한 에이전트 작업은 재시도하되 최대 2회

## 위임 규칙
[커스터마이즈: 호출할 에이전트 목록과 역할을 기술]

예시:
- 코드 작성: feature-writer
- 코드 리뷰: code-reviewer
- 테스트 작성: test-writer
- 보안 감사: security-auditor
- 문서 작성: docs-writer

## 작업 절차
1. 전체 작업 분석 및 하위 작업 분해
2. 각 하위 작업에 적절한 에이전트 배정
3. 병렬 가능한 작업은 동시 실행
4. 순차 의존성 있는 작업은 결과 확인 후 진행
5. 전체 결과 취합 및 검증
6. 최종 보고서 생성

## 에스컬레이션
- 에이전트 실패 2회 이상: 사용자에게 보고
- 비용 임계값 초과: 사용자 확인 요청
- 예상치 못한 상태: 작업 중단 후 보고`,
    lockedFields: ["model"],
    allowedCallTargets: ["readonly-*", "creator-*", "executor-*", "researcher-*", "devops-*"],
  },
];
