# 테스트 지시서 — 디스크 직접 일원화 (2026-04-14)

## 사전 준비
1. `npm run dev` 로 dev 서버 기동 (포트 3000)
2. 터미널 2개 준비 — 하나는 브라우저 조작용, 하나는 외부에서 파일 조작용
3. 테스트 프로젝트: `test-ref-agent` (path `/Users/min/Documents/test-ref-agent`)
   - 없으면 `/projects` 에서 새로 등록
4. DB 확인용: `sqlite3 /Users/min/Documents/claude-agent/data/claude-agent-manager.db`

## 핵심 검증 포인트
- **단일 출처**: 모든 파일 탭이 디스크를 직접 읽고 쓴다
- **자동 반영**: 외부에서 파일 변경 시 SSE 로 UI 즉시 갱신
- **버전 스냅샷**: 저장 직전 내용이 `file_versions` 테이블에 자동 기록
- **Import/Export 버튼 없음**: 어디에도 남아 있으면 안 됨

---

## 시나리오 1 — Overview 탭 디스크 스캔
1. `test-ref-agent` 의 `.claude/` 외 모든 파일 삭제: `rm -f /Users/min/Documents/test-ref-agent/CLAUDE.md /Users/min/Documents/test-ref-agent/CLAUDE.local.md`
2. 브라우저에서 프로젝트 상세 → Overview 탭 진입
3. **확인**: "Config Files (0)" 표시, 빈 목록 안내
4. 터미널: `echo "# memory" > /Users/min/Documents/test-ref-agent/CLAUDE.md`
5. Overview 탭에서 **다른 탭 갔다 다시 진입** (현재는 Overview 자체 SSE 미적용)
6. **확인**: "Config Files (1)", `claude-md` / `project` / `CLAUDE.md` 행 표시

---

## 시나리오 2 — CLAUDE.md 탭 SSE 자동 반영
1. CLAUDE.md 탭 → Project 스코프 선택
2. 에디터에 `# memory` 표시 확인
3. 터미널: `echo "# external edit" > /Users/min/Documents/test-ref-agent/CLAUDE.md`
4. **확인 (∼1초 내)**: 에디터 내용이 `# external edit` 로 자동 갱신 (브라우저 새로고침 불필요)
5. **편집 중 보호**: 에디터에 `# editing` 입력 (저장 안 함). 터미널에서 또 외부 변경. **에디터 내용은 그대로 `# editing` 유지** (사용자 작업 손실 방지)
6. Local 스코프로 전환 → 변경사항 있음 다이얼로그 뜨는지 확인 → Cancel

---

## 시나리오 3 — 저장 + 버전 스냅샷
1. CLAUDE.md 탭 Project 스코프
2. 외부 파일 정리: `echo "v1" > /Users/min/Documents/test-ref-agent/CLAUDE.md`
3. 에디터에서 `v2` 로 변경 → Save
4. DB 확인:
   ```
   sqlite3 data/claude-agent-manager.db \
     "SELECT relative_path, content, created_at FROM file_versions WHERE relative_path='CLAUDE.md' ORDER BY created_at DESC LIMIT 3;"
   ```
   **확인**: 최상단에 `v1` 스냅샷 (저장 직전 내용)
5. 디스크 확인: `cat /Users/min/Documents/test-ref-agent/CLAUDE.md` → `v2`
6. 다시 `v3` 로 저장 → DB 에 `v2` 스냅샷 추가됨

---

## 시나리오 4 — Version History 복원
1. 시나리오 3 직후 (스냅샷 ≥ 2 개)
2. CLAUDE.md 탭에서 History 버튼 클릭
3. **확인**: 우측 Sheet 에 시각순 정렬된 버전 목록
4. 첫 번째 항목 (`v2`) 클릭 → 미리보기에 내용 표시
5. "Restore this version" 클릭
6. **확인**: 에디터 내용이 `v2` 로 복원됨, 디스크도 `v2` (`cat` 확인), `v3` 가 새 스냅샷으로 추가됨

