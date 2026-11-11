/**
 * @file skeleton.tsx
 * @description shadcn/ui `skeleton` primitive (generated via the shadcn CLI, new-york style). Presentational
 * only: no data fetching or business rules. Excluded from coverage as vendored third-party code.
 */
import { cn } from "@/shared/utils/cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-accent", className)}
      {...props}
    />
  );
}

export { Skeleton };
