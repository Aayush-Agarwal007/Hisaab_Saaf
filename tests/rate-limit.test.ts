
import { beforeEach, describe, expect, it, vi } from "vitest";

// Reset the module between tests so each test starts with a fresh map.
vi.mock("server-only", () => ({}));

describe("checkRecoveryRateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
  });

  it("allows the first five requests", async () => {
    const { checkRecoveryRateLimit } = await import("../lib/rate-limit");

    for (let i = 0; i < 5; i++) {
      expect(checkRecoveryRateLimit("test-user").allowed).toBe(true);
    }
  });

  it("blocks the sixth request", async () => {
    const { checkRecoveryRateLimit } = await import("../lib/rate-limit");

    for (let i = 0; i < 5; i++) {
      checkRecoveryRateLimit("test-user");
    }

    expect(checkRecoveryRateLimit("test-user").allowed).toBe(false);
  });

  it("tracks different keys independently", async () => {
    const { checkRecoveryRateLimit } = await import("../lib/rate-limit");

    for (let i = 0; i < 5; i++) {
      checkRecoveryRateLimit("user-a");
    }

    expect(checkRecoveryRateLimit("user-a").allowed).toBe(false);
    expect(checkRecoveryRateLimit("user-b").allowed).toBe(true);
  });

  it("allows requests again after the 15-minute window expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T10:00:00Z"));

    const { checkRecoveryRateLimit } = await import("../lib/rate-limit");

    for (let i = 0; i < 5; i++) {
      checkRecoveryRateLimit("test-user");
    }

    expect(checkRecoveryRateLimit("test-user").allowed).toBe(false);

    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(checkRecoveryRateLimit("test-user").allowed).toBe(true);
  });
});
