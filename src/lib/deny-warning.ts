// 위험한 deny 패턴 목록
const DANGEROUS_DENY_PATTERNS = [
  "Edit(*)", "Edit",
  "Write(*)", "Write",
  "Bash(*)", "Bash",
];

/**
 * deny 배열에서 위험 항목 감지
 * @returns 감지된 위험 패턴 목록 (빈 배열이면 안전)
 */
export function detectDangerousDeny(denyList: string[] | undefined): string[] {
  if (!denyList) return [];
  return denyList.filter((item) =>
    DANGEROUS_DENY_PATTERNS.some((p) => {
      if (p.endsWith("(*)")) {
        const prefix = p.slice(0, -2); // "Edit(*)" → "Edit("
        return item === p || item.startsWith(prefix);
      }
      return item === p;
    })
  );
}

/**
 * deny 배열에서 위험 항목만 제거
 */
export function removeDangerousDeny(denyList: string[]): string[] {
  const dangerous = new Set(detectDangerousDeny(denyList));
  return denyList.filter((item) => !dangerous.has(item));
}
