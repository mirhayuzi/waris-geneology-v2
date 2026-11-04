import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  cacheDirectory: "file:///cache/",
  EncodingType: { Base64: "base64" },
  copyAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  deleteAsync: vi.fn(),
}));
vi.mock("expo-file-system/legacy", () => fs);
vi.mock("expo-document-picker", () => ({}));
vi.mock("expo-image-manipulator", () => ({}));
vi.mock("expo-image-picker", () => ({}));
vi.mock("expo-sharing", () => ({}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

const { readIncomingFile } = await import("../files");

beforeEach(() => {
  vi.resetAllMocks();
  fs.copyAsync.mockResolvedValue(undefined);
  fs.deleteAsync.mockResolvedValue(undefined);
  fs.readAsStringAsync.mockImplementation(async (_uri: string, options?: { encoding: string }) =>
    options?.encoding === "base64" ? "eyJhcHAiOiJ3YXJpcyJ9" : '{"app":"waris"}',
  );
});
afterEach(() => vi.restoreAllMocks());

describe("reading shared files", () => {
  it("copies a content URI before reading JSON and deletes only the temporary copy", async () => {
    const uri = "content://provider/family%20backup.json";
    expect(await readIncomingFile(uri)).toEqual({ texts: ['{"app":"waris"}'], images: [] });
    const local = fs.copyAsync.mock.calls[0][0].to;
    expect(fs.copyAsync).toHaveBeenCalledWith({ from: uri, to: local });
    expect(fs.readAsStringAsync).toHaveBeenCalledWith(local);
    expect(fs.deleteAsync).toHaveBeenCalledTimes(1);
    expect(fs.deleteAsync).toHaveBeenCalledWith(local, { idempotent: true });
    expect(local).not.toBe(uri);
  });

  it("recognizes an Excel ZIP even when the provider URI has no extension", async () => {
    fs.readAsStringAsync.mockResolvedValue("UEsDBA==");
    expect(await readIncomingFile("content://provider/document/123")).toEqual({ texts: [], excel: "UEsDBA==", images: [] });
    expect(fs.readAsStringAsync).toHaveBeenCalledTimes(1);
  });

  it("uses distinct cache copies when two screen reads start at the same time", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1234);
    await Promise.all([readIncomingFile("content://provider/one"), readIncomingFile("content://provider/two")]);
    const paths = fs.copyAsync.mock.calls.map(([arg]) => arg.to);
    expect(new Set(paths).size).toBe(2);
    for (const path of paths) expect(fs.deleteAsync).toHaveBeenCalledWith(path, { idempotent: true });
  });

  it("preserves the access error and cleans a partial copy when the URI permission has expired", async () => {
    fs.copyAsync.mockRejectedValue(new Error("Permission denied"));
    await expect(readIncomingFile("content://provider/expired")).rejects.toThrow("Permission denied");
    expect(fs.readAsStringAsync).not.toHaveBeenCalled();
    expect(fs.deleteAsync).toHaveBeenCalledTimes(1);
  });
});
