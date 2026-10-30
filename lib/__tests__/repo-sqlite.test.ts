import { createRequire } from "node:module";
import type { DatabaseSync as DatabaseSyncT } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import { family } from "./fixture";

// Run the real SqliteRepo against Node's built-in SQLite, through a small stand-in for expo-sqlite.
// (loaded with require: Vite does not know the node:sqlite built-in)
vi.mock("expo-sqlite", () => {
  const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: typeof DatabaseSyncT };
  // Simulates Android closing the database under the app: old connections then fail like expo-sqlite does
  const killed = new Set<unknown>();
  (globalThis as Record<string, unknown>).__closeAllDbs = () => opened.forEach((o) => killed.add(o));
  const opened: unknown[] = [];
  let last: DatabaseSyncT | undefined;
  const wrap = (db: DatabaseSyncT) => {
    const alive = () => {
      if (killed.has(api)) throw new Error("Call to function 'NativeDatabase.prepareAsync' has been rejected.\n→ Caused by: java.lang.NullPointerException");
    };
    const api = {
      execAsync: async (sql: string) => (alive(), db.exec(sql)),
      runAsync: async (sql: string, params: unknown[] = []) => (alive(), db.prepare(sql).run(...(params as never[]))),
      getAllAsync: async (sql: string, params: unknown[] = []) => (alive(), db.prepare(sql).all(...(params as never[]))),
      getFirstAsync: async (sql: string, params: unknown[] = []) => (alive(), db.prepare(sql).get(...(params as never[])) ?? null),
      withExclusiveTransactionAsync: async (fn: (tx: unknown) => Promise<void>) => {
        alive();
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
    opened.push(api);
    return api;
  };
  return {
    // a "new connection" reaches the same database file; otherwise each test gets a fresh one
    openDatabaseAsync: async (_name: string, o?: { useNewConnection?: boolean }) =>
      wrap(o?.useNewConnection && last ? last : (last = new DatabaseSync(":memory:"))),
  };
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

  it("opens the database again when Android has closed it, and the save still works", async () => {
    const repo = await SqliteRepo.open();
    const snap = family();
    await repo.replaceAll(snap);
    (globalThis as unknown as { __closeAllDbs: () => void }).__closeAllDbs();
    const kid = { ...snap.persons[0], id: "nur", givenName: "Nur Farhana", sex: "female" as const };
    await repo.savePerson(kid);
    await repo.saveLink({ id: "mirhayuzi>nur", parentId: "mirhayuzi", childId: "nur", kind: "birth" });
    const after = await repo.load();
    expect(after.persons.length).toBe(snap.persons.length + 1);
    expect(after.links.some((l) => l.childId === "nur")).toBe(true);
  });
});
