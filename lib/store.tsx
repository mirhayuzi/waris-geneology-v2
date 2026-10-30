import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { addRelative as addRelativeAction, type RelativeRequest } from "./actions";
import { buildBackup, type ParsedBackup, parseBackupFiles } from "./backup";
import { excelToBackup } from "./excel-import";
import { deletePhoto, photoExists, photoThumbnail, readPhotoBase64, type RestoreFiles, savePhotoFrom, writePhotoBase64 } from "./files";
import { buildFamilyWorkbook } from "./excel-export";
import { toGedcom } from "./gedcom";
import { FamilyGraph } from "./graph";
import { defaultLang, type Lang, translate, type TKey } from "./i18n";
import { DEFAULT_OPTIONS, type LayoutOptions } from "./layout";
import { convertLegacy, LEGACY_KEY, type LegacyData } from "./legacy";
import { joinPersons, mergeSnapshots, pairKey, prepareShare } from "./merge";
import { buildXlsx, fromBase64, toBase64 } from "./xlsx";
import { readXlsx } from "./xlsx-read";
import { SNOOZE_DAYS, shouldRemindBackup } from "./reminder";
import { type FamilySnapshot, nowIso, type Person, type Union } from "./model";
import { openRepo } from "./open-repo";
import { META, type Repo } from "./repo";

const EMPTY: FamilySnapshot = {
  persons: [],
  unions: [],
  links: [],
  familyName: "",
};

interface Store {
  ready: boolean;
  error?: string;
  graph: FamilyGraph;
  lang: Lang;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  setLang: (l: Lang) => void;
  treeOptions: LayoutOptions;
  setTreeOptions: (o: LayoutOptions) => void;
  /** The tree screen calls this once the tree has been on screen for a moment */
  treeDrawn: () => void;
  /** Person in the middle of the tree view */
  focusId?: string;
  setFocus: (id: string) => void;
  homeId?: string;
  /** One-time message to show (e.g. after moving old data) */
  notice?: string;
  clearNotice: () => void;
  /** Time to suggest a backup (enough changes since the last one) */
  backupDue: boolean;
  changesSinceBackup: number;
  markBackedUp: () => void;
  snoozeBackup: () => void;

  savePerson: (p: Person) => Promise<void>;
  setPhoto: (p: Person, source: { uri: string; mime?: string | null } | null) => Promise<Person>;
  deletePerson: (id: string) => Promise<void>;
  addRelative: (req: RelativeRequest) => Promise<string>;
  createPerson: (p: Person) => Promise<void>;
  removeParentLink: (linkId: string) => Promise<void>;
  /** Links an existing person to a father and/or mother already in the tree */
  linkParents: (childId: string, fatherId?: string, motherId?: string) => Promise<void>;
  /** The user's own words for kinds of links, keyed by describeVia().key */
  customTerms: Record<string, string>;
  setCustomTerm: (key: string, term: string) => Promise<void>;
  saveUnion: (u: Union) => Promise<void>;
  removeUnion: (id: string) => Promise<void>;
  setHome: (id: string) => Promise<void>;
  setFamilyName: (name: string) => Promise<void>;
  /** Backup JSON. Default is the full file with photos; sharing can leave photos or living details out. */
  backupText: (opts?: { photos?: boolean; hideLiving?: boolean }) => Promise<string>;
  /** Restore from a Waris JSON backup or the old app's CSV files, replacing or merging */
  /** Restore from a Waris JSON backup, a Waris Excel file (+ photos named by ID) or the old app's CSV files */
  restore: (
    files: RestoreFiles,
    mode?: "replace" | "merge",
  ) => Promise<{
    total: number;
    added: number;
    updated: number;
    photos: number;
  }>;
  /** Make two records of the same person into one */
  joinPersons: (keepId: string, dropId: string) => Promise<void>;
  notDuplicates: Set<string>;
  markNotDuplicate: (a: string, b: string) => Promise<void>;
  peekBackup: (files: RestoreFiles) => number;
  gedcom: (includeLiving: boolean) => string;
  /** The whole tree as an Excel workbook, base64-encoded for saving */
  excelBase64: (opts?: { photos?: boolean }) => Promise<string>;
}

const Ctx = createContext<Store | null>(null);

/** Copies an old-app photo (file URI or data: URL) into the photos folder. */
async function importLegacyPhoto(uri: string, personId: string): Promise<string | undefined> {
  try {
    return await savePhotoFrom(uri, personId, uri.startsWith("data:image/png") ? "image/png" : null);
  } catch {
    return undefined;
  }
}

