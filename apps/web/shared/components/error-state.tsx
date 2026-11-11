/**
 * @file error-state.tsx
 * @description Retryable error panel that understands the API error contract
 * (`{ message, code }`). Presentational: the caller supplies the error and the retry callback.
 */
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";

/** Minimal error shape the panel needs; `ApiError` satisfies it structurally. */
export interface DisplayableError {
  /** Human-readable text, safe to show to the user. */
  message: string;
  /** Stable machine-readable code from the API. */
  code: string;
}

/** Props for {@link ErrorState}. */
export interface ErrorStateProps {
  /** The failure to describe. */
  error: DisplayableError;
  /** Heading override; defaults to a generic "Something went wrong". */
  title?: string;
  /** When provided, a "Try again" button is shown and calls this on click. */
  onRetry?: () => void;
  /** Extra classes for layout adjustments by the caller. */
  className?: string;
}

/**
 * Renders the error panel as an assertive alert so screen readers announce it immediately.
 *
 * @param props - See {@link ErrorStateProps}.
 * @returns The error-state element.
 */
export function ErrorState({
  error,
  title = "Something went wrong",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/40 p-8 text-center",
        className,
      )}
    >
      <h3 className="text-base font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <p className="text-xs text-muted-foreground">Error code: {error.code}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
