# 에이전트 거버넌스 기획서

## 배경

Claude Code의 에이전트(서브에이전트)는 각각 독립된 AI다.
현재 앱에서는 에이전트 `.md` 파일의 생성/수정/삭제만 가능하지만,
실제로 에이전트별로 **권한, 도구 접근, 훅, 모델, MCP 서버** 등을 세밀하게 제어해야 한다.

예: 문서 작성 에이전트는 `Write`만 가능, 보안 감사 에이전트는 `Read`만 가능, 
테스트 에이전트는 `Bash`까지 가능하되 production 파일 수정은 차단.

---

## 1. 에이전트별 설정 가능한 필드 (Claude Code 공식)

| 필드 | 타입 | 설명 |
|------|------|------|
| `name` | string (필수) | 에이전트 고유 식별자 |
| `description` | string (필수) | 에이전트가 위임받을 조건 설명 |
| `tools` | string[] | 허용 도구 화이트리스트 (Read, Write, Edit, Bash, Glob, Grep, Agent 등) |
| `disallowedTools` | string[] | 차단 도구 블랙리스트 |
| `model` | string | 사용 모델 (sonnet/opus/haiku/inherit) |
| `permissionMode` | string | 권한 모드 (default/acceptEdits/auto/dontAsk/bypassPermissions/plan) |
| `maxTurns` | number | 최대 턴 수 제한 |
| `hooks` | object | 에이전트 전용 훅 (에이전트 활성 시에만 실행) |
| `mcpServers` | object | 에이전트 전용 MCP 서버 |
| `skills` | string[] | 주입할 스킬 목록 |
| `memory` | string | 영구 메모리 범위 (user/project/local) |
| `background` | boolean | 백그라운드 실행 여부 |
| `effort` | string | 노력 수준 (low/medium/high/max) |
| `isolation` | string | 격리 모드 (worktree) |
| `color` | string | UI 색상 |
| `initialPrompt` | string | 자동 첫 턴 프롬프트 |

---

## 2. 에이전트 역할별 거버넌스 프로필

### 2-1. 읽기 전용 에이전트 (분석/리뷰)

**적용 대상**: code-reviewer, security-auditor, performance-analyzer

```yaml
tools: [Read, Glob, Grep]
disallowedTools: [Write, Edit, Bash, Agent]
permissionMode: plan
maxTurns: 10
effort: high
```

**규칙**:
- 코드 수정 절대 불가
- 파일 생성 불가
- 명령 실행 불가
- 분석 결과만 텍스트로 출력
- 서브에이전트 생성 불가

---

### 2-2. 생성 에이전트 (코드/테스트/문서 작성)

**적용 대상**: test-writer, docs-writer

```yaml
tools: [Read, Write, Glob, Grep, Bash]
disallowedTools: [Agent]
permissionMode: acceptEdits
maxTurns: 20
effort: medium
hooks:
  PreToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: |
            FILE=$(cat | jq -r '.tool_input.file_path // empty')
            echo "$FILE" | grep -qE '\.(env|key|pem|secret)' && \
              echo '{"block":true,"message":"보안 파일 수정 금지"}' >&2 && exit 2 || exit 0
          timeout: 5
```

**규칙**:
- 지정 디렉토리 내 파일만 생성/수정
- .env, 시크릿 파일 접근 차단
- 기존 코드 삭제 금지 (추가만)
- 서브에이전트 생성 불가

---

### 2-3. 실행 에이전트 (빌드/테스트/마이그레이션)

**적용 대상**: test-runner, migration-assistant, ci-runner

```yaml
tools: [Read, Write, Edit, Bash, Glob, Grep]
disallowedTools: [Agent]
permissionMode: auto
maxTurns: 30
effort: high
isolation: worktree
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: |
            CMD=$(cat | jq -r '.tool_input.command // empty')
            echo "$CMD" | grep -qE '(rm -rf|DROP|TRUNCATE|git push --force)' && \
              echo '{"block":true,"message":"파괴적 명령 차단"}' >&2 && exit 2 || exit 0
          timeout: 5
```

**규칙**:
- Worktree 격리 필수 (원본 코드 보호)
- 파괴적 명령 차단 (rm -rf, DROP TABLE, force push)
- 테스트 통과 후에만 변경 적용
- 턴 제한으로 무한 루프 방지

---

### 2-4. 조사 에이전트 (리서치/탐색)

**적용 대상**: researcher, explorer