async function applyLegacyPhotos(s: FamilySnapshot, photos: Record<string, string>) {
  for (const p of s.persons) {
    const src = photos[p.id];
    p.photo = src ? await importLegacyPhoto(src, p.id) : undefined;
  }
}

/** Reads picked Restore files: an Excel file if there is one, otherwise backup JSON or old CSV files. */
function parseRestore(files: RestoreFiles): {
  parsed: ParsedBackup;
  photos: number;
} {
  if (files.excel) {
    const r = excelToBackup(readXlsx(fromBase64(files.excel)), {
      images: files.images,
    });
    return { parsed: r.parsed, photos: r.photos };
  }
  const parsed = parseBackupFiles(files.texts);
  return { parsed, photos: Object.keys(parsed.photos).length };
}

/** Moves data from the previous app version (AsyncStorage JSON) into SQLite, once. */
async function migrateLegacy(repo: Repo): Promise<number> {
  if (await repo.getMeta(META.legacyImported)) return 0;
  let count = 0;
  try {
    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    const existing = await repo.load();
    if (raw && existing.persons.length === 0) {
      const { snapshot, photos } = convertLegacy(JSON.parse(raw) as LegacyData);
      await applyLegacyPhotos(snapshot, photos);
      await repo.replaceAll(snapshot);
      count = snapshot.persons.length;
    }
  } catch (e) {
    console.warn("Legacy migration failed", e);
    return 0; // try again next launch; old data is left untouched
  }
  // The old data is kept in AsyncStorage as a safety copy.
  await repo.setMeta(META.legacyImported, nowIso());
  return count;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const repoRef = useRef<Repo | null>(null);
  const [snapshot, setSnapshot] = useState<FamilySnapshot>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [lang, setLangState] = useState<Lang>(defaultLang());
  const [treeOptions, setTreeOptionsState] = useState<LayoutOptions>(DEFAULT_OPTIONS);
  const [focusId, setFocusId] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [customTerms, setCustomTerms] = useState<Record<string, string>>({});
  const [notDuplicates, setNotDuplicates] = useState<Set<string>>(new Set());

  const t = useCallback((key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  const graph = useMemo(() => new FamilyGraph(snapshot), [snapshot]);

  const [backupInfo, setBackupInfo] = useState<{
    changes: number;
    last?: string;
    snooze?: string;
  }>({ changes: 0 });

  // Every edit ends with a reload, so this is where changes since the last backup are counted
  const reload = useCallback(async () => {
    const repo = repoRef.current!;
    const s = await repo.load();
    setSnapshot(s);
    const n = (Number(await repo.getMeta(META.changesSinceBackup)) || 0) + 1;
    await repo.setMeta(META.changesSinceBackup, String(n));
    setBackupInfo((b) => ({ ...b, changes: n }));
    return s;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const repo = await openRepo();
        repoRef.current = repo;
        const moved = await migrateLegacy(repo);
        const l = (await repo.getMeta(META.language)) as Lang | undefined;
        if (l === "en" || l === "bm") setLangState(l);
        const num = (v: string | undefined, def: number, max: number) => {
          const n = Number(v);
          return v && Number.isInteger(n) && n >= 0 && n <= max ? n : def;
        };
        let opts: LayoutOptions = {
          up: num(await repo.getMeta(META.treeUp), DEFAULT_OPTIONS.up, 6),
          down: num(await repo.getMeta(META.treeDown), DEFAULT_OPTIONS.down, 4),
          showAdd: (await repo.getMeta(META.treeAdd)) !== "0",
          classic: (await repo.getMeta(META.treeStyle)) === "classic",
        };
        // The last launch stopped while drawing the tree (crash): start with the default view
        if ((await repo.getMeta(META.treeDrawing)) === "1") {
          // ...in the classic drawing, which has been safe on every phone so far
          opts = { ...DEFAULT_OPTIONS, classic: true };
          await repo.setMeta(META.treeStyle, "classic");
          await repo.setMeta(META.treeUp, String(opts.up));
          await repo.setMeta(META.treeDown, String(opts.down));
          await repo.setMeta(META.treeAdd, "1");
          setNotice(translate(l === "en" || l === "bm" ? l : defaultLang(), "treeReset"));
        }
        await repo.setMeta(META.treeDrawing, "1");
        setBackupInfo({
          changes: Number(await repo.getMeta(META.changesSinceBackup)) || 0,
          last: await repo.getMeta(META.lastBackup),
          snooze: await repo.getMeta(META.backupSnooze),
        });
        setTreeOptionsState(opts);
        try {
          setCustomTerms(JSON.parse((await repo.getMeta(META.customTerms)) ?? "{}"));
          setNotDuplicates(new Set(JSON.parse((await repo.getMeta(META.notDuplicates)) ?? "[]") as string[]));
        } catch {
          // ignore a damaged value; terms can be set again
        }
        const s = await repo.load();
        setSnapshot(s);
        setFocusId(s.homePersonId ?? s.persons[0]?.id);
        if (moved) setNotice(translate(l === "en" || l === "bm" ? l : defaultLang(), "migrated", { n: moved }));
      } catch (e) {
        setError(String((e as Error)?.message ?? e));
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Keep the focus on someone who exists
  useEffect(() => {
    if (!ready) return;
    if (!focusId || !graph.get(focusId)) setFocusId(snapshot.homePersonId ?? snapshot.persons[0]?.id);
  }, [ready, focusId, graph, snapshot]);

  const repo = () => repoRef.current!;

  const value: Store = {
    ready,
    error,
    graph,
    lang,
    t,
    setLang: (l) => {
      setLangState(l);
      repo().setMeta(META.language, l);
    },
    treeOptions,
    setTreeOptions: (o) => {
      // Mark "drawing" before the new tree is shown, so a crash is undone next launch
      repo()
        .setMeta(META.treeDrawing, "1")
        .finally(() => {
          setTreeOptionsState(o);
          repo().setMeta(META.treeUp, String(o.up));
          repo().setMeta(META.treeDown, String(o.down));
          repo().setMeta(META.treeAdd, o.showAdd ? "1" : "0");
          repo().setMeta(META.treeStyle, o.classic ? "classic" : "game");
        });
    },
    treeDrawn: () => {
      repo().setMeta(META.treeDrawing, undefined);
    },
    focusId,
    setFocus: setFocusId,
    homeId: snapshot.homePersonId,
    notice,
    clearNotice: () => setNotice(undefined),
    backupDue: shouldRemindBackup({
      people: snapshot.persons.length,
      changes: backupInfo.changes,
      lastBackup: backupInfo.last,
      snoozeUntil: backupInfo.snooze,
      now: new Date(),
    }),
    changesSinceBackup: backupInfo.changes,
    markBackedUp: () => {
      const last = new Date().toISOString();
      setBackupInfo({ changes: 0, last });
      repo().setMeta(META.lastBackup, last);
      repo().setMeta(META.changesSinceBackup, "0");
      repo().setMeta(META.backupSnooze, undefined);
    },
    snoozeBackup: () => {
      const snooze = new Date(Date.now() + SNOOZE_DAYS * 86400000).toISOString();
      setBackupInfo((b) => ({ ...b, snooze }));
      repo().setMeta(META.backupSnooze, snooze);
    },

    savePerson: async (p) => {
      await repo().savePerson({ ...p, updatedAt: nowIso() });
      await reload();
    },
    createPerson: async (p) => {
      await repo().savePerson(p);
      const s = await reload();
      if (!s.homePersonId) {
        await repo().setMeta(META.homePerson, p.id);
        await reload();
      }
      setFocusId(p.id);
    },
    setPhoto: async (p, source) => {
      const old = p.photo;
      const photo = source ? await savePhotoFrom(source.uri, p.id, source.mime) : undefined;
      if (old && old !== photo) await deletePhoto(old);
      return { ...p, photo };
    },
    deletePerson: async (id) => {
      const p = graph.get(id);
      await repo().deletePerson(id);
      if (p?.photo) await deletePhoto(p.photo);
      await reload();
    },
    addRelative: async (req) => {
      const id = await addRelativeAction(repo(), graph, req);
      await reload();
      return id;
    },
    removeParentLink: async (linkId) => {
      await repo().deleteLink(linkId);
      await reload();
    },
    linkParents: async (childId, fatherId, motherId) => {
      // Re-read so a person saved a moment ago is included
      for (const [role, id] of [
        ["father", fatherId],
        ["mother", motherId],
      ] as const) {
        if (!id) continue;
        const g = new FamilyGraph(await repo().load());
        if (g.parentLinksOf(childId).some((l) => l.parentId === id)) continue;
        await addRelativeAction(repo(), g, {
          role,
          of: childId,
          person: { id },
        });
      }
      await reload();
    },
    customTerms,
    setCustomTerm: async (key, term) => {
      const next = { ...customTerms };
      if (term.trim()) next[key] = term.trim();
      else delete next[key];
      setCustomTerms(next);
      await repo().setMeta(META.customTerms, JSON.stringify(next));
    },
    saveUnion: async (u) => {
      await repo().saveUnion(u);
      await reload();
    },
    removeUnion: async (id) => {
      await repo().deleteUnion(id);
      await reload();
    },
    setHome: async (id) => {
      await repo().setMeta(META.homePerson, id);
      await reload();
    },
    setFamilyName: async (name) => {
      await repo().setMeta(META.familyName, name.trim() || undefined);
      await reload();
    },
    backupText: async (opts = {}) => {
      const withPhotos = opts.photos ?? true;
      const data = prepareShare(snapshot, { hideLiving: !!opts.hideLiving });
      const photos: Record<string, string> = {};
      if (withPhotos) {
        for (const p of data.persons) {
          if (!p.photo) continue;
          const b64 = await readPhotoBase64(p.photo);
          if (b64) photos[p.photo] = b64;
        }
      }
      return JSON.stringify(
        buildBackup(data, photos, {
          photosIncluded: withPhotos,
          livingHidden: !!opts.hideLiving,
        }),
      );
    },
    peekBackup: (files) => parseRestore(files).parsed.data.persons.length,
    restore: async (files, mode = "replace") => {
      const { parsed, photos: photoCount } = parseRestore(files);
      let data = parsed.data;
      let added = data.persons.length;
      let updated = 0;
      let wanted: Set<string> | null = null;
      if (mode === "merge") {
        const m = mergeSnapshots(snapshot, data);
        data = m.snapshot;
        added = m.added;
        updated = m.updated;
        wanted = m.usePhotos;
      } else {
        // Replace: keep this phone's photo for anyone the file has no photo for, and keep
        // the home person and family name when the file doesn't set them (e.g. Excel)
        const mine = new Map(snapshot.persons.map((p) => [p.id, p]));
        for (const p of data.persons) if (!p.photo && mine.get(p.id)?.photo) p.photo = mine.get(p.id)!.photo;
        if (!data.homePersonId && snapshot.homePersonId && mine.has(snapshot.homePersonId) && data.persons.some((p) => p.id === snapshot.homePersonId))
          data.homePersonId = snapshot.homePersonId;
        if (!data.familyName) data.familyName = snapshot.familyName;
      }
      // Photos: write the ones the file carries; keep ones already on this phone; drop the rest
      for (const p of data.persons) {
        if (!p.photo) continue;
        const b64 = parsed.photos[p.photo];
        const take = !wanted || wanted.has(p.photo);
        if (take && b64 && (await writePhotoBase64(p.photo, b64))) continue;
        if (await photoExists(p.photo)) continue;
        p.photo = undefined;
      }
      if (Object.keys(parsed.legacyPhotos).length) await applyLegacyPhotos(data, parsed.legacyPhotos);
      await repo().replaceAll(data);
      const s = await reload();
      setFocusId(s.homePersonId ?? s.persons[0]?.id);
      return { total: data.persons.length, added, updated, photos: photoCount };
    },
    joinPersons: async (keepId, dropId) => {
      await repo().replaceAll(joinPersons(await repo().load(), keepId, dropId));
      const s = await reload();
      if (focusId === dropId) setFocusId(keepId);
      if (!s.persons.length) setFocusId(undefined);
    },
    notDuplicates,
    markNotDuplicate: async (a, b) => {
      const next = new Set(notDuplicates).add(pairKey(a, b));
      setNotDuplicates(next);
      await repo().setMeta(META.notDuplicates, JSON.stringify([...next]));
    },
    gedcom: (includeLiving) => toGedcom(snapshot, { includeLiving }),
    excelBase64: async (opts = {}) => {
      // Let the "Preparing the file…" spinner appear before the heavy work starts
      await new Promise((r) => setTimeout(r, 60));
      const d = new Date();
      const today = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      // Small photos for the Gambar tab (thumbnails keep the file easy to send)
      const photos: Record<string, { data: Uint8Array; ext: "jpeg"; width: number; height: number }> = {};
      if (opts.photos) {
        for (const p of snapshot.persons) {
          if (!p.photo) continue;
          const th = await photoThumbnail(p.photo);
          if (th)
            photos[p.id] = {
              data: fromBase64(th.base64),
              ext: "jpeg",
              width: th.width,
              height: th.height,
            };
        }
      }
      const sheets = buildFamilyWorkbook(graph, {
        lang,
        t,
        homeId: snapshot.homePersonId,
        customTerms,
        familyName: snapshot.familyName,
        today,
        photos,
      });
      return toBase64(buildXlsx(sheets));
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
