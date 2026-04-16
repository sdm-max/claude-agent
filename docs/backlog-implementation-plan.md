# 백로그 통합 구현 기획서

## 작성일: 2026-04-16
## 기반: 4개 분석 에이전트 결과 통합 (의존관계/DB설계/템플릿시스템/컴포넌트/UX위자드)

---

## 1. 백로그 재구성 (흡수/통합 반영)

| 원래 | 통합 후 | 이유 |
|------|---------|------|
| B-1 | **Phase 1** 그대로 | 인프라 기초 (scope 추상화) |
| B-2 | **B-5에 흡수** | 카탈로그 UI = 위자드 프리셋 목록과 동일 구조 |
| B-3 + B-6 | **Phase 0** 합체 | JSON 설명 작업에 deny 경고 자연 포함 |
| B-4 | **Phase 2** 그대로 | 선택적 Apply + Undo 인프라 |
| B-5 | **Phase 3** (B-2 흡수) | 위자드 + 커스텀 카드 + 카탈로그 통합 |

### 최종 Phase 구조

```
Phase 0 — Settings UX 기초 (독립, 즉시 착수)
  └─ B-3+B-6: JSON 설명 + deny 경고

Phase 1 — Scope 추상화 인프라
  └─ B-1: User Settings 탭 확장 + FileDirectoryEditor apiBase 추상화

Phase 2 — 템플릿 선택 적용 + Undo
  └─ B-4: 선택적 머지 + template_applies 테이블 + Undo

Phase 3 — 위자드 + 커스텀 카드 (B-2+B-5 통합)
  └─ 생성 위자드 + 프리셋 + 커스텀 카드 등록 + 카탈로그 통일
```

---

## 2. 공유 인프라 (여러 Phase에서 필요)

| 인프라 | 필요 Phase | 현재 상태 |
|--------|-----------|----------|
| `FileDirectoryEditor` apiBase prop 추상화 | 1, 3 | 하드코딩 (119줄) |
| `HooksUnifiedEditor` scope 추상화 | 1, 3 | projectId 필수 |
| DB `template_applies` 테이블 | 2 | 없음 |
| DB `custom_templates` 테이블 | 3 | 없음 |
| DB `hook_presets` 테이블 | 3 | 없음 |
| `deepMergeSettings` 선택적 머지 | 2, 3 | 전체 머지만 지원 |
| `writeDiskWithSnapshot` version ID 반환 | 2 | boolean만 반환 |
| Home scope API (`/api/user/*`) | 1 | 없음 |
| 필드별 설명 메타데이터 | 0 | annotate.ts에 133개 키 있음 (활용 가능) |

---

## 3. 신규 DB 테이블 (Drizzle ORM)

### custom_templates (커스텀 카드)
```
id            text PK (nanoid)
name          text NOT NULL
name_ko       text
description   text
description_ko text
category      text NOT NULL (TemplateCategory)
difficulty    integer (1|2|3)
scope         text (global|project|both)
tags          text (JSON string[])
settings      text (JSON ClaudeSettings)
extra_files   text (JSON TemplateFile[])
based_on_template_id  text (원본 빌트인 ID)
created_at    integer
updated_at    integer
```

### template_applies (적용 이력 + Undo)
```
id                text PK (nanoid)
template_type     text (builtin|custom)
template_id       text (빌트인 ID 또는 custom_templates.id)
custom_template_id text FK → custom_templates (nullable)
project_id        text FK → projects (cascade)
scope             text (global|user|project|local)
project_path      text
mode              text (merge|replace)
settings_snapshot text (적용 직전 전체 settings JSON)
extra_file_paths  text (JSON string[])
file_version_ids  text (JSON string[])
applied_at        integer
undone_at         integer (null = 활성)
```

### hook_presets (훅 위자드 프리셋)
```
id              text PK (nanoid)
name            text NOT NULL
name_ko         text
description     text
description_ko  text
event           text (HookEvent)
matcher         text
hook_type       text (command|http|prompt|agent)
hook_config     text (JSON HookEntry)
is_builtin      integer (boolean)
created_at      integer
updated_at      integer
```

---

## 4. Phase 0 — Settings UX 기초 (B-3 + B-6)

### 목표
- Settings Form 모드에서 각 필드에 설명 표시
- deny에 위험 항목 설정 시 경고
- JSON 모드에서 주석 또는 툴팁 지원

### 구현

