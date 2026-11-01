import { beforeEach, describe, expect, it, vi } from "vitest";

const open = vi.hoisted(() => vi.fn());
vi.mock("../repo-sqlite", () => ({ SqliteRepo: { open } }));

beforeEach(() => {
  vi.resetModules();
  open.mockReset();
});

describe("openRepo", () => {
  it("shares one initialization across concurrent callers and later remounts", async () => {
    const repo = {};
    open.mockResolvedValue(repo);
    const { openRepo } = await import("../open-repo");
    const first = openRepo();
    expect(openRepo()).toBe(first);
    expect(await first).toBe(repo);
    expect(await openRepo()).toBe(repo);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("allows another startup attempt after initialization fails", async () => {
    const repo = {};
    open.mockRejectedValueOnce(new Error("database unavailable")).mockResolvedValueOnce(repo);
    const { openRepo } = await import("../open-repo");
    await expect(openRepo()).rejects.toThrow("database unavailable");
    expect(await openRepo()).toBe(repo);
    expect(open).toHaveBeenCalledTimes(2);
  });
});
