import { isLegacyCSV, legacyFromCSV } from "./csv-legacy";
import { convertLegacy, isLegacyData } from "./legacy";
import type { FamilySnapshot, LinkKind, ParentLink, Person, Union, UnionStatus } from "./model";

/**
 * Backup file: one JSON file holding the whole tree and every photo (base64),
 * so it can be restored on a new phone with nothing else.
 */
export interface BackupFile {
  app: "waris";
  version: 2;
  exportedAt: string;
  data: FamilySnapshot;
  /** photo file name -> base64 JPEG/PNG */
  photos: Record<string, string>;
  /** False for the small shared file without photos */
  photosIncluded?: boolean;
  /** True when living people's personal details were left out */
  livingHidden?: boolean;
}

export function buildBackup(data: FamilySnapshot, photos: Record<string, string>, opts: { photosIncluded?: boolean; livingHidden?: boolean } = {}): BackupFile {
  return { app: "waris", version: 2, exportedAt: new Date().toISOString(), data, photos, photosIncluded: opts.photosIncluded ?? true, livingHidden: opts.livingHidden ?? false };
}

export interface ParsedBackup {
  data: FamilySnapshot;
  /** New-format photos: file name -> base64 */
  photos: Record<string, string>;
  /** Old-format photos: person id -> URI or data: URL */
  legacyPhotos: Record<string, string>;
}

const LINK_KINDS: LinkKind[] = ["birth", "adopted", "step", "foster", "milk"];
const STATUSES: UnionStatus[] = ["married", "divorced", "widowed"];
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);

/** Drops anything malformed or pointing at missing people, so a restore can never half-fail. */
export function sanitize(s: FamilySnapshot): FamilySnapshot {
  const now = new Date().toISOString();
  const persons: Person[] = [];
  const ids = new Set<string>();
  for (const raw of s.persons ?? []) {
    const id = str(raw?.id);
    if (!id || ids.has(id)) continue;
    ids.add(id);
    persons.push({
      ...raw,
      id,
      givenName: str(raw.givenName) ?? "?",
      sex: raw.sex === "female" ? "female" : "male",
      living: raw.living !== false,
      createdAt: str(raw.createdAt) ?? now,
      updatedAt: str(raw.updatedAt) ?? now,
    });
  }
  const pairs = new Set<string>();
  const unions: Union[] = [];
  for (const u of s.unions ?? []) {
    if (!str(u?.id) || !ids.has(u.partnerA) || !ids.has(u.partnerB) || u.partnerA === u.partnerB) continue;
    const pair = [u.partnerA, u.partnerB].sort().join("|");
    if (pairs.has(pair)) continue;
    pairs.add(pair);
    unions.push({ ...u, status: STATUSES.includes(u.status) ? u.status : "married", sortOrder: Number(u.sortOrder) || 0 });
  }
  const linkPairs = new Set<string>();
  const links: ParentLink[] = [];
  for (const l of s.links ?? []) {
    if (!str(l?.id) || !ids.has(l.parentId) || !ids.has(l.childId) || l.parentId === l.childId) continue;
    const key = `${l.parentId}|${l.childId}`;
    if (linkPairs.has(key)) continue;
    linkPairs.add(key);
    links.push({ ...l, kind: LINK_KINDS.includes(l.kind) ? l.kind : "birth" });
  }
  return {
    persons,
    unions,
    links,
    familyName: typeof s.familyName === "string" ? s.familyName : "",
    homePersonId: s.homePersonId && ids.has(s.homePersonId) ? s.homePersonId : undefined,
  };
}

/** Reads a backup made by this version, or the old app's JSON backup. Throws on anything else. */
export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("not-json");
  }
  const obj = json as Partial<BackupFile>;
  if (obj && obj.app === "waris" && obj.data) {
    return { data: sanitize(obj.data), photos: obj.photos ?? {}, legacyPhotos: {} };
  }
  // Old app: either the raw FamilyData object or wrapped in { data: ... }
  const legacy = isLegacyData(json) ? json : isLegacyData((json as { data?: unknown })?.data) ? (json as { data: unknown }).data : null;
  if (legacy && isLegacyData(legacy)) {
    const { snapshot, photos } = convertLegacy(legacy);
    return { data: sanitize(snapshot), photos: {}, legacyPhotos: photos };
  }
  throw new Error("unknown-format");
}

/**
 * Reads one or more picked files: a Waris JSON backup, or the old app's CSV files
 * (members.csv plus optionally marriages.csv and parent_child.csv).
 */
export function parseBackupFiles(texts: string[]): ParsedBackup {
  const json = texts.find((t) => /^\s*[{[]/.test(t));
  if (json !== undefined) return parseBackup(json);
  const csv = texts.filter(isLegacyCSV);
  if (!csv.length) throw new Error("unknown-format");
  const { snapshot } = convertLegacy(legacyFromCSV(csv));
  return { data: sanitize(snapshot), photos: {}, legacyPhotos: {} };
}
