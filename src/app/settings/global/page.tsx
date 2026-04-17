"use client";

import SettingsPage from "@/components/settings-page";

export default function GlobalSettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border bg-blue-500/5">
        <p className="text-xs text-blue-700 dark:text-blue-400">
          <strong>Global scope = managed-settings.json</strong> (enterprise policy).
          Precedence: <code>Managed &gt; Project &gt; User &gt; Local</code>.
          Settings here override user/project/local settings and cannot be disabled by individual users.
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          CLAUDE.md is managed at User scope — Claude Code uses a single user-level memory file.
          For project-specific policy CLAUDE.md, use the Project page.
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <SettingsPage scope="global" title="Global Settings" />
      </div>
    </div>
  );
}
