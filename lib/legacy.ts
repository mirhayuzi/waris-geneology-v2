import { parseStored } from "./dates";
import type { FamilySnapshot, LinkKind, ParentLink, Person, Union } from "./model";

/** Storage key and shape used by the previous version of the app (AsyncStorage JSON). */
export const LEGACY_KEY = "@waris_family_data";

interface LegacyPerson {
  id: string;
  prefix?: string;
  firstName?: string;
  binBinti?: string;
  lastName?: string;
  gender?: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  race?: string;
  religion?: string;
  icNumber?: string;
  photo?: string;
  bio?: string;
  isAlive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LegacyData {
  persons?: LegacyPerson[];
  marriages?: { id: string; husbandId: string; wifeId: string; marriageDate?: string; marriagePlace?: string; divorceDate?: string; isActive?: boolean; notes?: string }[];
  parentChildren?: { id: string; parentId: string; childId: string; type?: string }[];
  rootPersonId?: string;
  familyName?: string;
}

const RELIGION_MAP: Record<string, string> = {
  Islam: "Islam",
  Christianity: "Kristian",
  Buddhism: "Buddha",
  Hinduism: "Hindu",
  Sikhism: "Sikh",
  Others: "Lain-lain",
};

const KIND_MAP: Record<string, LinkKind> = { biological: "birth", adopted: "adopted", susuan: "milk" };

/** Keeps a date only if it is in a format we understand ("1950", "1950-03-02", or an ISO timestamp). */
function cleanDate(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const d = parseStored(v.trim().slice(0, 10));
  if (!d) return undefined;
  return v.trim().slice(0, 10);
}

const s = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export function isLegacyData(value: unknown): value is LegacyData {
  return !!value && typeof value === "object" && Array.isArray((value as LegacyData).persons) && "parentChildren" in (value as object);
}

/**
 * Converts old-format data into the new model.
 * `photos` maps person id -> the old photo URI, so the caller can copy the files.
 */
export function convertLegacy(old: LegacyData): { snapshot: FamilySnapshot; photos: Record<string, string> } {
  const now = new Date().toISOString();
  const photos: Record<string, string> = {};
  const persons: Person[] = [];
  for (const p of old.persons ?? []) {
    if (!p?.id) continue;
    const notes = [s(p.bio), p.icNumber ? `IC: ${p.icNumber}` : undefined].filter(Boolean).join("\n");
    if (p.photo) photos[p.id] = p.photo;
    persons.push({
      id: p.id,
      givenName: s(p.firstName) ?? "?",
      prefix: s(p.prefix),
      fatherName: s(p.binBinti),
      surname: s(p.lastName),
      sex: p.gender === "female" ? "female" : "male",
      living: p.isAlive !== false && !p.deathDate,
      birthDate: cleanDate(p.birthDate),
      birthPlace: s(p.birthPlace),
      deathDate: cleanDate(p.deathDate),
      deathPlace: s(p.deathPlace),
      religion: p.religion ? (RELIGION_MAP[p.religion] ?? p.religion) : undefined,
      ethnicity: s(p.race),
      notes: notes || undefined,
      createdAt: p.createdAt ?? now,
      updatedAt: p.updatedAt ?? now,
    });
  }
  const ids = new Set(persons.map((p) => p.id));

  const unions: Union[] = [];
  const seenPairs = new Set<string>();
  (old.marriages ?? []).forEach((m, i) => {
    if (!ids.has(m.husbandId) || !ids.has(m.wifeId) || m.husbandId === m.wifeId) return;
    const pair = [m.husbandId, m.wifeId].sort().join("|");
    if (seenPairs.has(pair)) return;
    seenPairs.add(pair);
    unions.push({
      id: m.id,
      partnerA: m.husbandId,
      partnerB: m.wifeId,
      status: m.divorceDate || m.isActive === false ? "divorced" : "married",
      startDate: cleanDate(m.marriageDate),
      endDate: cleanDate(m.divorceDate),
      place: s(m.marriagePlace),
      notes: s(m.notes),
      sortOrder: i,
    });
  });

  const links: ParentLink[] = [];
  const seenLinks = new Set<string>();
  for (const l of old.parentChildren ?? []) {
    if (!ids.has(l.parentId) || !ids.has(l.childId) || l.parentId === l.childId) continue;
    const key = `${l.parentId}|${l.childId}`;
    if (seenLinks.has(key)) continue;
    seenLinks.add(key);
    links.push({ id: l.id, parentId: l.parentId, childId: l.childId, kind: KIND_MAP[l.type ?? ""] ?? "birth" });
  }

  return {
    snapshot: {
      persons,
      unions,
      links,
      familyName: s(old.familyName) && old.familyName !== "My Family" ? old.familyName!.trim() : "",
      homePersonId: old.rootPersonId && ids.has(old.rootPersonId) ? old.rootPersonId : undefined,
    },
    photos,
  };
}
