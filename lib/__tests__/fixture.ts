import type { FamilySnapshot, LinkKind, Person, Sex } from "../model";

/** Small test family:
 *
 *   Norbidin = Aminah        Sibil (no spouse)
 *         |                      |
 *     Mohammad  ===========  Siti        Ali (Siti's brother) = Zaitun
 *          |                                |
 *   Mirhayuzi (1982) = Nisa       Aishah (older, 1975) , Bakar (1985)     Razak (Ali's son)
 *        |
 *   Fatimah (2015), Haffizuddin (2017)
 */
export function family(): FamilySnapshot {
  const t = "2026-01-01T00:00:00.000Z";
  const persons: Person[] = [];
  const P = (id: string, sex: Sex, birthDate?: string, living = true) =>
    persons.push({ id, givenName: id, sex, birthDate, living, createdAt: t, updatedAt: t });
  P("norbidin", "male", "1920", false);
  P("aminah", "female", "1925", false);
  P("sibil", "male", "1930", false);
  P("mohammad", "male", "1950", false);
  P("siti", "female", "1955");
  P("ali", "male", "1958");
  P("zaitun", "female", "1960");
  P("razak", "male", "1988");
  P("mirhayuzi", "male", "1982-03-12");
  P("nisa", "female", "1993");
  P("aishah", "female", "1975");
  P("bakar", "male", "1985");
  P("fatimah", "female", "2015");
  P("haffizuddin", "male", "2017");
  P("nisadad", "male", "1960");
  const links: FamilySnapshot["links"] = [];
  const L = (parentId: string, childId: string, kind: LinkKind = "birth") =>
    links.push({ id: `${parentId}>${childId}`, parentId, childId, kind });
  L("norbidin", "mohammad");
  L("aminah", "mohammad");
  L("sibil", "siti");
  L("sibil", "ali");
  L("mohammad", "mirhayuzi");
  L("siti", "mirhayuzi");
  L("mohammad", "aishah");
  L("siti", "aishah");
  L("mohammad", "bakar"); // half-brother via father only
  L("ali", "razak");
  L("zaitun", "razak");
  L("mirhayuzi", "fatimah");
  L("nisa", "fatimah");
  L("mirhayuzi", "haffizuddin");
  L("nisa", "haffizuddin");
  L("nisadad", "nisa");
  const unions: FamilySnapshot["unions"] = [
    { id: "u1", partnerA: "norbidin", partnerB: "aminah", status: "married", sortOrder: 0 },
    { id: "u2", partnerA: "mohammad", partnerB: "siti", status: "married", sortOrder: 0 },
    { id: "u3", partnerA: "mirhayuzi", partnerB: "nisa", status: "married", sortOrder: 0 },
    { id: "u4", partnerA: "ali", partnerB: "zaitun", status: "married", sortOrder: 0 },
  ];
  return { persons, unions, links, familyName: "Keluarga Test", homePersonId: "mirhayuzi" };
}
