import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TtlCache } from "../../../src/core/cache/ttl-cache";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TtlCache", () => {
  it("returns undefined for a key that was never set", () => {
    const cache = new TtlCache<string>(1000);
    expect(cache.get("a")).toBeUndefined();
  });

  it("returns the value while it is within its TTL", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("a", "value");
    vi.advanceTimersByTime(999);
    expect(cache.get("a")).toBe("value");
  });

  it("expires the value once the TTL has elapsed", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("a", "value");
    vi.advanceTimersByTime(1001);
    expect(cache.get("a")).toBeUndefined();
  });

  it("invalidates a single key", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.invalidate("a");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("2");
  });

  it("clears every key", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
  });

  it("supports a per-call TTL override", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("a", "value", 5000);
    vi.advanceTimersByTime(2000);
    expect(cache.get("a")).toBe("value");
  });
});
