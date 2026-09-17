interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

/**
 * A simple in-memory cache where each entry expires after a time-to-live.
 * Used to throttle repeated remote API calls (e.g. listing issues) within
 * a short window, without persisting anything to disk.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  /** @param defaultTtlMs - Default time-to-live for entries, in milliseconds. */
  constructor(private readonly defaultTtlMs: number) {}

  /**
   * Returns the cached value for `key`, or undefined if it was never set
   * or has expired.
   */
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Stores `value` under `key`.
   *
   * @param ttlMs - Overrides the cache's default TTL for this entry.
   */
  set(key: string, value: T, ttlMs: number = this.defaultTtlMs): void {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Removes a single entry, regardless of whether it has expired. */
  invalidate(key: string): void {
    this.entries.delete(key);
  }

  /** Removes every entry. */
  clear(): void {
    this.entries.clear();
  }
}
