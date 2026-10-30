import type { FamilySnapshot, ParentLink, Person, Union } from "./model";

/**
 * Storage interface. The app uses SQLite on the phone (repo-sqlite.ts);
 * tests and the web preview use the in-memory version below.
 */
export interface Repo {
  load(): Promise<FamilySnapshot>;
  savePerson(p: Person): Promise<void>;
  /** Removes the person and every link and marriage that involves them. */
  deletePerson(id: string): Promise<void>;
  saveUnion(u: Union): Promise<void>;
  deleteUnion(id: string): Promise<void>;
  saveLink(l: ParentLink): Promise<void>;
  deleteLink(id: string): Promise<void>;
  getMeta(key: string): Promise<string | undefined>;
  setMeta(key: string, value: string | undefined): Promise<void>;
  /** Replaces everything (restore from backup) in one transaction. */
  replaceAll(s: FamilySnapshot): Promise<void>;
}

export const META = {
  familyName: "family_name",
  homePerson: "home_person",
  language: "language",
  treeUp: "tree_up",
  treeDown: "tree_down",
  treeAdd: "tree_add",
  legacyImported: "legacy_imported",
  /** Edits since the last backup, when that was, and until when "Later" hides the reminder */
  changesSinceBackup: "changes_since_backup",
  lastBackup: "last_backup",
  backupSnooze: "backup_snooze",
  /** "1" while the tree is being drawn; still "1" at the next launch means drawing crashed */
  treeDrawing: "tree_drawing",
  /** JSON map: kind-of-link key -> the user's own term (e.g. "makcik ipar") */
  customTerms: "custom_terms",
  /** JSON list of pairKey()s the user said are different people */
  notDuplicates: "not_duplicates",
} as const;

export class MemoryRepo implements Repo {
  private persons = new Map<string, Person>();
  private unions = new Map<string, Union>();
  private links = new Map<string, ParentLink>();
  private meta = new Map<string, string>();

  async load(): Promise<FamilySnapshot> {
    return {
      persons: [...this.persons.values()].map((p) => ({ ...p })),
      unions: [...this.unions.values()].map((u) => ({ ...u })),
      links: [...this.links.values()].map((l) => ({ ...l })),
      familyName: this.meta.get(META.familyName) ?? "",
      homePersonId: this.meta.get(META.homePerson),
    };
  }
  async savePerson(p: Person) {
    this.persons.set(p.id, { ...p });
  }
  async deletePerson(id: string) {
    this.persons.delete(id);
    for (const [k, u] of this.unions) if (u.partnerA === id || u.partnerB === id) this.unions.delete(k);
    for (const [k, l] of this.links) if (l.parentId === id || l.childId === id) this.links.delete(k);
    if (this.meta.get(META.homePerson) === id) this.meta.delete(META.homePerson);
  }
  async saveUnion(u: Union) {
    this.unions.set(u.id, { ...u });
  }
  async deleteUnion(id: string) {
    this.unions.delete(id);
  }
  async saveLink(l: ParentLink) {
    for (const [k, other] of this.links) if (k !== l.id && other.parentId === l.parentId && other.childId === l.childId) this.links.delete(k);
    this.links.set(l.id, { ...l });
  }
  async deleteLink(id: string) {
    this.links.delete(id);
  }
  async getMeta(key: string) {
    return this.meta.get(key);
  }
  async setMeta(key: string, value: string | undefined) {
    if (value === undefined) this.meta.delete(key);
    else this.meta.set(key, value);
  }
  async replaceAll(s: FamilySnapshot) {
    this.persons = new Map(s.persons.map((p) => [p.id, { ...p }]));
    this.unions = new Map(s.unions.map((u) => [u.id, { ...u }]));
    this.links = new Map(s.links.map((l) => [l.id, { ...l }]));
    await this.setMeta(META.familyName, s.familyName || undefined);
    await this.setMeta(META.homePerson, s.homePersonId);
  }
}
