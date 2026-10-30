import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { addRelative as addRelativeAction, type RelativeRequest } from "./actions";
import { buildBackup, parseBackupFiles } from "./backup";
import { deletePhoto, readPhotoBase64, savePhotoFrom, writePhotoBase64 } from "./files";
import { toGedcom } from "./gedcom";
import { FamilyGraph } from "./graph";
import { defaultLang, type Lang, translate, type TKey } from "./i18n";
import { DEFAULT_OPTIONS, type LayoutOptions } from "./layout";
import { convertLegacy, LEGACY_KEY, type LegacyData } from "./legacy";
import { type FamilySnapshot, nowIso, type Person, type Union } from "./model";
import { openRepo } from "./open-repo";
import { META, type Repo } from "./repo";

const EMPTY: FamilySnapshot = { persons: [], unions: [], links: [], familyName: "" };

interface Store {
  ready: boolean;
  error?: string;
  graph: FamilyGraph;
  lang: Lang;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  setLang: (l: Lang) => void;
  treeOptions: LayoutOptions;
  setTreeOptions: (o: LayoutOptions) => void;
  /** Person in the middle of the tree view */
  focusId?: string;
  setFocus: (id: string) => void;
  homeId?: string;
  /** One-time message to show (e.g. after moving old data) */
  notice?: string;
  clearNotice: () => void;

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
  backupText: () => Promise<string>;
  /** Restore from a Waris JSON backup or the old app's CSV files */
  restore: (texts: string[]) => Promise<number>;
  peekBackup: (texts: string[]) => number;
  gedcom: (includeLiving: boolean) => string;
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

  const t = useCallback((key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  const graph = useMemo(() => new FamilyGraph(snapshot), [snapshot]);

  const reload = useCallback(async () => {
    const s = await repoRef.current!.load();
    setSnapshot(s);
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
        const up = await repo.getMeta(META.treeUp);
        const down = await repo.getMeta(META.treeDown);
        setTreeOptionsState({
          up: up ? Number(up) : DEFAULT_OPTIONS.up,
          down: down ? Number(down) : DEFAULT_OPTIONS.down,
          showAdd: (await repo.getMeta(META.treeAdd)) !== "0",
        });
        try {
          setCustomTerms(JSON.parse((await repo.getMeta(META.customTerms)) ?? "{}"));
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
      setTreeOptionsState(o);
      repo().setMeta(META.treeUp, String(o.up));
      repo().setMeta(META.treeDown, String(o.down));
      repo().setMeta(META.treeAdd, o.showAdd ? "1" : "0");
    },
    focusId,
    setFocus: setFocusId,
    homeId: snapshot.homePersonId,
    notice,
    clearNotice: () => setNotice(undefined),

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
      for (const [role, id] of [["father", fatherId], ["mother", motherId]] as const) {
        if (!id) continue;
        const g = new FamilyGraph(await repo().load());
        if (g.parentLinksOf(childId).some((l) => l.parentId === id)) continue;
        await addRelativeAction(repo(), g, { role, of: childId, person: { id } });
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
    backupText: async () => {
      const photos: Record<string, string> = {};
      for (const p of snapshot.persons) {
        if (!p.photo) continue;
        const b64 = await readPhotoBase64(p.photo);
        if (b64) photos[p.photo] = b64;
      }
      return JSON.stringify(buildBackup(snapshot, photos));
    },
    peekBackup: (texts) => parseBackupFiles(texts).data.persons.length,
    restore: async (texts) => {
      const parsed = parseBackupFiles(texts);
      const data = parsed.data;
      for (const p of data.persons) {
        if (!p.photo) continue;
        const b64 = parsed.photos[p.photo];
        if (!b64 || !(await writePhotoBase64(p.photo, b64))) p.photo = undefined;
      }
      if (Object.keys(parsed.legacyPhotos).length) await applyLegacyPhotos(data, parsed.legacyPhotos);
      await repo().replaceAll(data);
      const s = await reload();
      setFocusId(s.homePersonId ?? s.persons[0]?.id);
      return data.persons.length;
    },
    gedcom: (includeLiving) => toGedcom(snapshot, { includeLiving }),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
