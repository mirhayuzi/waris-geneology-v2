import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

// Simulates the state right after the app restarts: the native module has a
// previous sign-in but no current user until signInSilently() is called.
const signIn = {
  currentUser: null as null | { user: { email: string } },
  signInSilently: vi.fn(),
};
const fakeGoogleSignin = {
  GoogleSignin: {
    configure: vi.fn(),
    getCurrentUser: () => signIn.currentUser,
    hasPreviousSignIn: () => true,
    signInSilently: () => signIn.signInSilently(),
    getTokens: vi.fn().mockResolvedValue({ accessToken: "token-123" }),
    clearCachedAccessToken: vi.fn(),
  },
};

// ---- A tiny in-memory Google Drive ----
type DriveItem = { id: string; name: string; mimeType?: string; parents?: string[]; content?: string; modifiedTime: string; createdTime: string };
let items: DriveItem[] = [];
let clock = 0;
const tick = () => new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)).toISOString();

function addItem(item: Omit<DriveItem, "id" | "modifiedTime" | "createdTime">): DriveItem {
  const t = tick();
  const full = { ...item, id: `id${items.length + 1}`, modifiedTime: t, createdTime: t };
  items.push(full);
  return full;
}

function matchesQuery(item: DriveItem, q: string): boolean {
  if (q.includes("trashed=false") === false) return false;
  const name = /name='([^']+)'/.exec(q);
  if (name && item.name !== name[1]) return false;
  if (q.includes("mimeType='application/vnd.google-apps.folder'") && item.mimeType !== "application/vnd.google-apps.folder") return false;
  const parents = [...q.matchAll(/'([^']+)' in parents/g)].map((m) => m[1]);
  if (parents.length > 0 && !parents.some((p) => item.parents?.includes(p))) return false;
  return true;
}

async function fakeFetch(url: string, init: { method?: string; body?: string } = {}) {
  const u = new URL(url);
  const json = (data: unknown) => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });
  const method = init.method || "GET";

  if (u.pathname === "/drive/v3/files" && method === "GET") {
    const q = u.searchParams.get("q") || "";
    let found = items.filter((i) => matchesQuery(i, q));
    const order = u.searchParams.get("orderBy");
    if (order === "modifiedTime desc") found = [...found].sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime));
    if (order === "createdTime") found = [...found].sort((a, b) => a.createdTime.localeCompare(b.createdTime));
    return json({ files: found.map(({ id, name, modifiedTime }) => ({ id, name, modifiedTime })) });
  }
  if (u.pathname === "/drive/v3/files" && method === "POST") {
    // Yield first so parallel callers would both miss the folder, like the real API
    await Promise.resolve();
    const meta = JSON.parse(init.body || "{}");
    return json(addItem({ name: meta.name, mimeType: meta.mimeType }));
  }
  const media = /^\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname);
  if (media && u.searchParams.get("alt") === "media") {
    const item = items.find((i) => i.id === media[1]);
    return { ok: !!item, status: item ? 200 : 404, text: async () => item?.content ?? "" };
  }
  if (u.pathname.startsWith("/upload/drive/v3/files")) {
    const parts = (init.body || "").split(/--waris_boundary_\d+/);
    const meta = JSON.parse(parts[1].split("\r\n\r\n")[1]);
    const content = parts[2].split("\r\n\r\n").slice(1).join("\r\n\r\n").replace(/\r\n$/, "");
    const existingId = /files\/([^?]+)/.exec(u.pathname)?.[1];
    if (method === "PATCH" && existingId) {
      const item = items.find((i) => i.id === existingId)!;
      item.content = content;
      item.modifiedTime = tick();
      return json(item);
    }
    return json(addItem({ name: meta.name, mimeType: meta.mimeType, parents: meta.parents, content }));
  }
  throw new Error(`Unexpected request: ${method} ${url}`);
}

const folders = () => items.filter((i) => i.mimeType === "application/vnd.google-apps.folder");

describe("Google Drive backup", () => {
  beforeEach(() => {
    items = [];
    clock = 0;
    signIn.currentUser = { user: { email: "a@b.com" } };
    signIn.signInSilently.mockReset();
    vi.stubGlobal("fetch", vi.fn(fakeFetch));
  });

  beforeEach(async () => {
    const drive = await import("../google-drive");
    drive.__setGoogleSigninModuleForTests(fakeGoogleSignin);
  });

  it("creates a single app folder on the first backup", async () => {
    const { syncAllToDrive } = await import("../google-drive");
    const result = await syncAllToDrive("members", "marriages", "parents");
    expect(result.success).toBe(true);
    expect(folders()).toHaveLength(1);
    expect(items.filter((i) => i.parents?.includes(folders()[0].id))).toHaveLength(3);
  });

  it("updates the same files on later backups instead of adding copies", async () => {
    const { syncAllToDrive } = await import("../google-drive");
    await syncAllToDrive("m1", "x1", "p1");
    await syncAllToDrive("m2", "x2", "p2");
    expect(items.filter((i) => i.name === "members.csv")).toHaveLength(1);
    expect(items.find((i) => i.name === "members.csv")?.content).toBe("m2");
  });

  it("restores the newest files even when older versions left duplicate folders", async () => {
    // What the old parallel upload could leave behind: 3 folders, one file each, plus an older members.csv
    const f1 = addItem({ name: "Waris Genealogy", mimeType: "application/vnd.google-apps.folder" });
    const f2 = addItem({ name: "Waris Genealogy", mimeType: "application/vnd.google-apps.folder" });
    const f3 = addItem({ name: "Waris Genealogy", mimeType: "application/vnd.google-apps.folder" });
    addItem({ name: "members.csv", parents: [f2.id], content: "old members" });
    addItem({ name: "marriages.csv", parents: [f1.id], content: "marriages" });
    addItem({ name: "parent-child.csv", parents: [f3.id], content: "parents" });
    addItem({ name: "members.csv", parents: [f3.id], content: "new members" });

    const { downloadAllFromDrive } = await import("../google-drive");
    const result = await downloadAllFromDrive();
    expect(result.success).toBe(true);
    expect(result.membersCSV).toBe("new members");
    expect(result.marriagesCSV).toBe("marriages");
    expect(result.parentChildCSV).toBe("parents");
  });

  it("restores the Google session after an app restart", async () => {
    signIn.currentUser = null;
    signIn.signInSilently.mockImplementation(async () => {
      signIn.currentUser = { user: { email: "a@b.com" } };
      return { type: "success", data: signIn.currentUser };
    });
    const { getAccessToken } = await import("../google-drive");
    expect(await getAccessToken()).toBe("token-123");
    expect(signIn.signInSilently).toHaveBeenCalledTimes(1);
  });

  it("says there is no backup when Drive is empty", async () => {
    const { downloadAllFromDrive } = await import("../google-drive");
    const result = await downloadAllFromDrive();
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/No backup files/);
  });
});
