/**
 * @file role-badge.tsx
 * @description Display badge for a workspace role. Presentational only: it reflects the role the
 * server sent and never decides what that role may do.
 */
import type { Role } from "shared-types";
import { Badge } from "@/components/ui/badge";

/** Human label and visual weight per role, keyed by the shared `Role` so new roles fail typecheck. */
const ROLE_PRESENTATION: Record<
  Role,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  OWNER: { label: "Owner", variant: "default" },
  ADMIN: { label: "Admin", variant: "secondary" },
  MEMBER: { label: "Member", variant: "outline" },
  VIEWER: { label: "Viewer", variant: "outline" },
};

/** Props for {@link RoleBadge}. */
export interface RoleBadgeProps {
  /** Role value from a server DTO. */
  role: Role;
  /** Extra classes for layout adjustments by the caller. */
  className?: string;
}

/**
 * Renders a role as a labelled badge.
 *
 * @param props - See {@link RoleBadgeProps}.
 * @returns The badge element.
 */
export function RoleBadge({ role, className }: RoleBadgeProps) {
  const { label, variant } = ROLE_PRESENTATION[role];
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