**4-1. Form 모드 필드 설명** (`settings-form.tsx`)
- 기존 `annotate.ts`의 `KEY_COMMENTS` 맵 활용
- 각 폼 필드 아래에 `<p className="text-xs text-muted-foreground">{설명}</p>` 추가
- permissions.deny 영역에 Edit/Write/Bash 포함 시 빨간 경고 배너

**4-2. JSON 모드 hover 툴팁** (`json-editor.tsx`)
- CodeMirror hover tooltip extension 추가
- JSON 키에 마우스 올리면 `KEY_COMMENTS`에서 설명 표시

**4-3. deny 경고** (`settings-form.tsx`)
- deny 배열에 `Edit(*)`, `Write(*)`, `Bash(*)` 포함 시:
  - 빨간 배너: "이 권한을 차단하면 Claude가 파일 수정을 할 수 없게 됩니다"
  - 리셋 버튼: deny 배열 초기화

### 수정 파일
- `src/components/settings-form.tsx` — 설명 라벨 + deny 경고
- `src/components/json-editor.tsx` — hover 툴팁
- `src/lib/templates/annotate.ts` — KEY_COMMENTS export

### 검증
- [ ] Form 모드에서 각 필드 아래 설명 보임
- [ ] deny에 Edit 추가 시 경고 배너
- [ ] JSON hover 시 툴팁

### 예상 작업량: 1~2일

---

## 5. Phase 1 — Scope 추상화 인프라 (B-1)

### 목표
- User Settings 페이지에서 hooks/rules/agents/CLAUDE.md 탭 지원
- FileDirectoryEditor가 home scope도 지원

### 구현

**5-1. FileDirectoryEditor apiBase 추상화**
- Props에 `apiBase?: string` 추가 (기본값: `/api/projects/${projectId}/${type}`)
- Home scope일 때: `/api/user/${type}` 사용

**5-2. Home scope API 신설**
```
GET/POST/PUT/DELETE /api/user/hooks
GET/POST/PUT/DELETE /api/user/rules
GET/POST/PUT/DELETE /api/user/agents
```
- `~/.claude/hooks/`, `~/.claude/rules/`, `~/.claude/agents/` 디렉토리 대상
- 기존 프로젝트 API와 동일한 인터페이스

**5-3. User Settings 페이지 탭 추가** (`/settings/user`)
- 현재: Settings JSON만
- 추가: CLAUDE.md, Hooks, Rules, Agents 탭
- `HooksUnifiedEditor`에 projectId 대신 scope="user" 지원

**5-4. fs-watcher 확장**
- Home watcher에 hooks/rules/agents 디렉토리 감시 추가
- SSE 이벤트: `user-hooks`, `user-rules`, `user-agents`

### 수정 파일
- `src/components/editors/FileDirectoryEditor.tsx` — apiBase prop
- `src/components/editors/HooksUnifiedEditor.tsx` — scope 추상화
- `src/app/settings/user/page.tsx` — 탭 추가
- `src/app/api/user/hooks/route.ts` — 신규
- `src/app/api/user/rules/route.ts` — 신규
- `src/app/api/user/agents/route.ts` — 신규
- `src/lib/fs-watcher/index.ts` — home watcher 확장
- `src/hooks/use-home-events.ts` — 이벤트 타입 추가

### 검증
- [ ] User Settings → Hooks 탭에서 ~/.claude/hooks/ 파일 CRUD
- [ ] 외부에서 ~/.claude/rules/ 파일 추가 → SSE 반영
- [ ] Home scope에서 FileDirectoryEditor 정상 동작

### 예상 작업량: 3~4일

---

## 6. Phase 2 — 템플릿 선택 적용 + Undo (B-4)

### 목표
- Apply 시 항목별 체크리스트로 선택 적용
- 적용 이력 DB 추적
- Settings에 적용된 템플릿 표시
- 개별 Undo

### 구현

**6-1. 템플릿 sections 구조 추가** (`templates/index.ts`)
```typescript
interface Template {
  // ... 기존 필드
  sections?: {
    sectionId: string;
    name: string;
    nameKo: string;
    settings: Partial<ClaudeSettings>;
    extraFiles?: TemplateFile[];
  }[];
}
```
- 기존 87개 템플릿에 sections 추가 (기존 settings를 논리 블록으로 분리)