---

## 시나리오 5 — 프로젝트 Settings 탭 디스크 직접
1. Settings 탭 → Project 스코프
2. JSON 모드로 전환 → `{"model":"claude-sonnet-4-6"}` 입력 → Save
3. **확인**: `cat /Users/min/Documents/test-ref-agent/.claude/settings.json` 로 동일 내용
4. 외부 변경: `echo '{"model":"claude-opus-4-6"}' > /Users/min/Documents/test-ref-agent/.claude/settings.json`
5. **확인 (∼1초)**: 에디터 자동 갱신
6. Merged 스코프 클릭 → 4개 스코프 (global/user/project/local) 머지 결과 표시 + Read-only 표시
7. **확인**: Import/Export 버튼이 어디에도 없어야 함. Save / Copy to Local 만 존재

---

## 시나리오 6 — Global/User Settings 페이지 SSE
1. 사이드바 → User Settings 페이지
2. 현재 내용 확인
3. 터미널: `echo '{"model":"claude-haiku-4-5"}' > ~/.claude/settings.json`
4. **확인 (∼1초)**: 페이지 자동 갱신
5. **확인**: Import/Export 버튼 없음, Save 만 존재
6. (주의: 본인 실제 설정 덮어쓰지 않게 사전에 백업)

---

## 시나리오 7 — Rules / Agents / Hooks 탭 회귀
1. Rules 탭 진입
2. 외부에서 새 파일: `mkdir -p /Users/min/Documents/test-ref-agent/.claude/rules && echo "test" > /Users/min/Documents/test-ref-agent/.claude/rules/foo.md`
3. **확인 (∼1초)**: Rules 탭 좌측 파일 목록에 `foo.md` 즉시 표시
4. CLAUDE.md (`.claude/CLAUDE.md`) 추가도 Rules 탭 pinned 영역에 즉시 반영되는지 확인
5. Agents / Hooks 탭도 동일하게 외부 추가 후 SSE 반영 확인

---

## 시나리오 8 — 템플릿 적용이 디스크에 직접 쓰는지
1. Templates 페이지 → 아무 템플릿 → Apply, 대상 = `test-ref-agent`, scope = `project`, mode = `merge`
2. **확인**: `cat /Users/min/Documents/test-ref-agent/.claude/settings.json` 에 템플릿 설정이 머지되어 있음
3. DB 확인: `sqlite3 data/claude-agent-manager.db "SELECT relative_path, length(content) FROM file_versions WHERE relative_path LIKE '%settings.json' ORDER BY created_at DESC LIMIT 1;"` → 머지 직전 내용이 스냅샷으로 기록되었는지 확인 (이미 settings.json 이 존재했던 경우)
4. 템플릿 `extraFiles` (CLAUDE.md 류) 가 있다면 디스크에 그대로 생성됐는지 확인

---

## 시나리오 9 — DB 정리 검증
```bash
sqlite3 /Users/min/Documents/claude-agent/data/claude-agent-manager.db ".tables"
```
**확인**: `__drizzle_migrations  file_versions  projects` — `files`, `settings` 테이블이 **없어야** 함

---

## 시나리오 10 — 죽은 라우트 검증
다음 요청이 모두 404 여야 함:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/projects/slU6UiJ0Gmptwv5j2htvt/files
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/projects/slU6UiJ0Gmptwv5j2htvt/import-claudemd -X POST
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/projects/slU6UiJ0Gmptwv5j2htvt/export-claudemd -X POST
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/settings/import -X POST
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/settings/export -X POST
```

---

## 결과 보고 양식
각 시나리오마다 다음 형식으로:
```
시나리오 N — [PASS/FAIL]
- 단계 X 실패: [구체 증상]
- 콘솔/네트워크 에러: [있으면 첨부]
- DB 상태: [필요 시 SELECT 결과]
```
FAIL 1건 이상이면 회귀로 처리하고 즉시 보고.
