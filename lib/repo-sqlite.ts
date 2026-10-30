import * as SQLite from "expo-sqlite";
import type { FamilySnapshot, ParentLink, Person, Union } from "./model";
import { META, type Repo } from "./repo";

type Db = SQLite.SQLiteDatabase;

/** Schema migrations, applied in order. PRAGMA user_version records how many ran. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE person (
    id TEXT PRIMARY KEY NOT NULL,
    given_name TEXT NOT NULL,
    prefix TEXT,
    father_name TEXT,
    surname TEXT,
    nickname TEXT,
    sex TEXT NOT NULL CHECK (sex IN ('male','female')),
    living INTEGER NOT NULL DEFAULT 1,
    birth_date TEXT,
    birth_place TEXT,
    death_date TEXT,
    death_place TEXT,
    burial_place TEXT,
    religion TEXT,
    ethnicity TEXT,
    occupation TEXT,
    phone TEXT,
    photo TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE family_union (
    id TEXT PRIMARY KEY NOT NULL,
    partner_a TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    partner_b TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'married' CHECK (status IN ('married','divorced','widowed')),
    start_date TEXT,
    end_date TEXT,
    place TEXT,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    CHECK (partner_a <> partner_b)
  );
  CREATE INDEX idx_union_a ON family_union(partner_a);
  CREATE INDEX idx_union_b ON family_union(partner_b);
  CREATE TABLE parent_child (
    id TEXT PRIMARY KEY NOT NULL,
    parent_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    child_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'birth' CHECK (kind IN ('birth','adopted','step','foster','milk')),
    UNIQUE (parent_id, child_id),
    CHECK (parent_id <> child_id)
  );
  CREATE INDEX idx_pc_child ON parent_child(child_id);
  CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT);
  `,
];

async function migrate(db: Db) {
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(sql);
      await tx.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
    version++;
  }
}

const n = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined || v === "" ? undefined : v);

interface PersonRow {
  id: string;
  given_name: string;
  prefix: string | null;
  father_name: string | null;
  surname: string | null;
  nickname: string | null;
  sex: "male" | "female";
  living: number;
  birth_date: string | null;
  birth_place: string | null;
  death_date: string | null;
  death_place: string | null;
  burial_place: string | null;
  religion: string | null;
  ethnicity: string | null;
  occupation: string | null;
  phone: string | null;
  photo: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const toPerson = (r: PersonRow): Person => ({
  id: r.id,
  givenName: r.given_name,
  prefix: n(r.prefix),
  fatherName: n(r.father_name),
  surname: n(r.surname),
  nickname: n(r.nickname),
  sex: r.sex,
  living: r.living === 1,
  birthDate: n(r.birth_date),
  birthPlace: n(r.birth_place),
  deathDate: n(r.death_date),
  deathPlace: n(r.death_place),
  burialPlace: n(r.burial_place),
  religion: n(r.religion),
  ethnicity: n(r.ethnicity),
  occupation: n(r.occupation),
  phone: n(r.phone),
  photo: n(r.photo),
  notes: n(r.notes),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/**
 * Insert, or update in place. Never use INSERT OR REPLACE here: SQLite does that by deleting
 * the old row, and ON DELETE CASCADE then wipes the person's marriages and parent links.
 */
function upsertSql(table: string, cols: string[]): string {
  const sets = cols
    .filter((c) => c !== "id")
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");
  return `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(",")})
  ON CONFLICT(id) DO UPDATE SET ${sets}`;
}

const PERSON_SQL = upsertSql("person", [
  "id",
  "given_name",
  "prefix",
  "father_name",
  "surname",
  "nickname",
  "sex",
  "living",
  "birth_date",
  "birth_place",
  "death_date",
  "death_place",
  "burial_place",
  "religion",
  "ethnicity",
  "occupation",
  "phone",
  "photo",
  "notes",
  "created_at",
  "updated_at",
]);
const personParams = (p: Person) => [
  p.id,
  p.givenName,
  p.prefix ?? null,
  p.fatherName ?? null,
  p.surname ?? null,
  p.nickname ?? null,
  p.sex,
  p.living ? 1 : 0,
  p.birthDate ?? null,
  p.birthPlace ?? null,
  p.deathDate ?? null,
  p.deathPlace ?? null,
  p.burialPlace ?? null,
  p.religion ?? null,
  p.ethnicity ?? null,
  p.occupation ?? null,
  p.phone ?? null,
  p.photo ?? null,
  p.notes ?? null,
  p.createdAt,
  p.updatedAt,
];

const UNION_SQL = upsertSql("family_union", ["id", "partner_a", "partner_b", "status", "start_date", "end_date", "place", "notes", "sort_order"]);
const unionParams = (u: Union) => [
  u.id,
  u.partnerA,
  u.partnerB,
  u.status,
  u.startDate ?? null,
  u.endDate ?? null,
  u.place ?? null,
  u.notes ?? null,
  u.sortOrder,
];

const LINK_SQL = `INSERT INTO parent_child (id, parent_id, child_id, kind) VALUES (?,?,?,?)
  ON CONFLICT(parent_id, child_id) DO UPDATE SET kind = excluded.kind`;

/**
 * Android can close the database under the app (e.g. when the phone is low on memory and
 * the app was in the background behind the camera or gallery). Every later call then fails
 * with "NativeDatabase.prepareAsync has been rejected ... NullPointerException". When that
 * happens we open the database again and retry once; the data on disk is untouched.
 */
