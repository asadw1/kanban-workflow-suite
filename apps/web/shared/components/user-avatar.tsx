/**
 * @file user-avatar.tsx
 * @description One avatar with an initials fallback, used wherever a person is shown (members,
 * cards, comments, presence). Purely presentational.
 */
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/shared/utils/initials";

/** Props for {@link UserAvatar}. */
export interface UserAvatarProps {
  /** Display name; drives the initials fallback and the accessible label. */
  name: string;
  /** Optional image URL from the API DTO; initials are shown when absent or failing to load. */
  imageUrl?: string | null;
  /** Visual size, mapped to the underlying primitive's size scale. */
  size?: "sm" | "default" | "lg";
  /** Extra classes for layout adjustments by the caller. */
  className?: string;
}

/**
 * Renders a person's avatar.
 *
 * The root carries `role="img"` and an `aria-label` so screen readers announce the person
 * once, instead of reading the decorative initials.
 *
 * @param props - See {@link UserAvatarProps}.
 * @returns The avatar element.
 */
export function UserAvatar({ name, imageUrl, size = "default", className }: UserAvatarProps) {
  return (
    <Avatar size={size} role="img" aria-label={name} className={className}>
      {imageUrl ? <AvatarImage src={imageUrl} alt="" /> : null}
      <AvatarFallback aria-hidden="true">{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
