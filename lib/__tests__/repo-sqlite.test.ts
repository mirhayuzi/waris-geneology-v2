import { createRequire } from "node:module";
import type { DatabaseSync as DatabaseSyncT } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { family } from "./fixture";

const sqliteMock = vi.hoisted(() => ({
  open: vi.fn(),
  reset: () => {},
  closeAll: () => {},
  execError: undefined as Error | undefined,
}));

// Run the real SqliteRepo against Node's built-in SQLite, through a small stand-in for expo-sqlite.
// (loaded with require: Vite does not know the node:sqlite built-in)
vi.mock("expo-sqlite", () => {
  const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: typeof DatabaseSyncT };
  // Simulates Android closing the database under the app: old connections then fail like expo-sqlite does
  const killed = new Set<unknown>();
  sqliteMock.closeAll = () => opened.forEach((o) => killed.add(o));
  const opened: unknown[] = [];
  const files = new Map<string, DatabaseSyncT>();
  const cached = new Map<string, ReturnType<typeof wrap>>();
  const wrap = (db: DatabaseSyncT) => {
    const alive = (method = "prepareAsync") => {
      if (killed.has(api)) throw new Error(`Call to function 'NativeDatabase.${method}' has been rejected.\n→ Caused by: java.lang.NullPointerException`);
    };
    const api = {
      execAsync: async (sql: string) => {
        alive("execAsync");
        if (sqliteMock.execError) throw sqliteMock.execError;
        db.exec(sql);
      },
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
  sqliteMock.reset = () => {
    files.forEach((db) => db.close());
    files.clear();
    cached.clear();
    killed.clear();
    opened.length = 0;
    sqliteMock.open.mockClear();
    sqliteMock.execError = undefined;
  };
  // Like Expo, a normal reopen can return a stale cached handle. A new connection must
  // still reach the same database, including its family records and migration version.
  sqliteMock.open.mockImplementation(async (name: string, o?: { useNewConnection?: boolean }) => {
    if (!o?.useNewConnection && cached.has(name)) return cached.get(name)!;
    let db = files.get(name);
    if (!db) files.set(name, (db = new DatabaseSync(":memory:")));
    const connection = wrap(db);
    if (!o?.useNewConnection) cached.set(name, connection);
    return connection;
  });
  return { openDatabaseAsync: sqliteMock.open };
});

const { SqliteRepo, isClosedDbError } = await import("../repo-sqlite");

beforeEach(() => sqliteMock.reset());

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
    sqliteMock.closeAll();
    const kid = { ...snap.persons[0], id: "nur", givenName: "Nur Farhana", sex: "female" as const };
    await repo.savePerson(kid);
    await repo.saveLink({ id: "mirhayuzi>nur", parentId: "mirhayuzi", childId: "nur", kind: "birth" });
    const after = await repo.load();
    expect(after.persons.length).toBe(snap.persons.length + 1);
    expect(after.links.some((l) => l.childId === "nur")).toBe(true);
  });

  it("recovers a stale cached connection during startup without losing family records", async () => {
    const seed = await SqliteRepo.open();
    await seed.replaceAll(family());
    const before = await seed.load();
    sqliteMock.closeAll();

    const reopened = await SqliteRepo.open();

    expect(await reopened.load()).toEqual(before);
    expect(sqliteMock.open).toHaveBeenLastCalledWith("waris.db", { useNewConnection: true });
  });

  it("runs first-install migrations after recovering a stale initial connection", async () => {
    await sqliteMock.open("waris.db");
    sqliteMock.closeAll();
    const repo = await SqliteRepo.open();
    await repo.replaceAll(family());
    expect((await repo.load()).persons).toHaveLength(family().persons.length);
  });

  it("stops after one fresh-connection retry when startup keeps failing", async () => {
    sqliteMock.execError = new Error("Call to function 'NativeDatabase.execAsync' has been rejected. java.lang.NullPointerException");
    await expect(SqliteRepo.open()).rejects.toThrow("NullPointerException");
    expect(sqliteMock.open).toHaveBeenCalledTimes(2);
  });

  it("does not retry schema errors or classify every native rejection as a closed database", async () => {
    const sqlError = new Error("Call to function 'NativeDatabase.execAsync' has been rejected. near CREATE: syntax error");
    sqliteMock.execError = sqlError;
    await expect(SqliteRepo.open()).rejects.toThrow("syntax error");
    expect(sqliteMock.open).toHaveBeenCalledTimes(1);
    expect(isClosedDbError(sqlError)).toBe(false);
    expect(isClosedDbError(new Error("Cannot use shared object that was already released"))).toBe(true);
  });
});