**6-2. writeDiskWithSnapshot 반환값 확장**
```typescript
// 현재: { snapshotRecorded: boolean }
// 변경: { snapshotRecorded: boolean; versionId: string | null }
```
- 호출처 6곳 확인 필요

**6-3. template_applies DB + API**
- 스키마 추가 + 마이그레이션
- `POST /api/template-applies` — 이력 조회
- `POST /api/template-applies/{id}/undo` — Undo 실행

**6-4. Apply 다이얼로그 체크리스트 UI** (`templates/page.tsx`)
- Detail Dialog에 sections 체크리스트 표시
- 각 섹션에 이름 + 설명 + 체크박스
- 선택된 섹션만 머지

**6-5. 선택적 머지 API**
```
POST /api/templates/[id]/apply-selective
Body: { scope, projectPath, selectedSections: string[] }
```

**6-6. Settings 페이지에 적용 이력 표시**
- Settings 탭 상단에 "적용된 템플릿" 뱃지 목록
- 각 뱃지에 Undo 버튼
- Undo 제한: 가장 최근 적용만 (충돌 방지)

### 수정 파일
- `src/lib/db/schema.ts` — template_applies 테이블
- `src/lib/disk-files/index.ts` — versionId 반환
- `src/lib/templates/index.ts` — sections 추가
- `src/lib/templates/merge.ts` — 선택적 머지
- `src/app/api/templates/[id]/apply/route.ts` — 이력 저장
- `src/app/api/template-applies/route.ts` — 신규
- `src/app/templates/page.tsx` — 체크리스트 UI
- `src/app/projects/[id]/page.tsx` — 적용 이력 표시

### 검증
- [ ] 체크리스트에서 일부만 선택 → 선택한 것만 적용
- [ ] 적용 후 Settings에 템플릿 출처 뱃지 표시
- [ ] Undo 클릭 → 해당 템플릿 블록만 복원
- [ ] DB에 이력 정상 기록

### 예상 작업량: 3~4일

---

## 7. Phase 3 — 위자드 + 커스텀 카드 (B-2 + B-5 통합)

### 목표
- Hooks/Rules/Agents 생성 위자드 (프리셋 선택 → 옵션 → 한번에 생성)
- 수동 생성한 것을 커스텀 카드로 저장 → 다른 프로젝트 재사용
- .sh 파일에 한글 주석 자동 포함

### 구현

**7-1. 공통 위자드 프레임워크**
```
src/components/wizard/
  CreateWizard.tsx              — 공통 3-step 다이얼로그
  WizardStepIndicator.tsx       — 스텝 표시 (1.선택 → 2.설정 → 3.확인)
  SaveAsTemplateDialog.tsx      — "내 템플릿으로 저장"
```

**7-2. Hooks 위자드** (가장 복잡)
```
src/components/wizard/hooks/
  presets.ts                    — 프리셋 정의 (린트/차단/로그/알림/커스텀)
  HookPresetList.tsx            — Step 1: 프리셋 카드 선택
  HookOptionsForm.tsx           — Step 2: 프리셋별 옵션 폼
  generate-script.ts            — .sh 코드 생성 (한글 주석 포함)
  HookPreview.tsx               — Step 3: 미리보기
```
프리셋:
| ID | 이름 | 이벤트 | 매처 | 옵션 |
|---|---|---|---|---|
| lint-auto | 린트 자동 실행 | PostToolUse | Write\|Edit | 언어 선택 |
| danger-block | 위험 명령 차단 | PreToolUse | Bash | 차단 패턴 |
| exec-log | 실행 로그 기록 | PostToolUse | 전체 | 로그 경로 |
| main-protect | main 브랜치 보호 | PreToolUse | Edit\|Write | 브랜치명 |
| custom | 커스텀 | 선택 | 선택 | 빈 에디터 |

Hooks 전용 통합 API:
```
POST /api/projects/{id}/hooks/wizard
Body: { scriptName, scriptContent, settingsPatch, scope }
→ .sh 파일 생성 + settings.json merge atomic 처리
```

**7-3. Rules 위자드**
```
src/components/wizard/rules/
  presets.ts                    — 코딩스타일/보안/출력형식/Git/한국어/커스텀
  RulePresetList.tsx
  RuleOptionsForm.tsx
  generate-rule.ts              — .md 생성 (한글)
  RulePreview.tsx
```

