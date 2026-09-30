import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// text-13 is a font size from the theme. Without this, tailwind-merge reads it
// as a text color and drops it next to classes such as text-muted.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['13'] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Two-letter initials for avatars, for example "MO" for Maya Okafor. */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase();
}
