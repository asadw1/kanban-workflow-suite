/**
 * @file initials.ts
 * @description Display formatter that turns a person's name into avatar initials. Formatting for
 * display is the only value transformation the frontend is allowed to do (see CLAUDE.md).
 */

/**
 * Builds up to two uppercase initials from a display name: the first letter of the first and
 * last words. A single word yields one letter, and blank input yields "?" so an avatar never
 * renders empty.
 *
 * @param name - The person's display name (may contain extra whitespace).
 * @returns One or two uppercase characters, or "?" when the name has no letters.
 */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (first === undefined) return "?";
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return (firstCharacter(first) + (last === undefined ? "" : firstCharacter(last))).toUpperCase();
}

/**
 * Returns the first user-perceived character of a non-empty word. `Array.from` iterates by code
 * point, so surrogate pairs (astral letters) are not split in half like indexing by code unit.
 */
function firstCharacter(word: string): string {
  return Array.from(word)[0] as string;
}
