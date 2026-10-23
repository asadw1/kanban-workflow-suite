/**
 * @file layout.tsx
 * @description Root layout for the App Router. Providers (TanStack Query, theme) are added
 * here by later Stage 1 roadmap items.
 */
import type { ReactNode } from "react";
import "./globals.css";

/** Document metadata applied to every route. */
export const metadata = {
  title: "Kanban Suite",
  description: "Collaborative real-time workflow and Kanban suite",
};

/**
 * Root layout wrapping every page.
 *
 * @param props.children - The matched route segment.
 * @returns The HTML document shell.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
