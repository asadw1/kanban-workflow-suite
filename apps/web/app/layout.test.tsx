/**
 * @file layout.test.tsx
 * @description Tests for the root layout: document shell and exported metadata.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout, { metadata } from "@/app/layout";

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
