# 에이전트 거버넌스 기획서 v2

## 배경

Claude Code의 에이전트(서브에이전트)는 각각 독립된 AI다.
에이전트별로 **모델, 권한, 도구 접근, 훅, MCP 서버**를 세밀하게 제어해야 한다.

핵심 과제:
- 에이전트 생성 시 **참조문(Reference Template)** 선택으로 거버넌스 자동 적용
- 에이전트별 **모델 설정** (Opus/Sonnet/Haiku 라우팅)
- 에이전트 간 **상호작용 규칙** (누가 누구를 호출 가능한지)
- 프로젝트 레벨 **전체 에이전트 정책** (동시 수 제한, 감사 로깅)

---

## 1. 에이전트 설정 가능 필드 (Claude Code 공식)

에이전트는 `.claude/agents/{name}.md` 파일로 정의. YAML frontmatter:

| 필드 | 타입 | 설명 |
|------|------|------|
| `name` | string **(필수)** | 고유 식별자 |
| `description` | string **(필수)** | 위임 조건 설명 |
| `model` | string | **사용 모델** — `sonnet`, `opus`, `haiku`, `inherit`, 또는 full ID (`claude-opus-4-6`) |
| `tools` | string[] | 허용 도구 화이트리스트 |
| `disallowedTools` | string[] | 차단 도구 블랙리스트 |
| `permissionMode` | string | 권한 모드 (default/acceptEdits/auto/dontAsk/bypassPermissions/plan) |
| `maxTurns` | number | 최대 턴 수 제한 |
| `effort` | string | 노력 수준 (low/medium/high/max) |
| `hooks` | object | 에이전트 전용 훅 (활성 시에만 실행) |
| `mcpServers` | object | 에이전트 전용 MCP 서버 |
| `skills` | string[] | 주입할 스킬 |
| `memory` | string | 영구 메모리 범위 (user/project/local) |
| `background` | boolean | 백그라운드 실행 |
| `isolation` | string | 격리 모드 (worktree) |
| `color` | string | UI 색상 |
| `initialPrompt` | string | 자동 첫 턴 프롬프트 |

---

## 2. 참조문(Reference Template) 시스템

### 2-1. 핵심 개념

에이전트를 새로 만들 때, 빈 스켈레톤 대신 **거버넌스 프로필(참조문)**을 선택하면
frontmatter + 규칙 본문이 자동 채워진다. 이후 자유롭게 커스터마이징 가능.

### 2-2. 데이터 구조

```typescript
// src/lib/agent-references/types.ts

export interface AgentFrontmatter {
  name: string;                    // 생성 시 사용자 입력으로 교체
  description: string;
  model?: string;                  // ★ 에이전트별 모델 설정
  tools?: string[];
  disallowedTools?: string[];
  permissionMode?: string;
  maxTurns?: number;
  effort?: string;
  isolation?: string;
  memory?: string;
  background?: boolean;
  color?: string;
  hooks?: Record<string, unknown>;
  mcpServers?: Record<string, unknown>;
  skills?: string[];
}

export interface GovernanceProfile {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  category: GovernanceCategory;
  riskLevel: "safe" | "moderate" | "elevated" | "high";
  costTier: 1 | 2 | 3 | 4;        // $ ~ $$$$
  frontmatter: AgentFrontmatter;
  bodyTemplate: string;             // 마크다운 본문 템플릿
  companionSettings?: ClaudeSettings; // 프로젝트에 함께 적용할 settings.json
  allowedCallTargets?: string[];    // 호출 가능한 에이전트 패턴
  lockedFields?: (keyof AgentFrontmatter)[]; // 변경 시 경고
}

export type GovernanceCategory =
  | "readonly"      // 읽기 전용
  | "creator"       // 생성
  | "executor"      // 실행
  | "researcher"    // 조사
  | "devops"        // DevOps
  | "orchestrator"; // 오케스트레이터
```

### 2-3. 참조문으로 생성되는 .md 파일 예시

사용자가 "엄격 읽기 전용" 참조문 선택, 이름 `api-reviewer` 입력:

