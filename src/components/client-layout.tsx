"use client";

import { Suspense } from "react";
import Sidebar from "./sidebar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <Suspense fallback={<nav className="w-56 shrink-0 bg-card border-r border-border p-3" />}>
        <Sidebar />
      </Suspense>
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
