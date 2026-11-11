/**
 * @file empty-state.test.tsx
 * @description Tests for the empty-state panel's optional parts.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/shared/components/empty-state";
import { expectNoA11yViolations } from "@/shared/testing/expect-accessible";

describe("EmptyState", () => {
  it("renders only the title when nothing else is given", () => {
    render(<EmptyState title="No workspaces yet" />);
    expect(screen.getByRole("status")).toHaveTextContent("No workspaces yet");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders description, icon and action when provided", () => {
    render(
      <EmptyState
        title="No cards"
        description="Create the first card."
        icon={<svg data-testid="icon" />}
        action={<button>Add card</button>}
        className="extra"
      />,
    );
    expect(screen.getByText("Create the first card.")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add card" })).toBeInTheDocument();
  });

  it("has no WCAG violations", async () => {
    const { container } = render(
      <EmptyState title="No cards" description="Create one." action={<button>Add card</button>} />,
    );
    await expectNoA11yViolations(container);
  });
});
