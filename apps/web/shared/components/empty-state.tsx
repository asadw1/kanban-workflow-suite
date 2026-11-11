/**
 * @file empty-state.tsx
 * @description Standard "nothing here yet" panel for any list or board, with an optional call to
 * action. Presentational only.
 */
import type { ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

/** Props for {@link EmptyState}. */
export interface EmptyStateProps {
  /** Short heading, for example "No workspaces yet". */
  title: string;
  /** Optional supporting sentence explaining what to do next. */
  description?: string;
  /** Optional decorative icon; hidden from assistive technology. */
  icon?: ReactNode;
  /** Optional action (usually a Button) rendered below the text. */
  action?: ReactNode;
  /** Extra classes for layout adjustments by the caller. */
  className?: string;
}

/**
 * Renders the empty state.
 *
 * @param props - See {@link EmptyStateProps}.
 * @returns The empty-state element, exposed as a labelled status region.
 */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center",
        className,
      )}
    >
      {icon ? (
        <div aria-hidden="true" className="text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-medium">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}
