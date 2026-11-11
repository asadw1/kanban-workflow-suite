/**
 * @file error-state.test.tsx
 * @description Tests for the retryable error panel and its API error contract handling.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/services/api-error";
import { ErrorState } from "@/shared/components/error-state";

describe("ErrorState", () => {
  it("announces the message and code from an ApiError", () => {
    render(<ErrorState error={new ApiError(500, "INTERNAL", "Server exploded")} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(alert).toHaveTextContent("Server exploded");
    expect(alert).toHaveTextContent("INTERNAL");
  });

  it("hides the retry button without a handler", () => {
    render(<ErrorState error={{ message: "x", code: "Y" }} title="Custom" className="extra" />);
    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onRetry when Try again is pressed", async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={{ message: "x", code: "Y" }} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
