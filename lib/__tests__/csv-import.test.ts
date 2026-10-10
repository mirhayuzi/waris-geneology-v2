import { describe, it, expect } from "vitest";
import { isUsablePhotoUri, parseMembersCSV } from "../csv-import";

const header = "ID,First Name,Last Name,Prefix/Title,Bin/Binti,Gender,Date of Birth,Place of Birth,Date of Death,Status,Ethnicity/Race,Religion,Photo File,Biography";

describe("CSV restore photos", () => {
  it("drops the relative photo path stored in backups", () => {
    const [p] = parseMembersCSV(`${header}\np1,Ahmad,,,Yusof,male,1920,,,Living,,Islam,photos/p1.jpg,`);
    expect(p.photo).toBeUndefined();
    expect(p.birthDate).toBe("1920");
  });

  it("keeps real photo URIs", () => {
    expect(isUsablePhotoUri("file:///data/photo.jpg")).toBe(true);
    expect(isUsablePhotoUri("content://media/1")).toBe(true);
    expect(isUsablePhotoUri("photos/p1.jpg")).toBe(false);
    expect(isUsablePhotoUri(undefined)).toBe(false);
  });
});
