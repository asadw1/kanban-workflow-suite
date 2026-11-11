/**
 * @file confirm-dialog.test.tsx
 * @description Tests for the shared confirmation dialog: visibility, callbacks and pending lock.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog, type ConfirmDialogProps } from "@/shared/components/confirm-dialog";
import { expectNoA11yViolations } from "@/shared/testing/expect-accessible";

function setup(props: Partial<ConfirmDialogProps> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title="Remove member?"
      description="They lose access immediately."
      {...props}
    />,
  );
  return { onConfirm, onOpenChange };
}

describe("ConfirmDialog", () => {
  it("renders nothing while closed", () => {
    setup({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows title and description with default labels", () => {
    setup();
    expect(screen.getByRole("dialog", { name: "Remove member?" })).toBeInTheDocument();
    expect(screen.getByText("They lose access immediately.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("calls onConfirm when confirmed", async () => {
    const { onConfirm } = setup({ confirmLabel: "Remove", destructive: true });
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("requests close when cancelled", async () => {
    const { onOpenChange, onConfirm } = setup({ cancelLabel: "Keep" });
    await userEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("disables both buttons while pending to prevent double submit", () => {
    setup({ isPending: true });
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("has no WCAG violations while open", async () => {
    setup();
    // The dialog renders in a portal on <body>, outside the render container.
    await expectNoA11yViolations(document.body);
  });
});
