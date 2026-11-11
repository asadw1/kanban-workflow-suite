/**
 * @file form-field.tsx
 * @description Label, hint and error layout for one form control, wiring the accessibility
 * attributes (`htmlFor`, `aria-invalid`, `aria-describedby`) so every form is announced
 * correctly. It is library-agnostic: React Hook Form supplies the error string, this component
 * only presents it.
 */
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/shared/utils/cn";

/** Attributes the control must spread so it is labelled and linked to its hint and error. */
export interface FormFieldControlProps {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
}

/** Props for {@link FormField}. */
export interface FormFieldProps {
  /** Unique id for the control; also the base for the hint and error element ids. */
  id: string;
  /** Visible label text. */
  label: string;
  /** Optional helper text shown under the control. */
  hint?: string;
  /** Validation message; when set the control is marked invalid and the message is announced. */
  error?: string;
  /** Render prop receiving the attributes to spread onto the input, select, etc. */
  children: (control: FormFieldControlProps) => ReactNode;
  /** Extra classes for layout adjustments by the caller. */
  className?: string;
}

/**
 * Renders a labelled form control with optional hint and error text.
 *
 * @param props - See {@link FormFieldProps}.
 * @returns The field element.
 */
export function FormField({ id, label, hint, error, children, className }: FormFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // Error takes precedence for assistive tech; the hint stays referenced when there is no error.
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
