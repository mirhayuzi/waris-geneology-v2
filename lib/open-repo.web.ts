import type { FamilySnapshot, LinkKind, Person, Sex } from "./model";
import { MemoryRepo, type Repo } from "./repo";

/**
 * Web is only a preview (the app is built for phones): data lives in memory and is
 * lost on reload. A small sample family is loaded so the tree can be tried out.
 */
export async function openRepo(): Promise<Repo> {
  const repo = new MemoryRepo();
  if (typeof location !== "undefined" && location.search.includes("empty")) return repo;
  await repo.replaceAll(sample());
  return repo;
}

export const IS_PREVIEW = true;

function sample(): FamilySnapshot {
  const t = new Date().toISOString();
  const persons: Person[] = [];
  const P = (id: string, givenName: string, sex: Sex, extra: Partial<Person> = {}) =>
    persons.push({ id, givenName, sex, living: true, createdAt: t, updatedAt: t, ...extra });
  P("ahmad", "Ahmad", "male", { fatherName: "Yusof", birthDate: "~1930", living: false });
  P("fatimah", "Fatimah", "female", { birthDate: "1935", living: false });
  P("hassan", "Hassan", "male", { birthDate: "1928", living: false });
  P("ali", "Ali", "male", { fatherName: "Ahmad", birthDate: "1955", living: false, deathDate: "2010" });
  P("aminah", "Aminah", "female", { fatherName: "Hassan", birthDate: "1960" });
  P("aisyah", "Aisyah", "female", { fatherName: "Ali", birthDate: "1980" });
  P("rahman", "Rahman", "male", { fatherName: "Ali", birthDate: "1982-03-12" });
  P("nurul", "Nurul", "female", { fatherName: "Salleh", birthDate: "1990" });
  P("hana", "Hana", "female", { fatherName: "Rahman", birthDate: "2015" });
  P("irfan", "Irfan", "male", { fatherName: "Rahman", birthDate: "2017" });
  P("zul", "Zulkifli", "male", { fatherName: "Omar", birthDate: "1978" });
  P("dina", "Dina", "female", { fatherName: "Zulkifli", birthDate: "2006" });
  const links: FamilySnapshot["links"] = [];
  const L = (p: string, c: string, kind: LinkKind = "birth") => links.push({ id: `${p}-${c}`, parentId: p, childId: c, kind });
  L("ahmad", "ali"); L("fatimah", "ali"); L("hassan", "aminah");
  L("ali", "rahman"); L("aminah", "rahman"); L("ali", "aisyah"); L("aminah", "aisyah");
  L("rahman", "hana"); L("nurul", "hana"); L("rahman", "irfan"); L("nurul", "irfan");
  L("zul", "dina"); L("aisyah", "dina");
  return {
    persons,
    links,
    unions: [
      { id: "u1", partnerA: "ahmad", partnerB: "fatimah", status: "married", sortOrder: 0 },
      { id: "u2", partnerA: "ali", partnerB: "aminah", status: "widowed", sortOrder: 0 },
      { id: "u3", partnerA: "rahman", partnerB: "nurul", status: "married", sortOrder: 0 },
      { id: "u4", partnerA: "zul", partnerB: "aisyah", status: "married", sortOrder: 0 },
    ],
    familyName: "Keluarga Contoh",
    homePersonId: "rahman",
  };
}
