import { describe, expect, it } from "vitest";
import { parseBackupFiles } from "../backup";
import { parseCSV } from "../csv-legacy";

// Same headers as the previous app's CSV export
const members = `ID,First Name,Last Name,Prefix/Title,Bin/Binti,Gender,Date of Birth,Place of Birth,Date of Death,Status,Ethnicity/Race,Religion,Photo File,Biography
a1,Mohammad,,Haji,Norbidin,male,1950,Kota Belud,2010-05-01,Deceased,Bajau,Islam,photos/a1.jpg,"Kind man, loved ""fishing""
and farming"
a2,Siti,,,Sibil,female,1955-02-03,,,Living,Bajau,Islam,,
a3,Mirhayuzi,,,Mohammad,male,1982-03-12,Kota Kinabalu,,Living,Bajau,Islam,,`;
const marriages = `Marriage ID,Husband ID,Wife ID,Marriage Date,Marriage Place,Divorce Date,Status,Notes
m1,a1,a2,1978,,,Active,`;
const links = `Relationship ID,Parent ID,Child ID,Relationship Type
r1,a1,a3,biological
r2,a2,a3,biological`;

describe("old CSV backups", () => {
  it("parses quoted fields with commas, quotes and newlines", () => {
    const rows = parseCSV(members);
    expect(rows).toHaveLength(4);
    expect(rows[1][13]).toBe('Kind man, loved "fishing"\nand farming');
  });

  it("restores members, marriages and parent links in any order", () => {
    const parsed = parseBackupFiles([links, members, marriages]);
    const d = parsed.data;
    expect(d.persons).toHaveLength(3);
    const moh = d.persons.find((p) => p.id === "a1")!;
    expect(moh).toMatchObject({ givenName: "Mohammad", prefix: "Haji", fatherName: "Norbidin", living: false, deathDate: "2010-05-01", ethnicity: "Bajau" });
    expect(moh.photo).toBeUndefined();
    expect(d.unions).toHaveLength(1);
    expect(d.links).toHaveLength(2);
  });

  it("restores members alone, and rejects files without members", () => {
    expect(parseBackupFiles([members]).data.persons).toHaveLength(3);
    expect(() => parseBackupFiles([marriages])).toThrow();
    expect(() => parseBackupFiles(["hello"])).toThrow();
  });
});
