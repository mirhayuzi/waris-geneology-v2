import { createRequire } from "node:module";
import type { DatabaseSync as DatabaseSyncT } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import { family } from "./fixture";

// Run the real SqliteRepo against Node's built-in SQLite, through a small stand-in for expo-sqlite.
// (loaded with require: Vite does not know the node:sqlite built-in)
vi.mock("expo-sqlite", () => {
  const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: typeof DatabaseSyncT };
  const wrap = (db: DatabaseSyncT) => {
    const api = {
      execAsync: async (sql: string) => db.exec(sql),
      runAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).run(...(params as never[])),
      getAllAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).all(...(params as never[])),
      getFirstAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).get(...(params as never[])) ?? null,
      withExclusiveTransactionAsync: async (fn: (tx: unknown) => Promise<void>) => {
        db.exec("BEGIN");
        try {
          await fn(api);
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
    };
    return api;
  };
  return { openDatabaseAsync: async () => wrap(new DatabaseSync(":memory:")) };
});

const { SqliteRepo } = await import("../repo-sqlite");

describe("SqliteRepo", () => {
  it("keeps a person's spouse, parent and child links when the person is edited", async () => {
    const repo = await SqliteRepo.open();
    const snap = family();
    await repo.replaceAll(snap);
    const before = await repo.load();

    const me = before.persons.find((p) => p.id === "mirhayuzi")!;
    const myLinks = (s: typeof before) => ({
      unions: s.unions.filter((u) => u.partnerA === me.id || u.partnerB === me.id).length,
      links: s.links.filter((l) => l.parentId === me.id || l.childId === me.id).length,
    });
    expect(myLinks(before).unions).toBeGreaterThan(0);
    expect(myLinks(before).links).toBeGreaterThan(0);

    // Adding a photo (or any edit) saves the whole person again
    await repo.savePerson({ ...me, photo: "mirhayuzi.jpg", updatedAt: "2026-10-30T00:00:00.000Z" });
    const after = await repo.load();

    expect(after.persons.find((p) => p.id === me.id)?.photo).toBe("mirhayuzi.jpg");
    expect(myLinks(after)).toEqual(myLinks(before));
    expect(after.links.length).toBe(before.links.length);
    expect(after.unions.length).toBe(before.unions.length);
  });

  it("keeps links when a marriage is edited", async () => {
    const repo = await SqliteRepo.open();
    await repo.replaceAll(family());
    const before = await repo.load();
    await repo.saveUnion({ ...before.unions[0], status: "divorced" });
    const after = await repo.load();
    expect(after.unions.find((u) => u.id === before.unions[0].id)?.status).toBe("divorced");
    expect(after.links.length).toBe(before.links.length);
  });
});
