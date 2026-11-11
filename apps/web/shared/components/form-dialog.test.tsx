/**
 * @file form-dialog.test.tsx
 * @description Tests for the shared form modal: visibility, submit paths, cancel and pending lock.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FormDialog, type FormDialogProps } from "@/shared/components/form-dialog";
import { FormField } from "@/shared/components/form-field";
import { expectNoA11yViolations } from "@/shared/testing/expect-accessible";

function setup(props: Partial<FormDialogProps> = {}) {
  const onSubmit = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <FormDialog
      open
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      title="Invite member"
      description="They get access right away."
      {...props}
    >
      <FormField id="email" label="Email">
        {(control) => <input {...control} />}
      </FormField>
    </FormDialog>,
  );
  return { onSubmit, onOpenChange };
}

describe("FormDialog", () => {
  it("renders nothing while closed", () => {
    setup({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a named, described dialog containing the fields", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Invite member" });
    expect(dialog).toHaveAccessibleDescription("They get access right away.");
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "submit");
  });

  it("submits with the button and with Enter inside a field", async () => {
    const { onSubmit } = setup({ submitLabel: "Send invite" });
    await userEvent.click(screen.getByRole("button", { name: "Send invite" }));
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("requests close when cancelled without submitting", async () => {
    const { onOpenChange, onSubmit } = setup({ cancelLabel: "Dismiss" });
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables the buttons while pending and ignores a forced submit", async () => {
    const { onSubmit } = setup({ isPending: true });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    // Enter in a field still triggers the form's submit event; the guard must swallow it.
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("has no WCAG violations while open", async () => {
    setup();
    await expectNoA11yViolations(document.body);
  });
});