```yaml
---
name: api-reviewer
description: Read-only analysis agent — code review without modifications
model: sonnet
tools: [Read, Glob, Grep]
disallowedTools: [Write, Edit, Bash, Agent]
permissionMode: plan
maxTurns: 10
effort: high
color: blue
---

# API Reviewer

## 필수 규칙
- 파일 수정, 생성, 삭제 절대 금지
- 셸 명령 실행 금지
- 서브에이전트 생성 금지
- 분석 결과만 구조화된 텍스트로 출력

## 역할
[커스터마이즈: 이 에이전트가 리뷰할 대상을 기술]

## 분석 프레임워크
1. Glob/Grep으로 대상 코드 탐색
2. 보안, 성능, 품질 관점에서 분석
3. 심각도별 결과 보고

## 출력 형식
- [CRITICAL] — 머지 전 반드시 수정
- [WARNING] — 수정 권장
- [SUGGESTION] — 개선 제안
```

---

## 3. 거버넌스 프로필 상세 (6카테고리 16개 변형)

### 3-1. 읽기 전용 (readonly)

| ID | 이름 | 모델 | 도구 | 비용 | 위험 |
|---|---|---|---|---|---|
| `readonly-strict` | 엄격 읽기 전용 | sonnet | Read/Glob/Grep | $$ | 🟢 safe |
| `readonly-analysis` | 분석 읽기 전용 | sonnet | +Bash(읽기 명령만) | $$ | 🟢 safe |
| `readonly-web` | 웹 조사 읽기 전용 | haiku | +WebFetch/WebSearch | $ | 🟢 safe |

`readonly-strict`:
```yaml
model: sonnet
tools: [Read, Glob, Grep]
disallowedTools: [Write, Edit, Bash, Agent, WebFetch, WebSearch]
permissionMode: plan
maxTurns: 10
effort: high
```

`readonly-analysis` (Bash 허용하되 분석 명령만):
```yaml
model: sonnet
tools: [Read, Glob, Grep, Bash]
disallowedTools: [Write, Edit, Agent]
permissionMode: plan
maxTurns: 15
effort: high
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: |
            CMD=$(cat | jq -r '.tool_input.command // empty')
            echo "$CMD" | grep -qE '^(npm audit|git log|git diff|git show|wc |head |tail |cat |ls )' || \
              { echo '{"block":true,"message":"Read-only: only analysis commands allowed"}' >&2; exit 2; }
          timeout: 5
```

---

### 3-2. 생성 (creator)

| ID | 이름 | 모델 | 도구 | 비용 | 위험 |
|---|---|---|---|---|---|
| `creator-additive` | 추가 전용 | sonnet | Write만 (Edit 차단) | $$ | 🟡 moderate |
| `creator-scoped` | 범위 제한 | sonnet | Write+Edit (특정 디렉토리만) | $$ | 🟡 moderate |
| `creator-full` | 전체 생성 | sonnet | Write+Edit+Bash | $$$ | 🟠 elevated |

`creator-scoped` (docs-writer 등에 적합):
```yaml
model: sonnet
tools: [Read, Write, Glob, Grep]
disallowedTools: [Bash, Agent]
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
            echo "$FILE" | grep -qE '^\./?(docs|tests|__tests__)/' || \
              { echo '{"block":true,"message":"Scoped: only docs/ and tests/ allowed"}' >&2; exit 2; }
          timeout: 5
```

---

### 3-3. 실행 (executor)

| ID | 이름 | 모델 | 도구 | 비용 | 위험 |
|---|---|---|---|---|---|
| `executor-isolated` | 격리 실행 | opus | 전체 (worktree 격리) | $$$$ | 🟠 elevated |
| `executor-sandboxed` | 샌드박스 실행 | sonnet | 전체 (네트워크/FS 제한) | $$$ | 🟡 moderate |

`executor-isolated`:
```yaml
model: opus
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
            echo "$CMD" | grep -qE '(rm -rf /|DROP DATABASE|TRUNCATE|git push --force|git reset --hard)' && \
              { echo '{"block":true,"message":"Destructive command blocked"}' >&2; exit 2; } || exit 0
          timeout: 5
```

---

### 3-4. 조사 (researcher)

| ID | 이름 | 모델 | 도구 | 비용 | 위험 |
|---|---|---|---|---|---|
| `researcher-light` | 경량 조사 | **haiku** | Read+Web, background | $ | 🟢 safe |
| `researcher-deep` | 심층 조사 | **sonnet** | Read+Web, 포그라운드 | $$ | 🟢 safe |