export function isClosedDbError(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e);
  return /NullPointerException|database is closed|has been closed|Access to closed resource|NativeDatabase\.\w+' has been rejected/i.test(msg);
}

export class SqliteRepo implements Repo {
  private db: Db;
  private reopening?: Promise<void>;

  private constructor(
    db: Db,
    private name: string,
  ) {
    this.db = this.guard(db);
  }

  static async open(name = "waris.db"): Promise<SqliteRepo> {
    const db = await SQLite.openDatabaseAsync(name);
    await migrate(db);
    return new SqliteRepo(db, name);
  }

  /** Wraps the database so each call reopens it and retries once if Android closed it. */
  private guard(raw: Db): Db {
    let current = raw;
    const reopen = async (failed: Db) => {
      if (current !== failed) return; // someone already reopened it
      this.reopening ??= (async () => {
        const fresh = await SQLite.openDatabaseAsync(this.name, { useNewConnection: true });
        await fresh.execAsync("PRAGMA foreign_keys = ON;");
        current = fresh;
      })().finally(() => (this.reopening = undefined));
      await this.reopening;
    };
    return new Proxy(raw, {
      get: (_t, prop) => {
        const value = (current as unknown as Record<PropertyKey, unknown>)[prop];
        if (typeof value !== "function") return value;
        return async (...args: unknown[]) => {
          const used = current;
          try {
            return await (used as unknown as Record<PropertyKey, (...a: unknown[]) => Promise<unknown>>)[prop](...args);
          } catch (e) {
            if (!isClosedDbError(e)) throw e;
            await reopen(used);
            return (current as unknown as Record<PropertyKey, (...a: unknown[]) => Promise<unknown>>)[prop](...args);
          }
        };
      },
    }) as Db;
  }

  async load(): Promise<FamilySnapshot> {
    const persons = (await this.db.getAllAsync<PersonRow>("SELECT * FROM person")).map(toPerson);
    const unions = (
      await this.db.getAllAsync<{
        id: string;
        partner_a: string;
        partner_b: string;
        status: Union["status"];
        start_date: string | null;
        end_date: string | null;
        place: string | null;
        notes: string | null;
        sort_order: number;
      }>("SELECT * FROM family_union")
    ).map((r) => ({
      id: r.id,
      partnerA: r.partner_a,
      partnerB: r.partner_b,
      status: r.status,
      startDate: n(r.start_date),
      endDate: n(r.end_date),
      place: n(r.place),
      notes: n(r.notes),
      sortOrder: r.sort_order,
    }));
    const links = (await this.db.getAllAsync<{ id: string; parent_id: string; child_id: string; kind: ParentLink["kind"] }>("SELECT * FROM parent_child")).map(
      (r) => ({ id: r.id, parentId: r.parent_id, childId: r.child_id, kind: r.kind }),
    );
    return {
      persons,
      unions,
      links,
      familyName: (await this.getMeta(META.familyName)) ?? "",
      homePersonId: await this.getMeta(META.homePerson),
    };
  }

  async savePerson(p: Person) {
    await this.db.runAsync(PERSON_SQL, personParams(p));
  }

  async deletePerson(id: string) {
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync("DELETE FROM parent_child WHERE parent_id = ? OR child_id = ?", [id, id]);
      await tx.runAsync("DELETE FROM family_union WHERE partner_a = ? OR partner_b = ?", [id, id]);
      await tx.runAsync("DELETE FROM person WHERE id = ?", [id]);
      await tx.runAsync("DELETE FROM meta WHERE key = ? AND value = ?", [META.homePerson, id]);
    });
  }

  async saveUnion(u: Union) {
    await this.db.runAsync(UNION_SQL, unionParams(u));
  }

  async deleteUnion(id: string) {
    await this.db.runAsync("DELETE FROM family_union WHERE id = ?", [id]);
  }

  async saveLink(l: ParentLink) {
    await this.db.runAsync(LINK_SQL, [l.id, l.parentId, l.childId, l.kind]);
  }

  async deleteLink(id: string) {
    await this.db.runAsync("DELETE FROM parent_child WHERE id = ?", [id]);
  }

  async getMeta(key: string) {
    const row = await this.db.getFirstAsync<{ value: string | null }>("SELECT value FROM meta WHERE key = ?", [key]);
    return n(row?.value);
  }

  async setMeta(key: string, value: string | undefined) {
    if (value === undefined) await this.db.runAsync("DELETE FROM meta WHERE key = ?", [key]);
    else await this.db.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", [key, value]);
  }

  async replaceAll(s: FamilySnapshot) {
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync("DELETE FROM parent_child; DELETE FROM family_union; DELETE FROM person;");
      for (const p of s.persons) await tx.runAsync(PERSON_SQL, personParams(p));
      for (const u of s.unions) await tx.runAsync(UNION_SQL, unionParams(u));
      for (const l of s.links) await tx.runAsync(LINK_SQL, [l.id, l.parentId, l.childId, l.kind]);
      await tx.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", [META.familyName, s.familyName ?? ""]);
      if (s.homePersonId) await tx.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", [META.homePerson, s.homePersonId]);
      else await tx.runAsync("DELETE FROM meta WHERE key = ?", [META.homePerson]);
    });
  }
}
