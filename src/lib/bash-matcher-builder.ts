// Bash matcher builder (R4).
//
// Hook matchers only select *which tool invocations* trigger the hook (e.g.,
// "Bash"). To filter *which Bash command line* should be blocked/audited,
// hook scripts have to pipe `jq -r '.tool_input.command'` into a regex. The
// regex is notoriously hard to hand-write because many typical "dangerous
// Bash" patterns (e.g., `--no-verify`, `--amend`, `rm -rf`, `git push --force`)
// need careful escaping.
//
// This library provides a small catalog of presets plus a user-togglable
// option set. `buildPattern(opts)` produces the final egrep-ready regex
// string; `testPatternAgainst(pattern, input)` lets the UI preview matches
// against arbitrary input commands.

export interface BashBuilderOption {
  key: string;
  label: string;
  default: boolean;
  /**
   * Optional sample command line that *should* match when this option is on.
   * Rendered as a quick-test chip in the UI.
   */
  sample?: string;
}

export interface BashBuilderPreset {
  id: string;
  label: string;
  description: string;
  options: BashBuilderOption[];
  /** Build an ERE-compatible regex string from the current option states. */
  buildPattern: (opts: Record<string, boolean>) => string;
}

export const BASH_BUILDER_PRESETS: BashBuilderPreset[] = [
  {
    id: "git-commit-safe",
    label: "git commit 안전 모드",
    description: "--no-verify / -n / --amend / force push / reset --hard 차단",
    options: [
      {
        key: "no_verify",
        label: "--no-verify / -n 차단",
        default: true,
        sample: "git commit -m 'x' --no-verify",
      },
      {
        key: "amend",
        label: "--amend 차단",
        default: true,
        sample: "git commit --amend",
      },
      {
        key: "force_push",
        label: "git push --force / -f 차단",
        default: true,
        sample: "git push --force origin main",
      },
      {
        key: "reset_hard",
        label: "git reset --hard 차단",
        default: true,
        sample: "git reset --hard HEAD~1",
      },
    ],
    buildPattern: (opts) => {
      const parts: string[] = [];
      if (opts.no_verify) {
        parts.push(String.raw`\-\-no\-verify`);
        parts.push(String.raw`(^|[^a-zA-Z0-9_])-n([[:space:]]|$)`);
      }
      if (opts.amend) parts.push(String.raw`\-\-amend`);
      if (opts.force_push) parts.push(String.raw`push[[:space:]]+(\-\-force|\-f)`);
      if (opts.reset_hard) parts.push(String.raw`reset[[:space:]]+\-\-hard`);
      return parts.length ? parts.join("|") : ".*";
    },
  },
  {
    id: "rm-safe",
    label: "위험한 rm 차단",
    description: "rm -rf, sudo rm 등 파일 대량 삭제 방어",
    options: [
      {
        key: "rm_rf",
        label: "rm -rf 차단",
        default: true,
        sample: "rm -rf /tmp/build",
      },
      {
        key: "sudo_rm",
        label: "sudo rm 차단",
        default: true,
        sample: "sudo rm /etc/hosts",
      },
      {
        key: "rm_root",
        label: "rm / (루트 경로) 차단",
        default: false,
        sample: "rm -rf /",
      },
    ],
    buildPattern: (opts) => {
      const parts: string[] = [];
      if (opts.rm_rf) parts.push(String.raw`rm[[:space:]]+\-[rfRF]+([[:space:]]|$)`);
      if (opts.sudo_rm) parts.push(String.raw`sudo[[:space:]]+rm`);
      if (opts.rm_root) parts.push(String.raw`rm[[:space:]]+(\-[rfRF]+[[:space:]]+)?/([[:space:]]|$)`);
      return parts.length ? parts.join("|") : ".*";
    },
  },
  {
    id: "env-safe",
    label: "환경설정 우회 차단",
    description: "git core.hooksPath 변경, --no-gpg-sign 등",
    options: [
      {
        key: "hooks_path",
        label: "git config core.hooksPath 차단",
        default: true,
        sample: "git config core.hooksPath /dev/null",
      },
      {
        key: "core_editor",
        label: "git config core.editor 차단",
        default: false,
        sample: "git config core.editor vim",
      },
      {
        key: "no_gpg",
        label: "--no-gpg-sign 차단",
        default: false,
        sample: "git commit --no-gpg-sign",
      },
    ],
    buildPattern: (opts) => {
      const parts: string[] = [];
      if (opts.hooks_path) parts.push(String.raw`git[[:space:]]+config.*core\.hooksPath`);
      if (opts.core_editor) parts.push(String.raw`git[[:space:]]+config.*core\.editor`);
      if (opts.no_gpg) parts.push(String.raw`\-\-no\-gpg\-sign`);
      return parts.length ? parts.join("|") : ".*";
    },
  },
];

export function findBuilderPreset(id: string): BashBuilderPreset | null {
  return BASH_BUILDER_PRESETS.find((p) => p.id === id) ?? null;
}

export function buildDefaultOptions(preset: BashBuilderPreset): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const o of preset.options) out[o.key] = o.default;
  return out;
}

/**
 * Convert ERE-ish constructs (POSIX bracket classes) to JS regex equivalents
 * so the preview can actually test. We only replace the common ones used by
 * the preset patterns above. Kept deliberately small and explicit.
 */
function toJsRegexSource(pattern: string): string {
  return pattern.replace(/\[\[:space:\]\]/g, String.raw`\s`);
}

export function testPatternAgainst(pattern: string, input: string): boolean {
  if (!pattern) return false;
  try {
    const re = new RegExp(toJsRegexSource(pattern));
    return re.test(input);
  } catch {
    return false;
  }
}

export function isValidPattern(pattern: string): boolean {
  if (!pattern) return false;
  try {
    new RegExp(toJsRegexSource(pattern));
    return true;
  } catch {
    return false;
  }
}
