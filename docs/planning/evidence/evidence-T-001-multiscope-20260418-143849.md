# Evidence — T-001 multi-scope round-trip smoke (보충)

> 상태: NEW (Reviewer 대상)
> 유형: evidence
> 상위: `inbox/diff-review-T-001-1-20260418-120931.md`
> 메타: Supervisor 가 stale context 지적 후 현 상태 확인. spec-T-001 본문 파일은 파일시스템에 없으나, diff 본체와 API 회귀 영향은 계속 확인 가능. 이건 그 보충.
> 작성: Implementer (2026-04-18)

---

## 0. 의도

T-001 diff 본체(프론트엔드 기본 scope 변경 + 피드백 + catch) 가 **백엔드 Apply/Undo 경로 3종(project/local/user) 모두에 회귀 영향 없는지** 확인. Playwright/브라우저 증거는 여전히 권한 밖이라 API 레벨 round-trip 으로 대체.

## 1. 실행 결과

### S-A. scope=project (프론트엔드 새 기본값)
```
POST /api/templates/security-basic/apply {scope:"project", projectPath:"/tmp/test-claude-project", mode:"merge"}
→ {"success":true, "scope":"project"}
→ 파일 /tmp/test-claude-project/.claude/settings.json 생성
→ permissions.allow 길이: 9
Undo → success:true
```

### S-B. scope=local
```
POST ...apply {scope:"local", projectPath:"...", mode:"merge"}
→ {"success":true, "scope":"local"}
→ 파일 /tmp/test-claude-project/.claude/settings.local.json 생성
→ permissions.allow 길이: 9
Undo → success:true
```

### S-C. scope=user (projectPath 불필요)
```
POST ...apply {scope:"user", mode:"merge"}
→ {"success":true, "scope":"user"}
→ ~/.claude/settings.json permissions.allow 길이: 9
Undo → success:true
```

→ 3개 scope 모두 apply + 파일 생성/갱신 + undo 성공. 프론트엔드 변경은 백엔드 round-trip 에 회귀 없음.

## 2. 한계 (반복 고지)

- **정식 게이트 4개**는 pre-existing 실패 상태 (`evidence-T-001-gates-20260418-132425.md` 참조). T-001 책임 아님.
- **브라우저 DevTools 실측**은 Implementer 권한/도구 부재 — 사용자/Reviewer 수동 수행 요청.
- **spec-T-001 본문 파일 부재** (find 결과 0건) — Reviewer 가 복원 or 재작성 필요.

## 3. 현 상태

- diff: `src/app/templates/page.tsx` unstaged 유지 (commit 시도 금지 — hook/SPEC 상태)
- state: `pipeline/state/current-task.md` = `blocked-spec-missing`
- T-002/T-003/T-004: 존재하지 않음 (이전 stale context 오류)

## 4. 다음 행동 대기

- Reviewer/Supervisor/사용자 중 하나의 결정:
  - spec-T-001 복원 → T-001 재승인 플로우 재가동
  - T-001 diff 폐기 → `git checkout HEAD -- src/app/templates/page.tsx`
  - pre-existing 게이트 수정 SPEC 제공 → Implementer 순차 처리
