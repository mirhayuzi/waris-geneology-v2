import { Person, Marriage, ParentChild, FamilyData, Gender, RelationshipType, Religion } from "./types";

/**
 * CSV Import System
 * Parses CSV backup files back into FamilyData
 * Supports: members.csv, marriages.csv, parent-child.csv
 */

/**
 * Parse a CSV string into rows of string arrays
 */
function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === "\n" || (char === "\r" && nextChar === "\n")) {
        currentRow.push(currentField);
        currentField = "";
        if (currentRow.length > 0 && currentRow.some((f) => f.trim() !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        if (char === "\r") i++; // skip \n after \r
      } else {
        currentField += char;
      }
    }
  }

  // Last field/row
  currentRow.push(currentField);
  if (currentRow.length > 0 && currentRow.some((f) => f.trim() !== "")) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Backups store photos as a relative path like "photos/<id>.jpg", which is not a
 * location the app can display. Only keep photo values that are real URIs.
 */
export function isUsablePhotoUri(value: string | undefined): boolean {
  return !!value && /^(file|content|https?|data|blob):/i.test(value);
}

/**
 * Parse members CSV into Person array
 */
export function parseMembersCSV(csvText: string): Person[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return []; // Need at least header + 1 data row

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const persons: Person[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const get = (headerName: string): string => {
      const idx = headers.indexOf(headerName.toLowerCase());
      return idx >= 0 && idx < row.length ? row[idx].trim() : "";
    };

    const id = get("id");
    const firstName = get("first name");
    if (!id || !firstName) continue;

    const statusVal = get("status").toLowerCase();
    const genderVal = get("gender").toLowerCase();

    const person: Person = {
      id,
      firstName,
      lastName: get("last name") || undefined,
      prefix: get("prefix/title") || undefined,
      binBinti: get("bin/binti") || undefined,
      gender: (genderVal === "female" ? "female" : "male") as Gender,
      birthDate: get("date of birth") || undefined,
      birthPlace: get("place of birth") || undefined,
      deathDate: get("date of death") || undefined,
      isAlive: statusVal !== "deceased",
      race: get("ethnicity/race") || undefined,
      religion: (get("religion") || "Islam") as Religion,
      photo: isUsablePhotoUri(get("photo file")) ? get("photo file") : undefined,
      bio: get("biography") || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    persons.push(person);
  }

  return persons;
}

/**
 * Parse marriages CSV into Marriage array
 */
export function parseMarriagesCSV(csvText: string): Marriage[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const marriages: Marriage[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const get = (headerName: string): string => {
      const idx = headers.indexOf(headerName.toLowerCase());
      return idx >= 0 && idx < row.length ? row[idx].trim() : "";
    };

    const id = get("marriage id");
    const husbandId = get("husband id");
    const wifeId = get("wife id");
    if (!id || !husbandId || !wifeId) continue;

    const statusVal = get("status").toLowerCase();

    const marriage: Marriage = {
      id,
      husbandId,
      wifeId,
      marriageDate: get("marriage date") || undefined,
      marriagePlace: get("marriage place") || undefined,
      divorceDate: get("divorce date") || undefined,
      isActive: statusVal !== "divorced",
      notes: get("notes") || undefined,
    };

    marriages.push(marriage);
  }

  return marriages;
}

/**
 * Parse parent-child CSV into ParentChild array
 */
export function parseParentChildCSV(csvText: string): ParentChild[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const parentChildren: ParentChild[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const get = (headerName: string): string => {
      const idx = headers.indexOf(headerName.toLowerCase());
      return idx >= 0 && idx < row.length ? row[idx].trim() : "";
    };

    const id = get("relationship id");
    const parentId = get("parent id");
    const childId = get("child id");
    if (!id || !parentId || !childId) continue;

    const typeVal = get("relationship type").toLowerCase();
    let relType: RelationshipType = "biological";
    if (typeVal === "adopted") relType = "adopted";
    else if (typeVal === "susuan") relType = "susuan";

    parentChildren.push({ id, parentId, childId, type: relType });
  }

  return parentChildren;
}

/**
 * Build FamilyData from parsed CSV data
 */
export function buildFamilyDataFromCSV(
  persons: Person[],
  marriages: Marriage[],
  parentChildren: ParentChild[],
  familyName?: string,
  rootPersonId?: string,
): FamilyData {
  return {
    persons,
    marriages,
    parentChildren,
    collaborators: [],
    rootPersonId: rootPersonId || (persons.length > 0 ? persons[0].id : undefined),
    familyName: familyName || "My Family",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Parse a single CSV file that contains all data (members only)
 * Used when user picks just one CSV file
 */
export function parseAllFromSingleCSV(csvText: string): {
  persons: Person[];
  marriages: Marriage[];
  parentChildren: ParentChild[];
} {
  // Try to detect what type of CSV it is based on headers
  const firstLine = csvText.split("\n")[0]?.toLowerCase() || "";

  if (firstLine.includes("marriage id") || firstLine.includes("husband id")) {
    return { persons: [], marriages: parseMarriagesCSV(csvText), parentChildren: [] };
  }
  if (firstLine.includes("relationship id") || firstLine.includes("parent id")) {
    return { persons: [], marriages: [], parentChildren: parseParentChildCSV(csvText) };
  }

  // Default: treat as members CSV
  return { persons: parseMembersCSV(csvText), marriages: [], parentChildren: [] };
}