`researcher-light`:
```yaml
model: haiku
tools: [Read, Glob, Grep, WebFetch, WebSearch]
disallowedTools: [Write, Edit, Bash, Agent]
permissionMode: default
maxTurns: 15
effort: low
background: true
color: cyan
```

---

### 3-5. DevOps

| ID | 이름 | 모델 | 도구 | 비용 | 위험 |
|---|---|---|---|---|---|
| `devops-readonly` | DevOps 조회 | sonnet | terraform plan, kubectl get만 | $$ | 🟡 moderate |
| `devops-apply` | DevOps 적용 | **opus** | terraform apply 허용, destroy 차단 | $$$$ | 🔴 high |

---

### 3-6. 오케스트레이터 (신규)

**기존 기획에 없었던 핵심 역할.** 다른 에이전트를 호출하여 작업을 조율.

| ID | 이름 | 모델 | 도구 | 비용 | 위험 |
|---|---|---|---|---|---|
| `orchestrator-readonly` | 읽기 전용 조율자 | **opus** | Read+Glob+Grep+Agent | $$$$ | 🟡 moderate |
| `orchestrator-full` | 전체 조율자 | **opus** | 전체+Agent | $$$$ | 🔴 high |

`orchestrator-readonly`:
```yaml
model: opus
tools: [Read, Glob, Grep, Agent]
disallowedTools: [Write, Edit, Bash]
permissionMode: default
maxTurns: 50
effort: high
color: purple
```

본문에 위임 규칙 포함:
```markdown
## 위임 규칙
- 코드 리뷰 위임: code-reviewer
- 테스트 작성 위임: test-writer
- 보안 감사 위임: security-auditor
- 위 목록 외 에이전트 호출 금지
- 오케스트레이터 간 재귀 호출 금지
- 결과를 취합하여 통합 리포트 생성
```

---

## 4. 에이전트별 모델 설정 전략

### 4-1. 역할별 기본 모델 매핑

| 역할 | 기본 모델 | 이유 |
|---|---|---|
| 읽기 전용 분석 | **sonnet** | 코드 분석에 충분한 품질, 비용 효율적 |
| 웹 조사 | **haiku** | 단순 검색+요약, 최저 비용 |
| 생성 (코드/문서) | **sonnet** | 코드 생성 품질 균형 |
| 실행 (마이그레이션) | **opus** | 복잡한 판단 필요, 실수 비용 높음 |
| DevOps 적용 | **opus** | 인프라 변경은 정확성 최우선 |
| 오케스트레이터 | **opus** | 다중 에이전트 조율에 고급 추론 필요 |
| 테스트 러너 | **haiku** | 테스트 실행/결과 수집은 단순 |

### 4-2. 모델 선택 UI

에이전트 Settings 탭에서:
```
Model: [Opus ▼] [Sonnet ▼] [Haiku ▼] [Inherit ▼]
        $$$$      $$          $         (세션 모델)

Effort: [low ▼] [medium ▼] [high ▼] [max ▼]
```

참조문 선택 시 모델이 자동 설정되지만, 사용자가 자유롭게 변경 가능.
`lockedFields`에 `model`이 포함된 프로필이면 변경 시 경고.

### 4-3. 프로젝트 레벨 모델 오버라이드 (settings.json)

```jsonc
{
  // 에이전트 이름 → 모델 매핑 (프로젝트 전체 적용)
  "modelOverrides": {
    "code-reviewer": "claude-haiku-4-5-20251001",
    "test-writer": "claude-haiku-4-5-20251001",
    "security-auditor": "claude-opus-4-6",
    "migration-assistant": "claude-opus-4-6"
  }
}
```

**우선순위**: 에이전트 .md의 `model` > settings.json의 `modelOverrides` > 세션 모델

---

## 5. 에이전트 간 상호작용 규칙

### 5-1. 호출 행렬

| 호출자 \ 대상 | readonly | creator | executor | researcher | devops | orchestrator |
|---|---|---|---|---|---|---|
| **readonly** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **creator** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **executor** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **researcher** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **devops** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **orchestrator** | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |

**원칙**: 오케스트레이터만 다른 에이전트 호출 가능. 재귀 호출 차단.

