/**
 * @file user-avatar.test.tsx
 * @description Tests for the initials fallback and accessible labelling of UserAvatar.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserAvatar } from "@/shared/components/user-avatar";
import { expectNoA11yViolations } from "@/shared/testing/expect-accessible";

describe("UserAvatar", () => {
  it("shows initials and exposes the name as the accessible label", () => {
    render(<UserAvatar name="Ada Lovelace" />);
    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("falls back to initials when an image URL is given but has not loaded", () => {
    render(<UserAvatar name="Grace Hopper" imageUrl="https://example.com/g.png" size="lg" />);
    // jsdom never loads images, so the Radix fallback stays visible.
    expect(screen.getByText("GH")).toBeInTheDocument();
  });

  it("treats a null image URL like a missing one", () => {
    render(<UserAvatar name="Plato" imageUrl={null} className="extra" />);
    expect(screen.getByText("P")).toBeInTheDocument();
  });

  it("has no WCAG violations", async () => {
    const { container } = render(<UserAvatar name="Ada Lovelace" />);
    await expectNoA11yViolations(container);
  });
});
