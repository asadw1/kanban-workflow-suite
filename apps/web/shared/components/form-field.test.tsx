/**
 * @file form-field.test.tsx
 * @description Tests that FormField wires label, hint and error accessibility attributes.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "@/shared/components/form-field";

const renderField = (props: { hint?: string; error?: string } = {}) =>
  render(
    <FormField id="email" label="Email" className="extra" {...props}>
      {(control) => <input {...control} />}
    </FormField>,
  );

describe("FormField", () => {
  it("links the label to the control", () => {
    renderField();
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("describes the control with the hint", () => {
    renderField({ hint: "We never share it." });
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("We never share it.");
  });

  it("marks the control invalid and announces the error, replacing the hint", () => {
    renderField({ hint: "We never share it.", error: "Enter a valid email" });
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a valid email");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email");
    expect(screen.queryByText("We never share it.")).not.toBeInTheDocument();
  });
});
