import type { FamilyGraph } from "./graph";
import type { TKey } from "./i18n";
import { type LinkKind, newId, nowIso, type Person, type Union } from "./model";
import type { Repo } from "./repo";

/** A rule was broken; `key` is a translation key shown to the user. */
export class RuleError extends Error {
  constructor(readonly key: TKey, readonly vars: Record<string, string> = {}) {
    super(key);
  }
}

export type Role = "father" | "mother" | "spouse" | "child" | "sibling";

export interface RelativeRequest {
  role: Role;
  /** The person we are adding a relative to */
  of: string;
  /** The relative: an existing person id, or a new person to create */
  person: { id: string } | { draft: Omit<Person, "id" | "createdAt" | "updatedAt"> } | { create: Person };
  /** For parent/child links */
  kind?: LinkKind;
  /** For a new child: the other parent (partner of `of`), or null for unknown */
  otherParentId?: string | null;
  /** For spouses */
  union?: Pick<Union, "status" | "startDate" | "endDate" | "place">;
}

export function makePerson(draft: Omit<Person, "id" | "createdAt" | "updatedAt">): Person {
  const t = nowIso();
  return { ...draft, id: newId(), createdAt: t, updatedAt: t };
}

/** Throws RuleError if `parent` can't become a parent of `child`. */
export function checkParent(graph: FamilyGraph, parent: Person, childId: string, kind: LinkKind) {
  const child = graph.get(childId)!;
  if (parent.id === childId || graph.isAncestor(childId, parent.id)) throw new RuleError("wouldLoop");
  const links = graph.parentLinksOf(childId);
  if (links.some((l) => l.parentId === parent.id)) throw new RuleError("alreadyLinked");
  if (kind === "birth") {
    const clash = links.some((l) => l.kind === "birth" && graph.get(l.parentId)!.sex === parent.sex);
    if (clash) throw new RuleError(parent.sex === "male" ? "alreadyHasFather" : "alreadyHasMother", { name: child.givenName });
  }
}

/**
 * Adds a father, mother, spouse, child or sibling to `req.of`, creating the person if needed.
 * Returns the id of the relative.
 */
export async function addRelative(repo: Repo, graph: FamilyGraph, req: RelativeRequest): Promise<string> {
  const base = graph.get(req.of);
  if (!base) throw new RuleError("somethingWrong", { msg: "person not found" });
  const kind = req.kind ?? "birth";
  const isNew = !("id" in req.person);
  const rel: Person | undefined =
    "draft" in req.person ? makePerson(req.person.draft) : "create" in req.person ? req.person.create : graph.get(req.person.id);
  if (!rel) throw new RuleError("somethingWrong", { msg: "person not found" });
  if (rel.id === base.id) throw new RuleError("wouldLoop");

  const link = (parentId: string, childId: string, k: LinkKind = kind) =>
    repo.saveLink({ id: newId(), parentId, childId, kind: k });
  const marry = async (a: string, b: string, u?: RelativeRequest["union"]) => {
    if (graph.unionBetween(a, b)) return;
    const order = Math.max(graph.unions(a).length, graph.unions(b).length);
    await repo.saveUnion({ id: newId(), partnerA: a, partnerB: b, status: u?.status ?? "married", startDate: u?.startDate, endDate: u?.endDate, place: u?.place, sortOrder: order });
  };

  switch (req.role) {
    case "father":
    case "mother": {
      if (!isNew) checkParent(graph, rel, base.id, kind);
      else checkParent(graph, { ...rel, id: "__new__" }, base.id, kind);
      if (isNew) await repo.savePerson(rel);
      await link(rel.id, base.id);
      // Parents of the same child are usually a couple: record the marriage too
      if (kind === "birth") {
        const other = req.role === "father" ? graph.mother(base.id) : graph.father(base.id);
        if (other && !graph.unionBetween(rel.id, other.id)) await marry(rel.id, other.id);
      }
      break;
    }
    case "spouse": {
      if (!isNew && graph.unionBetween(base.id, rel.id)) throw new RuleError("alreadyLinked");
      if (isNew) await repo.savePerson(rel);
      await marry(base.id, rel.id, req.union);
      break;
    }
    case "child": {
      const other = req.otherParentId ? graph.get(req.otherParentId) : undefined;
      if (!isNew) {
        checkParent(graph, base, rel.id, kind);
        if (other) checkParent(graph, other, rel.id, kind);
      }
      if (isNew) await repo.savePerson(rel);
      await link(base.id, rel.id);
      if (other) await link(other.id, rel.id);
      break;
    }
    case "sibling": {
      const parents = graph.parentLinksOf(base.id).filter((l) => l.kind === "birth" || l.kind === "adopted");
      if (parents.length === 0) throw new RuleError("addFirstParents");
      if (!isNew) for (const l of parents) checkParent(graph, graph.get(l.parentId)!, rel.id, l.kind);
      if (isNew) await repo.savePerson(rel);
      for (const l of parents) await link(l.parentId, rel.id, l.kind);
      break;
    }
  }
  return rel.id;
}

/** Suggested bin/binti for a new child: the father's given name. */
export function suggestFatherName(graph: FamilyGraph, req: Pick<RelativeRequest, "role" | "of" | "otherParentId">): string | undefined {
  const base = graph.get(req.of);
  if (!base) return undefined;
  if (req.role === "child") {
    if (base.sex === "male") return base.givenName;
    const other = req.otherParentId ? graph.get(req.otherParentId) : undefined;
    return other?.sex === "male" ? other.givenName : undefined;
  }
  if (req.role === "sibling") return base.fatherName ?? graph.father(base.id)?.givenName;
  return undefined;
}
