/**
 * @file confirm-dialog.tsx
 * @description The single confirmation pattern for destructive or irreversible actions. A
 * controlled shadcn Dialog: the caller owns the open state and performs the action in
 * `onConfirm`. Presentational: it never runs the mutation itself.
 */
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Props for {@link ConfirmDialog}. */
export interface ConfirmDialogProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Called with the next open state (Escape, overlay click, Cancel). */
  onOpenChange: (open: boolean) => void;
  /** Dialog heading, for example "Remove member?". */
  title: string;
  /** Explains the consequence so the user can decide. */
  description: string;
  /** Called when the user confirms. The caller closes the dialog when the mutation settles. */
  onConfirm: () => void;
  /** Confirm button text; defaults to "Confirm". */
  confirmLabel?: string;
  /** Cancel button text; defaults to "Cancel". */
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  destructive?: boolean;
  /** Disables both buttons while the caller's mutation is in flight, preventing double submit. */
  isPending?: boolean;
}

/**
 * Renders the confirmation dialog.
 *
 * @param props - See {@link ConfirmDialogProps}.
 * @returns The dialog element.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  isPending = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={isPending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