### 5-2. 호출 깊이 제한

SubagentStart 훅으로 최대 깊이 3 강제:
```jsonc
{
  "hooks": {
    "SubagentStart": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "DEPTH=$(cat | jq -r '.depth // 0'); [ $DEPTH -lt 3 ] || { echo '{\"block\":true,\"message\":\"Max agent depth exceeded\"}' >&2; exit 2; }",
        "timeout": 5
      }]
    }]
  }
}
```

---

## 6. 프로젝트 레벨 에이전트 정책 (settings.json)

### 6-1. 동시 에이전트 수 제한
```jsonc
{
  "hooks": {
    "SubagentStart": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "COUNT=$(pgrep -f 'claude.*agent' | wc -l); [ $COUNT -lt 5 ] || { echo '{\"block\":true,\"message\":\"Max 5 concurrent agents\"}' >&2; exit 2; }",
        "timeout": 5
      }]
    }]
  }
}
```

### 6-2. 전체 에이전트 감사 로깅
```jsonc
{
  "hooks": {
    "SubagentStart": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "echo \"[$(date -Iseconds)] START $(cat | jq -r '.agent_name')\" >> .claude/agent-audit.log", "timeout": 3 }]
    }],
    "SubagentStop": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "echo \"[$(date -Iseconds)] STOP $(cat | jq -r '.agent_name')\" >> .claude/agent-audit.log", "timeout": 3 }]
    }],
    "SubagentTurn": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "echo \"[$(date -Iseconds)] TURN $(cat | jq -r '.agent_name') #$(cat | jq -r '.turn_number')\" >> .claude/agent-audit.log", "timeout": 3 }]
    }]
  }
}
```

### 6-3. 특정 에이전트 차단
```jsonc
{
  "permissions": {
    "deny": ["Agent(unsafe-deployer)", "Agent(root-*)"]
  }
}
```

---

## 7. UI/UX 흐름

### 7-1. 에이전트 생성 다이얼로그 (2단계)

**Step 1: 이름 + 참조문 선택**
```
┌─ New Agent ────────────────────────────────┐
│                                             │
│  Agent Name: [________________]             │
│                                             │
│  Governance Profile:                        │
│  ┌───────────────────────────────────────┐  │
│  │ ○ (none) — 빈 템플릿                  │  │
│  │                                        │  │
│  │ ── 읽기 전용 ──────────────────────── │  │
│  │ ○ 엄격 읽기 전용      🟢 $$ sonnet   │  │
│  │ ○ 분석 읽기 전용      🟢 $$ sonnet   │  │
│  │ ○ 웹 조사 읽기 전용   🟢 $  haiku    │  │
│  │                                        │  │
│  │ ── 생성 ───────────────────────────── │  │
│  │ ○ 추가 전용           🟡 $$ sonnet   │  │
│  │ ○ 범위 제한 생성      🟡 $$ sonnet   │  │
│  │ ○ 전체 생성           🟠 $$$ sonnet  │  │
│  │                                        │  │
│  │ ── 실행 ───────────────────────────── │  │
│  │ ○ 격리 실행           🟠 $$$$ opus   │  │
│  │ ○ 샌드박스 실행       🟡 $$$ sonnet  │  │
│  │                                        │  │
│  │ ── 조사 ───────────────────────────── │  │
│  │ ○ 경량 조사           🟢 $  haiku    │  │
│  │ ○ 심층 조사           🟢 $$ sonnet   │  │
│  │                                        │  │
│  │ ── DevOps ────────────────────────── │  │
│  │ ○ DevOps 조회         🟡 $$ sonnet   │  │
│  │ ○ DevOps 적용         🔴 $$$$ opus   │  │
│  │                                        │  │
│  │ ── 오케스트레이터 ────────────────── │  │
│  │ ○ 읽기 전용 조율자    🟡 $$$$ opus   │  │
│  │ ○ 전체 조율자         🔴 $$$$ opus   │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  [Cancel]                      [Next →]     │
└─────────────────────────────────────────────┘
```