```yaml
tools: [Read, Glob, Grep, WebFetch, WebSearch]
disallowedTools: [Write, Edit, Bash, Agent]
permissionMode: default
maxTurns: 15
model: haiku
effort: low
background: true
```

**규칙**:
- 읽기 + 웹 검색만 가능
- 파일 수정/생성 불가
- 가벼운 모델로 비용 절감
- 백그라운드 실행으로 메인 작업 방해 없음

---

### 2-5. DevOps 에이전트 (인프라/배포)

**적용 대상**: deployer, infra-manager

```yaml
tools: [Read, Edit, Bash, Glob, Grep]
disallowedTools: [Write, Agent]
permissionMode: default
maxTurns: 20
effort: high
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: |
            CMD=$(cat | jq -r '.tool_input.command // empty')
            echo "$CMD" | grep -qE '(terraform destroy|kubectl delete namespace|docker system prune)' && \
              echo '{"block":true,"message":"파괴적 인프라 명령 차단"}' >&2 && exit 2 || exit 0
          timeout: 5
```

**규칙**:
- 새 파일 생성 불가 (기존 설정만 수정)
- 파괴적 인프라 명령 차단
- 드라이런 우선 (terraform plan, kubectl --dry-run)

---

## 3. 프로젝트 레벨 에이전트 거버넌스 (settings.json)

settings.json에서 프로젝트 전체에 적용되는 에이전트 제어:

```jsonc
{
  // 에이전트 생성 제한 (블랙리스트)
  "permissions": {
    "deny": [
      "Agent(Explore)",           // 특정 에이전트 차단
      "Agent(my-dangerous-agent)"
    ]
  },

  // 에이전트 이벤트 훅
  "hooks": {
    // 서브에이전트 생성 시
    "SubagentStart": [
      {
        "matcher": "",  // 모든 에이전트
        "hooks": [
          {
            "type": "command",
            "command": "COUNT=$(pgrep -f claude | wc -l); [ $COUNT -lt 10 ] || { echo '{\"block\":true,\"message\":\"에이전트 수 제한 초과 (max 10)\"}' >&2; exit 2; }",
            "timeout": 5
          }
        ]
      }
    ],
    // 서브에이전트 종료 시 (정리/로깅)
    "SubagentStop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"[$(date)] Agent stopped\" >> .claude/agent-log.txt",
            "timeout": 5
          }
        ]
      }
    ],
    // 서브에이전트 턴마다 (감시)
    "SubagentTurn": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"[$(date)] Agent turn\" >> .claude/agent-turns.txt",
            "timeout": 3
          }
        ]
      }
    ]
  }
}
```

---

## 4. 구현 계획 — 새 템플릿 카테고리

### 4-1. 기존 `agents` 카테고리 보강

현재 6개 에이전트 정의 → **역할별 거버넌스 프로필이 포함된 에이전트 정의**로 업그레이드

| ID | 에이전트 | 프로필 | 핵심 제한 |
|---|---|---|---|
| agent-code-reviewer | 코드 리뷰어 | 읽기 전용 | Write/Edit/Bash 차단 |
| agent-test-writer | 테스트 작성 | 생성 에이전트 | .env 접근 차단, Agent 차단 |
| agent-security-auditor | 보안 감사 | 읽기 전용 | Write/Edit 차단, Bash(npm audit)만 허용 |
| agent-docs-writer | 문서 작성 | 생성 에이전트 | src/ 수정 차단, docs/만 Write |
| agent-migration | 마이그레이션 | 실행 에이전트 | worktree 격리, 파괴 명령 차단 |
| agent-performance | 성능 분석 | 읽기 전용 | Write 차단, Bash(벤치마크)만 |

### 4-2. 새 템플릿 추가

| ID | 이름 | 프로필 | 설명 |
|---|---|---|---|
| agent-researcher | 리서처 | 조사 에이전트 | 웹검색+코드분석, 수정 불가 |
| agent-deployer | 배포 매니저 | DevOps | terraform/kubectl, 파괴 명령 차단 |
| agent-test-runner | 테스트 러너 | 실행 에이전트 | worktree 격리, 테스트만 실행 |
| agent-refactor | 리팩토링 | 실행 에이전트 | worktree 격리, 테스트 통과 필수 |
| agent-pr-reviewer | PR 리뷰어 | 읽기 전용 | git diff 분석, 코멘트 생성 |
| agent-data-analyst | 데이터 분석 | 조사+생성 | CSV/JSON 읽기, 리포트 생성 |

