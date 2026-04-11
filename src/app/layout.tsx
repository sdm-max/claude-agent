import type { Metadata } from "next";
import ClientLayout from "@/components/client-layout";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Claude Settings Manager",
  description: "Web UI for Claude Code configuration management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={cn("font-sans", geist.variable)}>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
