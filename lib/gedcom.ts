import { parseStored } from "./dates";
import type { FamilySnapshot, Person } from "./model";

/**
 * GEDCOM 5.5.1 export: the standard format every genealogy program
 * (FamilySearch, Ancestry, MyHeritage, Gramps ...) can import.
 */

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function gedcomDate(value: string | undefined): string | undefined {
  const d = parseStored(value);
  if (!d) return undefined;
  let s = String(d.year);
  if (d.month) s = `${MON[d.month - 1]} ${s}`;
  if (d.month && d.day) s = `${d.day} ${s}`;
  return d.approx ? `ABT ${s}` : s;
}

/** GEDCOM lines must be short and single-line; long text continues with CONC / CONT. */
function textLines(level: number, tag: string, text: string): string[] {
  const out: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const chunks = line.match(/.{1,200}/g) ?? [""];
    chunks.forEach((chunk, j) => {
      if (i === 0 && j === 0) out.push(`${level} ${tag} ${chunk}`);
      else out.push(`${level + 1} ${j === 0 ? "CONT" : "CONC"} ${chunk}`);
    });
  });
  return out;
}

const clean = (v: string) => v.replace(/[\r\n]+/g, " ").replace(/@/g, "@@").trim();

export function toGedcom(data: FamilySnapshot, opts: { includeLiving?: boolean } = {}): string {
  const includeLiving = opts.includeLiving ?? true;
  const indi = new Map<string, string>();
  data.persons.forEach((p, i) => indi.set(p.id, `@I${i + 1}@`));
  const lines: string[] = [
    "0 HEAD",
    "1 SOUR WARIS",
    "2 NAME Waris",
    "2 VERS 2.0",
    `1 DATE ${gedcomDate(new Date().toISOString().slice(0, 10))}`,
    "1 GEDC",
    "2 VERS 5.5.1",
    "2 FORM LINEAGE-LINKED",
    "1 CHAR UTF-8",
  ];

  // Families: one per couple (married or co-parents), plus single-parent families
  interface Fam { id: string; husb?: string; wife?: string; children: string[]; union?: FamilySnapshot["unions"][number] }
  const fams = new Map<string, Fam>();
  const byId = new Map(data.persons.map((p) => [p.id, p]));
  const famKey = (a?: string, b?: string) => [a ?? "", b ?? ""].sort().join("|");
  const getFam = (a?: string, b?: string): Fam => {
    const key = famKey(a, b);
    let f = fams.get(key);
    if (!f) {
      const pa = a ? byId.get(a) : undefined;
      const pb = b ? byId.get(b) : undefined;
      const [husb, wife] = pa?.sex === "female" || pb?.sex === "male" ? [b, a] : [a, b];
      f = { id: `@F${fams.size + 1}@`, husb, wife, children: [] };
      fams.set(key, f);
    }
    return f;
  };
  for (const u of data.unions) getFam(u.partnerA, u.partnerB).union = u;
  const parentsOf = new Map<string, string[]>();
  for (const l of data.links) {
    if (l.kind === "step" || l.kind === "milk") continue;
    parentsOf.set(l.childId, [...(parentsOf.get(l.childId) ?? []), l.parentId]);
  }
  for (const [child, parents] of parentsOf) getFam(parents[0], parents[1]).children.push(child);

  const famc = new Map<string, string[]>();
  const fams_ = new Map<string, string[]>();
  for (const f of fams.values()) {
    for (const p of [f.husb, f.wife]) if (p) fams_.set(p, [...(fams_.get(p) ?? []), f.id]);
    for (const c of f.children) famc.set(c, [...(famc.get(c) ?? []), f.id]);
  }

  const hide = (p: Person) => !includeLiving && p.living;
  for (const p of data.persons) {
    lines.push(`0 ${indi.get(p.id)} INDI`);
    if (hide(p)) {
      lines.push("1 NAME Living //", `1 SEX ${p.sex === "female" ? "F" : "M"}`);
    } else {
      const given = clean([p.givenName, p.fatherName ? `${p.sex === "female" ? "binti" : "bin"} ${p.fatherName}` : ""].filter(Boolean).join(" "));
      lines.push(`1 NAME ${given} /${clean(p.surname ?? "")}/`);
      if (p.prefix) lines.push(`2 NPFX ${clean(p.prefix)}`);
      lines.push(`2 GIVN ${clean(p.givenName)}`);
      if (p.surname) lines.push(`2 SURN ${clean(p.surname)}`);
      if (p.nickname) lines.push(`2 NICK ${clean(p.nickname)}`);
      lines.push(`1 SEX ${p.sex === "female" ? "F" : "M"}`);
      if (p.birthDate || p.birthPlace) {
        lines.push("1 BIRT");
        const d = gedcomDate(p.birthDate);
        if (d) lines.push(`2 DATE ${d}`);
        if (p.birthPlace) lines.push(`2 PLAC ${clean(p.birthPlace)}`);
      }
      if (!p.living) {
        lines.push("1 DEAT Y");
        const d = gedcomDate(p.deathDate);
        if (d) lines.push(`2 DATE ${d}`);
        if (p.deathPlace) lines.push(`2 PLAC ${clean(p.deathPlace)}`);
      }
      if (p.burialPlace) lines.push("1 BURI", `2 PLAC ${clean(p.burialPlace)}`);
      if (p.religion) lines.push(`1 RELI ${clean(p.religion)}`);
      if (p.occupation) lines.push(`1 OCCU ${clean(p.occupation)}`);
      if (p.notes) lines.push(...textLines(1, "NOTE", p.notes.replace(/@/g, "@@")));
    }
    for (const f of famc.get(p.id) ?? []) lines.push(`1 FAMC ${f}`);
    for (const f of fams_.get(p.id) ?? []) lines.push(`1 FAMS ${f}`);
  }

  for (const f of fams.values()) {
    lines.push(`0 ${f.id} FAM`);
    if (f.husb) lines.push(`1 HUSB ${indi.get(f.husb)}`);
    if (f.wife) lines.push(`1 WIFE ${indi.get(f.wife)}`);
    for (const c of f.children) lines.push(`1 CHIL ${indi.get(c)}`);
    const u = f.union;
    if (u) {
      const d = gedcomDate(u.startDate);
      if (d || u.place) {
        lines.push("1 MARR");
        if (d) lines.push(`2 DATE ${d}`);
        if (u.place) lines.push(`2 PLAC ${clean(u.place)}`);
      }
      if (u.status === "divorced") {
        lines.push("1 DIV Y");
        const e = gedcomDate(u.endDate);
        if (e) lines.push(`2 DATE ${e}`);
      }
    }
  }
  lines.push("0 TRLR");
  return lines.join("\n") + "\n";
}