**7-4. Agents 위자드**
- 기존 `CreateAgentDialog` (2-step) 앞에 프리셋 선택 Step 추가 → 3-step
- 기존 ProfileSelector, AgentPreview 컴포넌트 재사용
```
src/components/wizard/agents/
  AgentPresetList.tsx           — 코드리뷰어/테스트작성자/보안감사자/커스텀
  AgentOptionsForm.tsx
```

**7-5. 커스텀 카드 등록**
- DB: custom_templates + hook_presets 테이블
- API: `/api/custom-templates` CRUD
- 위자드 Step 3에 "내 템플릿으로 저장" 체크박스
- Templates 페이지에 "내 템플릿" 카테고리 추가
- 사이드바에 "내 템플릿" 메뉴 추가

**7-6. 진입점 수정**
- Hooks: HooksUnifiedEditor의 New → "위자드로 만들기" / "빈 파일 만들기" 드롭다운
- Rules: FileDirectoryEditor의 New → 위자드 연결
- Agents: CreateAgentDialog → CreateWizard로 교체 (기존 컴포넌트 재사용)

**7-7. 훅 삭제 연동**
- .sh 파일 삭제 시 → "이 스크립트를 참조하는 Wiring도 삭제하시겠습니까?" 확인

### 수정 파일
- `src/lib/db/schema.ts` — custom_templates, hook_presets 테이블
- `src/components/wizard/` — 신규 디렉토리 전체
- `src/components/editors/HooksUnifiedEditor.tsx` — 위자드 진입점
- `src/components/editors/FileDirectoryEditor.tsx` — 위자드 진입점
- `src/components/agents/AgentEditor.tsx` — 위자드 연결
- `src/components/agents/CreateAgentDialog.tsx` — 확장
- `src/app/api/projects/[id]/hooks/wizard/route.ts` — 신규
- `src/app/api/custom-templates/route.ts` — 신규
- `src/app/api/hook-presets/route.ts` — 신규
- `src/app/templates/page.tsx` — "내 템플릿" 카테고리
- `src/components/sidebar.tsx` — "내 템플릿" 메뉴

### 검증
- [ ] Hooks 위자드: 린트 프리셋 → .sh(한글 주석) + Wiring 한번에 생성
- [ ] Rules 위자드: 코딩스타일 → .md 한번에 생성
- [ ] Agents 위자드: 코드리뷰어 프리셋 → .md 한번에 생성
- [ ] "내 템플릿으로 저장" → DB 저장
- [ ] Templates 페이지 "내 템플릿" → 카드 표시
- [ ] 커스텀 카드 Apply → 다른 프로젝트에 적용
- [ ] .sh 삭제 → Wiring 연동 삭제 확인

### 예상 작업량: 5~7일

---

## 8. 전체 타임라인

```
Phase 0 (1~2일)  ── B-3+B-6: Settings 설명 + deny 경고
    ↓
Phase 1 (3~4일)  ── B-1: Scope 추상화 + User 탭
    ↓
Phase 2 (3~4일)  ── B-4: 선택적 Apply + Undo
    ↓
Phase 3 (5~7일)  ── B-5: 위자드 + 커스텀 카드
```

**총 예상: 12~17일**

각 Phase 완료 시:
1. 코드 구현
2. TypeScript 빌드 확인
3. 브라우저 테스트 (테스터 지시서 제공)
4. 커밋
5. 작업내역서 기재

---

## 9. 병렬화 가능 영역

| 병렬 그룹 | 항목 | 이유 |
|-----------|------|------|
| Phase 0 + Phase 1 DB 설계 | Settings UX + 스키마 작성 | 파일 충돌 없음 |
| Phase 2 DB/API + Phase 2 UI | 백엔드 + 프론트 분리 | 인터페이스 합의 후 병렬 |
| Phase 3 Hooks/Rules/Agents 위자드 | 3개 탭 독립 | 공통 프레임워크 완성 후 |

---

## 10. 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| Undo 충돌 (여러 템플릿 순차 적용 후 중간 것 Undo) | 설정 꼬임 | 최근 것만 Undo 허용 |
| 87개 기존 템플릿에 sections 추가 작업량 | Phase 2 지연 | 주요 카테고리(security, hooks)만 우선 |
| 커스텀 카드 JSON 크기 | DB 비대화 | TEXT 컬럼이므로 실용적 한계 없음 |
| Home scope fs-watcher 확장 | 이벤트 충돌 | 기존 home watcher에 kind 추가만 |
