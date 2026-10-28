/**
 * @file layout.test.tsx
 * @description Tests for the root layout: document shell and exported metadata.
 */
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import RootLayout, { metadata } from "@/app/layout";

// The provider tree has its own tests; here it is replaced by a transparent stub.
vi.mock("@/shared/components/providers/app-providers", () => ({
  AppProviders: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("RootLayout", () => {
  it("renders an English document wrapping its children", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>child</p>
      </RootLayout>,
    );
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<p>child</p>");
  });

  it("exports a title", () => {
    expect(metadata.title).toBe("Kanban Suite");
  });
});
