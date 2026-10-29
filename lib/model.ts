/**
 * Core data model. Plain objects so they are easy to store, test and back up.
 *
 * Dates are strings: "1982", "1982-03", "1982-03-12", optionally prefixed with "~"
 * for an approximate date ("~1950"). See lib/dates.ts.
 */

export type Sex = "male" | "female";

/** How a child is connected to a parent. "birth" is the default (biological). */
export type LinkKind = "birth" | "adopted" | "step" | "foster" | "milk";

export type UnionStatus = "married" | "divorced" | "widowed";

export interface Person {
  id: string;
  /** Own name, e.g. "Mirhayuzi" */
  givenName: string;
  /** Title before the name: Haji, Dato', Syed, Dr ... */
  prefix?: string;
  /** Father's name used after bin/binti, e.g. "Mohammad" */
  fatherName?: string;
  /** Family / clan name for families that use one, e.g. "Tan" */
  surname?: string;
  nickname?: string;
  sex: Sex;
  living: boolean;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  burialPlace?: string;
  religion?: string;
  ethnicity?: string;
  occupation?: string;
  phone?: string;
  /** Photo file name inside the app's photos folder (not a full path). */
  photo?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** A couple: marriage (current or past). */
export interface Union {
  id: string;
  partnerA: string;
  partnerB: string;
  status: UnionStatus;
  startDate?: string;
  endDate?: string;
  place?: string;
  notes?: string;
  /** Order of marriages for a person (first wife, second wife ...). */
  sortOrder: number;
}

export interface ParentLink {
  id: string;
  parentId: string;
  childId: string;
  kind: LinkKind;
}

export interface FamilySnapshot {
  persons: Person[];
  unions: Union[];
  links: ParentLink[];
  familyName: string;
  homePersonId?: string;
}

export const PREFIXES = [
  "Haji", "Hajjah", "Syed", "Sharifah", "Wan", "Nik", "Megat", "Puteri",
  "Raja", "Tengku", "Tunku", "Awang", "Dayang", "Datu", "Daeng", "Andi",
  "Dr", "Ir", "Prof", "Dato'", "Datin", "Datuk", "Tan Sri", "Puan Sri", "Tun",
] as const;

export const ETHNICITIES = [
  "Melayu", "Bajau", "Brunei", "Kadazan", "Dusun", "Murut", "Suluk", "Bugis",
  "Jawa", "Banjar", "Arab", "Cina", "India", "Iban", "Bidayuh", "Lain-lain",
] as const;

export const RELIGIONS = ["Islam", "Kristian", "Buddha", "Hindu", "Sikh", "Lain-lain"] as const;

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** "Haji Mohammad bin Norbidin" */
export function fullName(p: Pick<Person, "prefix" | "givenName" | "fatherName" | "surname" | "sex">): string {
  const parts: string[] = [];
  if (p.prefix) parts.push(p.prefix);
  parts.push(p.givenName);
  if (p.fatherName) parts.push(p.sex === "female" ? "binti" : "bin", p.fatherName);
  if (p.surname) parts.push(p.surname);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Two short lines for tree cards: own name, then "bin X" / surname. */
export function cardName(p: Person): [string, string] {
  const first = p.nickname ? `${p.givenName} (${p.nickname})` : p.givenName;
  if (p.fatherName) return [first, `${p.sex === "female" ? "binti" : "bin"} ${p.fatherName}`];
  return [first, p.surname ?? ""];
}

export function initials(p: Person): string {
  return p.givenName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
