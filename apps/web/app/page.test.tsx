/**
 * @file page.test.tsx
 * @description Test for the placeholder home page; replaced when the auth redirect lands.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the product name", () => {
    render(<HomePage />);
    expect(screen.getByRole("main")).toHaveTextContent("Kanban Suite");
  });
});
