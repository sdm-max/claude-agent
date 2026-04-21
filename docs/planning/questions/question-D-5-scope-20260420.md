# question-D-5-scope — Undo extraFiles + 렌더 가드 fix sprint

- **요청자**: Implementer
- **생성**: 2026-04-20
- **유형**: question (scope + commit plan)
- **근거**: `.claude/pipeline/inbox/investigation-D-5-20260420.md`

## 제안 Task (3 commits, 2파일 한도 준수)

| Task | 파일 | Sev | 메시지 |
|------|------|-----|-------|
| **D-5.1** | `src/lib/templates/undo-files.ts` (신규) + `src/app/api/templates/applied/[id]/undo/route.ts` | P1 | `fix(undo): D-5.1 — extraFiles 언링크 + shared-path 인지` |
| **D-5.2** | `tests/unit/undo-extra-files.test.ts` (신규) | P1 | `test(undo): D-5.2 — extraFiles 언링크 회귀 (shared-path + scope 격리)` |
| **D-5.3** | `src/app/templates/page.tsx` | P2 | `fix(templates-ui): D-5.3 — settings·extraFiles 체크리스트 가드 분리` |

**합계**: 3 커밋, 각 1-2 파일.

## D-5.1 세부

**대상**: `POST /api/templates/applied/:id/undo` 가 `record.extraFiles` 를 parse · 삭제.

**로직**:
1. Delete 대상 applied row의 `extraFiles` JSON 파싱.
2. 같은 scope + projectId 의 다른 active row(자기 자신 제외) 들의 `extraFiles` 경로 union 집계.
3. 자기 파일 경로 중 union에 없는 것만 unlink (= shared-path 보존).
4. apply 쪽 path guard 재사용: `~` 확장, `..` 금지, 절대경로 금지(sandboxed within scope root).
5. 응답에 `removedFiles: string[]` + `keptSharedFiles: string[]` 추가.
6. 파일 I/O 에러는 수집만 (`{path, error}` 배열) → 500이 아니라 200 + 부분 보고.

**helper `src/lib/templates/undo-files.ts`** 분리 이유:
- 경로 가드 로직 재사용 (apply와 독립 테스트 가능).
- route 파일의 책임 최소화.

## D-5.2 세부

`tests/unit/undo-extra-files.test.ts` 신규, in-memory SQLite fixture (Q-2 패턴). 최소 5 케이스:
1. Single apply → undo → 모든 extraFiles 삭제됨.
2. Two applies with overlapping paths → 둘 다 undo 순서: 첫 undo 는 keep, 둘째 undo는 remove.
3. scope 격리: 다른 scope의 같은 경로는 shared로 취급 안 함.
4. Path guard: apply 시 저장된 경로가 `..` 포함 → undo 시 삭제 시도 안 함(로그만).
5. Non-existent file: apply 후 수동으로 지워진 파일 → ENOENT 무시, 다른 삭제는 계속.

## D-5.3 세부

`src/app/templates/page.tsx:955` 의 체크리스트 블록:
```tsx
{Object.keys(detail.settings).length > 0 && (
  <div>
    {/* settings 체크리스트 */}
    {detail.extraFiles && /* extraFiles 체크리스트 */}
  </div>
)}
```
→ extraFiles 블록을 가드 밖으로 이동. extraFiles-only 템플릿도 체크박스 렌더.

## 수용 조건 (공통)
- lint + test + build + e2e-scenarios ALL PASS
- Guard 0c per-task `outbox/diff-review-D-5.N-*.md` `[x] APPROVED`
- D-5.1 라이브 repro: apply → extraFiles 존재 확인 → undo → 파일 삭제 확인 + shared-path 보존 확인

## 질문
1. 3 task 분할 OK?
2. `undo-files.ts` helper 분리가 과한지 (route에 inline도 가능, 그럼 1파일)?
3. D-5.2 5 케이스 커버리지 충분?
4. D-5.3 P2라 후속 sprint로 미뤄도 되는지, 본 sprint 포함이 깔끔할지?
5. 응답 shape `{removedFiles, keptSharedFiles, errors}` 추가 OK? 기존 `success` 필드 유지?

## 추천
3 task 그대로 (A). helper 분리는 테스트 격리에 유리.
