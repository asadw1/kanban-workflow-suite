/**
 * @file form-dialog.tsx
 * @description Shared modal for forms (invite member, create workspace, rename). It owns the
 * layout, focus handling and the submit/cancel/pending behaviour; the caller supplies the fields
 * and the submit handler. Presentational: it never runs the mutation itself.
 */
"use client";

import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Props for {@link FormDialog}. */
export interface FormDialogProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Called with the next open state (Escape, overlay click, Cancel). */
  onOpenChange: (open: boolean) => void;
  /** Dialog heading, for example "Invite member". Also the dialog's accessible name. */
  title: string;
  /** Short explanation shown under the heading and used as the accessible description. */
  description: string;
  /** Called when the form is submitted (button or Enter key). Typically `handleSubmit(...)`. */
  onSubmit: () => void;
  /** The form fields, usually `FormField`s. */
  children: ReactNode;
  /** Submit button text; defaults to "Save". */
  submitLabel?: string;
  /** Cancel button text; defaults to "Cancel". */
  cancelLabel?: string;
  /** Disables the controls while the caller's mutation is in flight, preventing double submit. */
  isPending?: boolean;
}

/**
 * Renders a modal containing a form.
 *
 * Using a real `<form>` means Enter submits from any field and assistive technology announces a
 * form region. Radix traps focus inside while open and restores it to the trigger on close.
 *
 * @param props - See {@link FormDialogProps}.
 * @returns The dialog element.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  children,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  isPending = false,
}: FormDialogProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // Stop the browser's native navigation; the caller validates and submits through JS.
    event.preventDefault();
    if (!isPending) onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          {children}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button type="submit" disabled={isPending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