**Step 2: 미리보기 + 커스터마이징**
```
┌─ Preview ──────────────────────────────────┐
│                                             │
│  Profile: 엄격 읽기 전용  🟢 Safe  $$ son  │
│                                             │
│  ── Frontmatter ─────────────────────────  │
│  Model:          [Sonnet ▼]           🔒   │
│  Tools:          [Read][Glob][Grep]   🔒   │
│  Disallowed:     [Write][Edit]...     🔒   │
│  PermissionMode: [plan ▼]             🔒   │
│  MaxTurns:       [10    ]                  │
│  Effort:         [high ▼]                  │
│  Memory:         [(none) ▼]                │
│  Color:          [blue ▼]                  │
│                                             │
│  🔒 = 거버넌스 프로필 잠금 (변경 시 경고)    │
│                                             │
│  ── Body Preview ───────────────────────── │
│  ┌───────────────────────────────────────┐ │
│  │ # api-reviewer                        │ │
│  │ ## 필수 규칙                           │ │
│  │ - 파일 수정 금지 ...                   │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  ☐ 프로젝트에 companion settings도 적용     │
│                                             │
│  [← Back]  [Create]                         │
└─────────────────────────────────────────────┘
```

### 7-2. 에이전트 편집기 탭 구조

기존 CodeEditor 대신 4탭 구조:

```
[Settings] [Editor] [Hooks] [Preview]
```

- **Settings**: frontmatter 폼 (모델/권한/도구/턴/effort/격리/메모리)
- **Editor**: 마크다운 본문 (frontmatter 제외)
- **Hooks**: 에이전트 전용 훅 (PreToolUse, PostToolUse 등)
- **Preview**: 최종 .md 미리보기

---

## 8. 파일 구조 계획

```
src/lib/agent-references/
  types.ts              -- GovernanceProfile, AgentFrontmatter 타입
  profiles/
    readonly.ts         -- 읽기 전용 3개
    creator.ts          -- 생성 3개
    executor.ts         -- 실행 2개
    researcher.ts       -- 조사 2개
    devops.ts           -- DevOps 2개
    orchestrator.ts     -- 오케스트레이터 2개
  index.ts              -- 전체 export + lookup
  renderer.ts           -- frontmatter + body -> .md 변환
  parser.ts             -- .md -> frontmatter + body 역파싱
  validator.ts          -- frontmatter 유효성 검사

src/app/api/agent-references/
  route.ts              -- GET 전체 프로필 목록
  [id]/route.ts         -- GET 단일 프로필
  [id]/render/route.ts  -- POST 이름 → .md 생성

src/components/agents/
  CreateAgentDialog.tsx  -- 2단계 생성 다이얼로그
  ProfileSelector.tsx    -- 참조문 라디오 목록
  AgentEditor.tsx        -- 4탭 편집기
  AgentSettingsForm.tsx  -- frontmatter 폼
  AgentToolsSelector.tsx -- 도구 체크박스
  AgentHooksEditor.tsx   -- 에이전트 전용 훅
  AgentPreview.tsx       -- .md 미리보기
```

---

## 9. 구현 우선순위

| Phase | 작업 | 복잡도 |
|---|---|---|
| **1** | 참조문 데이터 + 렌더러/파서 (백엔드) | 중 |
| **2** | 참조문 API 엔드포인트 | 낮 |
| **3** | 에이전트 생성 다이얼로그 (프론트) | 높 |
| **4** | 에이전트 편집기 4탭 UI | 높 |
| **5** | 프로젝트 거버넌스 정책 템플릿 (settings.json용) | 중 |
| **6** | 기존 에이전트 템플릿 보강 (frontmatter + hooks) | 낮 |
| **7** | 검증 로직 (tools 충돌, 정책 정합성) | 중 |
| **8** | 비용 추정 + 에이전트 의존성 그래프 | 중 |

---

## 10. 핵심 원칙

1. **최소 권한** — 에이전트는 필요한 도구만 허용
2. **역할별 모델** — 분석=sonnet, 실행=opus, 조사=haiku
3. **격리 우선** — 수정 에이전트는 worktree 격리
4. **감사 추적** — 모든 에이전트 활동 로깅
5. **폭주 방지** — 턴 제한 + 동시 수 제한 + 깊이 제한
6. **역할 분리** — 오케스트레이터만 다른 에이전트 호출 가능
7. **참조문 기반** — 생성 시 거버넌스가 자동 적용, 실수 방지