### 4-3. 새 카테고리: `agent-governance` (에이전트 거버넌스)

프로젝트 레벨 에이전트 제어 설정 템플릿:

| ID | 이름 | 설명 |
|---|---|---|
| gov-subagent-limit | 에이전트 수 제한 | SubagentStart 훅으로 최대 동시 에이전트 제한 |
| gov-subagent-logging | 에이전트 로깅 | SubagentStart/Stop/Turn 전체 로깅 |
| gov-deny-agents | 에이전트 차단 | 특정 에이전트 생성 차단 (permissions.deny) |
| gov-agent-timeout | 에이전트 타임아웃 | maxTurns + 시간 제한으로 폭주 방지 |
| gov-agent-isolation | 에이전트 격리 | 모든 에이전트 worktree 격리 강제 |
| gov-agent-readonly | 에이전트 읽기전용 강제 | 모든 에이전트 Write/Edit 차단 |

---

## 5. UI 구현 계획

### 5-1. 에이전트 편집기 개선 (프로젝트 상세 > Agents 탭)

현재: 마크다운 텍스트 편집기만 있음

개선안:
```
┌─────────────────────────────────────────┐
│ Agents                                   │
├──────────┬──────────────────────────────┤
│ 에이전트  │  [Settings] [Editor] [Hooks] │
│ 목록     │                              │
│          │  ┌─ Settings ──────────────┐ │
│ ▶ code-  │  │ Model:    [Sonnet ▼]    │ │
│   reviewer│  │ Mode:     [plan ▼]      │ │
│ ▶ test-  │  │ MaxTurns: [10    ]      │ │
│   writer │  │ Effort:   [high ▼]      │ │
│ ▶ docs-  │  │ Isolation:[worktree ▼]  │ │
│   writer │  │ Memory:   [project ▼]   │ │
│          │  │ Background: [○]          │ │
│ [+ New]  │  │                          │ │
│          │  │ ── Tools ──              │ │
│          │  │ ☑ Read  ☑ Glob ☑ Grep   │ │
│          │  │ ☐ Write ☐ Edit ☐ Bash   │ │
│          │  │ ☐ Agent ☐ WebFetch      │ │
│          │  │                          │ │
│          │  │ ── Disallowed ──         │ │
│          │  │ ☐ Write ☐ Agent          │ │
│          │  └─────────────────────────┘ │
├──────────┴──────────────────────────────┤
│ [Apply from Template ▼]  [Save]         │
└─────────────────────────────────────────┘
```

### 5-2. 에이전트별 훅 편집기

```
┌─ Hooks (code-reviewer 전용) ────────────┐
│                                          │
│ PreToolUse                               │
│ ┌──────────────────────────────────────┐│
│ │ matcher: Bash                         ││
│ │ type: command                         ││
│ │ command: [validate-bash.sh          ] ││
│ │ timeout: [5]                          ││
│ └──────────────────────────────────────┘│
│ [+ Add Hook]                             │
│                                          │
│ Stop                                     │
│ ┌──────────────────────────────────────┐│
│ │ matcher: (empty)                      ││
│ │ type: command                         ││
│ │ command: [cleanup.sh                ] ││
│ └──────────────────────────────────────┘│
└──────────────────────────────────────────┘
```

---

## 6. 구현 우선순위

### Phase 1: 템플릿 보강 (즉시)
- 기존 6개 에이전트 템플릿에 거버넌스 frontmatter 추가
- 새 에이전트 6개 추가
- `agent-governance` 카테고리 + 6개 템플릿 추가

### Phase 2: 에이전트 편집기 UI (다음)
- 에이전트 설정 폼 (모델/권한/도구/턴 제한)
- 도구 체크박스 선택기
- frontmatter ↔ 폼 양방향 파싱

### Phase 3: 에이전트 훅 편집기 (이후)
- 에이전트별 훅 추가/수정/삭제 UI
- 훅 이벤트 타입 선택
- 명령어 편집 + 테스트

---

## 7. 핵심 원칙

1. **최소 권한 원칙** — 에이전트는 필요한 도구만 허용
2. **격리 우선** — 수정 에이전트는 worktree 격리
3. **감사 추적** — 모든 에이전트 활동 로깅
4. **폭주 방지** — 턴 제한 + 동시 에이전트 수 제한
5. **역할 분리** — 읽기/생성/실행/조사 프로필 명확 구분
