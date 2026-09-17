/**
 * Compares two state snapshots by structural content rather than
 * reference, so `main.ts` can skip a full re-render when a `state`
 * message repeats data the panel already has (e.g. after regaining
 * focus with a warm cache). Order-sensitive: a reordered list counts as
 * a change, since that is a real visible difference for the user.
 */
export function hasStateChanged<T>(previous: T | null, next: T): boolean {
  if (previous === null) {
    return true;
  }
  if (previous === next) {
    return false;
  }
  return JSON.stringify(previous) !== JSON.stringify(next);
}
