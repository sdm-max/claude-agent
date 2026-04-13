import type { GovernanceProfile } from "../types";

export const devopsProfiles: GovernanceProfile[] = [
  {
    id: "devops-readonly",
    name: "DevOps Viewer",
    nameKo: "DevOps 조회",
    description: "Read-only DevOps — terraform plan, kubectl get, status checks only",
    descriptionKo: "인프라 상태 조회만 가능 (terraform plan, kubectl get 등)",
    category: "devops",
    riskLevel: "moderate",
    costTier: 2,
    frontmatter: {
      description: "DevOps viewer — read-only infrastructure status checks",
      model: "sonnet",
      tools: ["Read", "Bash", "Glob", "Grep"],
      disallowedTools: ["Write", "Edit", "Agent"],
      permissionMode: "plan",
      maxTurns: 15,
      effort: "high",
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command:
                  "CMD=$(cat | jq -r '.tool_input.command // empty'); echo \"$CMD\" | grep -qE '^(terraform plan|terraform show|terraform state|kubectl get|kubectl describe|kubectl logs|docker ps|docker images|helm list|aws s3 ls|gcloud)' || { echo '{\"block\":true,\"message\":\"DevOps viewer: only read commands allowed\"}' >&2; exit 2; }",
                timeout: 5,
              },
            ],
          },
        ],
      },
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 인프라 변경 명령 절대 금지 (apply, delete, destroy 등)
- 허용 명령: terraform plan/show/state, kubectl get/describe/logs, docker ps/images
- 파일 수정 금지

## 역할
[커스터마이즈: 조회할 인프라 대상을 기술]

## 조회 절차
1. 인프라 상태 확인
2. 리소스 목록 및 설정 조회
3. 로그 분석 (필요 시)
4. 상태 보고서 작성`,
    lockedFields: ["tools", "disallowedTools", "permissionMode", "hooks"],
    referenceFiles: ["CLAUDE.md"],
  },
  {
    id: "devops-monitoring",
    name: "Monitoring Setup",
    nameKo: "모니터링 설정",
    description: "Configure metrics, logs, and alerts",
    descriptionKo: "메트릭, 로그, 알림 설정을 구성하는 에이전트",
    category: "devops",
    riskLevel: "moderate",
    costTier: 3,
    frontmatter: {
      description: "Monitoring setup — configure metrics, logs, and alerts",
      model: "sonnet",
      tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      disallowedTools: ["Agent"],
      permissionMode: "acceptEdits",
      maxTurns: 20,
      effort: "high",
      color: "cyan",
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 기존 모니터링 스택(Prometheus/Datadog/Grafana) 컨벤션 준수
- 알림 임계값은 팀과 합의된 값만 사용
- 과도한 알림(노이즈) 방지

## 역할
[커스터마이즈: 모니터링 대상 서비스와 SLO를 기술]

## 설정 범위
1. **Metrics** — RED (Rate/Errors/Duration), USE (Utilization/Saturation/Errors)
2. **Logs** — 구조화 로깅, 레벨, 보관 정책
3. **Alerts** — 임계값, 에스컬레이션 정책
4. **Dashboards** — 서비스별 대시보드`,
    referenceFiles: ["CLAUDE.md", "docs/slo.md"],
  },
  {
    id: "devops-k8s-operator",
    name: "Kubernetes Operator",
    nameKo: "Kubernetes 운영",
    description: "Manage Kubernetes workloads with safety rails",
    descriptionKo: "안전 가드를 포함한 Kubernetes 워크로드 관리 에이전트",
    category: "devops",
    riskLevel: "high",
    costTier: 4,
    frontmatter: {
      description: "Kubernetes operator — manage workloads with safety checks",
      model: "opus",
      tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      disallowedTools: ["Agent"],
      permissionMode: "default",
      maxTurns: 25,
      effort: "high",
      color: "blue",
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command:
                  "CMD=$(cat | jq -r '.tool_input.command // empty'); echo \"$CMD\" | grep -qE '(kubectl delete namespace|kubectl delete -f|helm uninstall|kubectl drain.*--force)' && { echo '{\"block\":true,\"message\":\"K8s destructive command blocked\"}' >&2; exit 2; } || exit 0",
                timeout: 5,
              },
            ],
          },
        ],
      },
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- namespace 삭제, force drain 등 파괴적 명령 자동 차단
- 프로덕션 클러스터 변경은 반드시 dry-run 선행
- PodDisruptionBudget 준수
- 리소스 limits/requests 설정 필수

## 역할
[커스터마이즈: 관리 대상 클러스터와 워크로드 종류를 기술]

## 작업 범위
1. Deployment, StatefulSet, DaemonSet 관리
2. ConfigMap, Secret 관리 (민감 정보 주의)
3. Service, Ingress 라우팅
4. HPA, PDB 설정
5. 리소스 쿼터 관리`,
    lockedFields: ["hooks"],
    referenceFiles: ["CLAUDE.md", "docs/k8s-runbook.md"],
  },
  {
    id: "devops-apply",
    name: "DevOps Applier",
    nameKo: "DevOps 적용",
    description: "Can apply infrastructure changes — destroy commands blocked",
    descriptionKo: "인프라 변경 적용 가능, destroy 명령은 차단",
    category: "devops",
    riskLevel: "high",
    costTier: 4,
    frontmatter: {
      description: "DevOps applier — can apply changes, destroy blocked",
      model: "opus",
      tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      disallowedTools: ["Agent"],
      permissionMode: "default",
      maxTurns: 20,
      effort: "high",
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command:
                  "CMD=$(cat | jq -r '.tool_input.command // empty'); echo \"$CMD\" | grep -qE '(terraform destroy|kubectl delete namespace|helm uninstall|docker system prune|rm -rf /)' && { echo '{\"block\":true,\"message\":\"DevOps: destructive commands blocked\"}' >&2; exit 2; } || exit 0",
                timeout: 5,
              },
            ],
          },
        ],
      },
    },
    bodyTemplate: `# {{name}}

## 필수 규칙
- 파괴적 명령 차단: terraform destroy, kubectl delete namespace, helm uninstall
- 적용 전 plan/dry-run 필수 실행
- 변경 전 현재 상태 백업/기록
- 서브에이전트 생성 금지

## 역할
[커스터마이즈: 관리할 인프라와 허용 작업 범위를 기술]

## 작업 절차
1. 현재 인프라 상태 확인
2. 변경 계획 검토 (plan/dry-run)
3. 변경 적용
4. 적용 후 상태 확인
5. 결과 보고`,
    lockedFields: ["model", "hooks", "disallowedTools"],
    referenceFiles: ["CLAUDE.md"],
  },
];
