import type { LegacyData } from "./legacy";

/**
 * Reads the CSV backups made by the previous app version
 * (members.csv, marriages.csv, parent-child.csv — from Google Drive or a phone folder).
 */

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

type Kind = "members" | "marriages" | "links";

function kindOf(header: string[]): Kind | null {
  const h = header.map((x) => x.trim().toLowerCase());
  if (h.includes("husband id")) return "marriages";
  if (h.includes("parent id")) return "links";
  if (h.includes("first name")) return "members";
  return null;
}

function records(rows: string[][]): Record<string, string>[] {
  const [header, ...body] = rows;
  const keys = header.map((k) => k.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

/** True when the text looks like one of the old app's CSV files. */
export function isLegacyCSV(text: string): boolean {
  const first = parseCSV(text.split(/\r?\n/)[0] ?? "")[0];
  return !!first && kindOf(first) !== null;
}

/** Combines any of the three old CSV files into the old data shape. Throws if no members file is given. */
export function legacyFromCSV(texts: string[]): LegacyData {
  const data: Required<Pick<LegacyData, "persons" | "marriages" | "parentChildren">> = { persons: [], marriages: [], parentChildren: [] };
  let sawMembers = false;
  for (const text of texts) {
    const rows = parseCSV(text);
    if (!rows.length) continue;
    const kind = kindOf(rows[0]);
    for (const r of records(rows)) {
      if (kind === "members" && r["id"]) {
        sawMembers = true;
        data.persons.push({
          id: r["id"],
          firstName: r["first name"],
          lastName: r["last name"] || undefined,
          prefix: r["prefix/title"] || undefined,
          binBinti: r["bin/binti"] || undefined,
          gender: r["gender"]?.toLowerCase() === "female" ? "female" : "male",
          birthDate: r["date of birth"] || undefined,
          birthPlace: r["place of birth"] || undefined,
          deathDate: r["date of death"] || undefined,
          isAlive: r["status"]?.toLowerCase() !== "deceased",
          race: r["ethnicity/race"] || undefined,
          religion: r["religion"] || undefined,
          bio: r["biography"] || undefined,
        });
      } else if (kind === "marriages" && r["marriage id"]) {
        data.marriages.push({
          id: r["marriage id"],
          husbandId: r["husband id"],
          wifeId: r["wife id"],
          marriageDate: r["marriage date"] || undefined,
          marriagePlace: r["marriage place"] || undefined,
          divorceDate: r["divorce date"] || undefined,
          isActive: r["status"]?.toLowerCase() !== "divorced",
          notes: r["notes"] || undefined,
        });
      } else if (kind === "links" && r["relationship id"]) {
        data.parentChildren.push({ id: r["relationship id"], parentId: r["parent id"], childId: r["child id"], type: r["relationship type"] });
      }
    }
  }
  if (!sawMembers) throw new Error("no-members");
  return data;
}
