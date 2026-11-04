import { describe, expect, it } from "vitest";
import { buildBackup, parseBackupFiles } from "../backup";
import { forgetIncomingFile, getIncomingFile, setIncomingFile } from "../incoming-file";
import { family } from "./fixture";

describe("incoming family files", () => {
  it("keeps an incoming URI available when its screen remounts", () => {
    const uri = "content://com.example.files/family%20%23%25.json";
    const request = setIncomingFile(uri);
    expect(getIncomingFile(request)).toBe(uri);
    expect(getIncomingFile(request)).toBe(uri);
    forgetIncomingFile(request);
    expect(getIncomingFile(request)).toBeNull();
  });

  it("does not replace another screen's file even when requests arrive in the same millisecond", () => {
    const first = setIncomingFile("file:///first.json");
    const second = setIncomingFile("file:///second.xlsx");
    expect(first).not.toBe(second);
    expect(getIncomingFile(first)).toBe("file:///first.json");
    expect(getIncomingFile(second)).toBe("file:///second.xlsx");
    forgetIncomingFile(first);
    expect(getIncomingFile(second)).toBe("file:///second.xlsx");
  });

  it("reports a missing or expired request instead of returning an unrelated file", () => {
    expect(getIncomingFile(undefined)).toBeNull();
    expect(getIncomingFile("missing")).toBeNull();
    const oldest = setIncomingFile("file:///old.json");
    for (let n = 0; n < 8; n++) setIncomingFile(`file:///${n}.json`);
    expect(getIncomingFile(oldest)).toBeNull();
  });

  it("accepts a valid JSON backup with a UTF-8 byte-order mark", () => {
    const text = JSON.stringify(buildBackup(family(), {}));
    expect(parseBackupFiles([`\uFEFF${text}`])).toEqual(parseBackupFiles([text]));
  });

  it("still refuses malformed JSON instead of offering to replace the family", () => {
    expect(() => parseBackupFiles(['\uFEFF{"broken":'])).toThrow("not-json");
  });
});
