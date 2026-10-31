import { describe, expect, it } from "vitest";
import { RELEASES, releaseToShow } from "../whatsnew";

describe("What's new", () => {
  const current = RELEASES[0].version;
  it("shows the new version's notes once after an update", () => {
    expect(releaseToShow(current, "2.3.2", true)?.version).toBe(current);
    expect(releaseToShow(current, undefined, true)?.version).toBe(current); // updated from a version before this existed
    expect(releaseToShow(current, current, true)).toBeUndefined();
  });
  it("does not greet a brand-new user with update notes", () => {
    expect(releaseToShow(current, undefined, false)).toBeUndefined();
  });
  it("shows nothing for a version without notes", () => {
    expect(releaseToShow("9.9.9", "2.3.2", true)).toBeUndefined();
  });
  it("has notes in both languages for every release", () => {
    for (const r of RELEASES) expect(r.notes.en.length === r.notes.bm.length && r.notes.en.length > 0).toBe(true);
  });
});
