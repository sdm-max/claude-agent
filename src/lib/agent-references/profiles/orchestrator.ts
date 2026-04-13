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
    referenceFiles: ["CLAUDE.md"],
  },
  {
    id: "orchestrator-feature-builder",
    name: "Feature Builder Orchestrator",
    nameKo: "기능 구현 조율자",
    description: "Coordinates feature implementation: design → code → test → review",
    descriptionKo: "기능 구현 전 과정을 조율 (설계→구현→테스트→리뷰)",
    category: "orchestrator",
    riskLevel: "high",
    costTier: 4,
    frontmatter: {
      description: "Feature builder — orchestrates end-to-end feature development",
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
- 파일 수정/Bash 직접 실행 금지 (모두 서브에이전트에 위임)
- 단계별로 순차 진행, 각 단계 검증 후 다음 진행
- 실패 시 사용자에게 에스컬레이션

## 위임 플로우
1. **설계 단계** → researcher-deep 또는 rfc-drafter
   - 요구사항 분석 및 설계 문서 작성
2. **구현 단계** → creator-scoped 또는 creator-full
   - 코드 작성 및 수정
3. **테스트 단계** → test-writer (별도 정의)
   - 단위/통합 테스트 생성
4. **리뷰 단계** → readonly-strict 또는 code-reviewer
   - 보안/성능/품질 검토
5. **통합 보고**
   - 전체 결과 취합 및 사용자 보고

## 역할
[커스터마이즈: 대상 기능과 품질 기준을 기술]`,
    lockedFields: ["model", "tools", "disallowedTools"],
    allowedCallTargets: ["readonly-*", "creator-*", "researcher-*"],
    referenceFiles: ["CLAUDE.md"],
  },
  {
    id: "orchestrator-release-manager",
    name: "Release Manager Orchestrator",
    nameKo: "릴리스 관리 조율자",
    description: "Coordinates release process: checklist → build → deploy → verify",
    descriptionKo: "릴리스 프로세스 전체를 조율 (체크리스트→빌드→배포→검증)",
    category: "orchestrator",
    riskLevel: "high",
    costTier: 4,
    frontmatter: {
      description: "Release manager — orchestrates release pipeline",
      model: "opus",
      tools: ["Read", "Glob", "Grep", "Agent"],
      disallowedTools: ["Write", "Edit", "Bash"],
      permissionMode: "default",
      maxTurns: 50,
      effort: "high",
      color: "red",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 모든 단계를 서브에이전트에 위임
- 각 단계 실패 시 즉시 중단 및 롤백
- 배포 승인 단계에서 사용자 확인 필수

## 릴리스 플로우
1. **사전 체크** → readonly-analysis
   - 테스트 상태, 빌드 상태, 변경사항 확인
2. **릴리스 노트** → researcher-deep
   - 변경사항 요약 및 릴리스 노트 작성
3. **빌드** → executor-isolated
   - 프로덕션 빌드 생성
4. **Staging 배포** → executor-deployer
   - Staging 환경에 배포 및 스모크 테스트
5. **프로덕션 배포** → executor-deployer
   - **사용자 승인 필요**
   - 프로덕션 배포 실행
6. **배포 후 검증** → devops-readonly
   - 헬스 체크, 에러율, 레이턴시 확인

## 역할
[커스터마이즈: 릴리스 전략(canary/blue-green)과 환경을 기술]`,
    lockedFields: ["model", "tools", "disallowedTools"],
    allowedCallTargets: ["readonly-*", "executor-*", "devops-*", "researcher-*"],
    referenceFiles: ["CLAUDE.md"],
  },
  {
    id: "orchestrator-incident-response",
    name: "Incident Response Orchestrator",
    nameKo: "장애 대응 조율자",
    description: "Coordinates incident response: detect → diagnose → mitigate → postmortem",
    descriptionKo: "장애 대응을 조율 (탐지→진단→완화→포스트모템)",
    category: "orchestrator",
    riskLevel: "high",
    costTier: 4,
    frontmatter: {
      description: "Incident response — orchestrate detection, diagnosis, mitigation",
      model: "opus",
      tools: ["Read", "Glob", "Grep", "Agent"],
      disallowedTools: ["Write", "Edit", "Bash"],
      permissionMode: "default",
      maxTurns: 50,
      effort: "max",
      color: "red",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 속도 최우선 (장애 대응은 시간이 비용)
- 모든 조치 사항 기록 (타임라인)
- 사용자(온콜)와 상시 커뮤니케이션

## 대응 플로우
1. **탐지 및 영향 평가** → readonly-log-analyzer + devops-readonly
   - 로그, 메트릭, 알림 확인
   - 영향 범위 파악
2. **진단** → researcher-deep
   - 근본 원인 조사 (최근 배포, 설정 변경, 외부 의존성)
3. **완화 조치** → executor-deployer (롤백) 또는 devops-apply (설정 변경)
   - **사용자 승인 필요** (중요 조치)
4. **검증** → devops-readonly
   - 서비스 복구 확인
5. **포스트모템 초안** → researcher-rfc-drafter
   - 타임라인, 근본 원인, 개선 액션 작성

## 역할
[커스터마이즈: 서비스 특성과 SLO를 기술]`,
    lockedFields: ["model", "tools", "disallowedTools"],
    allowedCallTargets: ["readonly-*", "executor-*", "devops-*", "researcher-*"],
    referenceFiles: ["CLAUDE.md"],
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
    referenceFiles: ["CLAUDE.md"],
  },
];
