import { sortKey } from "./dates";
import type { FamilySnapshot, ParentLink, Person, Union } from "./model";

/**
 * Read-only index over a family snapshot. Built once per change and shared by the
 * tree layout, profile screen and relationship finder.
 */
export class FamilyGraph {
  readonly persons = new Map<string, Person>();
  private parentLinks = new Map<string, ParentLink[]>(); // childId -> links to parents
  private childLinks = new Map<string, ParentLink[]>(); // parentId -> links to children
  private unionsOf = new Map<string, Union[]>();

  constructor(readonly snapshot: FamilySnapshot) {
    for (const p of snapshot.persons) this.persons.set(p.id, p);
    for (const l of snapshot.links) {
      if (!this.persons.has(l.parentId) || !this.persons.has(l.childId)) continue;
      push(this.parentLinks, l.childId, l);
      push(this.childLinks, l.parentId, l);
    }
    for (const u of snapshot.unions) {
      if (!this.persons.has(u.partnerA) || !this.persons.has(u.partnerB)) continue;
      push(this.unionsOf, u.partnerA, u);
      push(this.unionsOf, u.partnerB, u);
    }
    for (const list of this.unionsOf.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder || sortKey(a.startDate).localeCompare(sortKey(b.startDate)));
    }
  }

  get(id: string | undefined): Person | undefined {
    return id ? this.persons.get(id) : undefined;
  }

  get size(): number {
    return this.persons.size;
  }

  parentLinksOf(childId: string): ParentLink[] {
    return this.parentLinks.get(childId) ?? [];
  }

  parents(childId: string): Person[] {
    return this.parentLinksOf(childId).map((l) => this.persons.get(l.parentId)!);
  }

  /** The father / mother shown in the tree. Birth parents win over adoptive or step parents. */
  father(childId: string): Person | undefined {
    return this.pickParent(childId, "male");
  }

  mother(childId: string): Person | undefined {
    return this.pickParent(childId, "female");
  }

  private pickParent(childId: string, sex: Person["sex"]): Person | undefined {
    const rank = { birth: 0, adopted: 1, foster: 2, step: 3, milk: 4 } as const;
    const links = this.parentLinksOf(childId)
      .filter((l) => this.persons.get(l.parentId)!.sex === sex)
      .sort((a, b) => rank[a.kind] - rank[b.kind]);
    return links.length ? this.persons.get(links[0].parentId) : undefined;
  }

  childLinksOf(parentId: string): ParentLink[] {
    return this.childLinks.get(parentId) ?? [];
  }

  /** Children sorted oldest first. */
  children(parentId: string): Person[] {
    return byBirth(this.childLinksOf(parentId).map((l) => this.persons.get(l.childId)!));
  }

  unions(personId: string): Union[] {
    return this.unionsOf.get(personId) ?? [];
  }

  partnerOf(u: Union, personId: string): Person {
    return this.persons.get(u.partnerA === personId ? u.partnerB : u.partnerA)!;
  }

  partners(personId: string): Person[] {
    return this.unions(personId).map((u) => this.partnerOf(u, personId));
  }

  unionBetween(a: string, b: string): Union | undefined {
    return this.unions(a).find((u) => u.partnerA === b || u.partnerB === b);
  }

  /** Children this person had with a given partner (or with no recorded other parent when partnerId is null). */
  childrenWith(personId: string, partnerId: string | null): Person[] {
    return this.children(personId).filter((c) => {
      const others = this.parentLinksOf(c.id).map((l) => l.parentId).filter((id) => id !== personId);
      return partnerId === null ? others.length === 0 : others.includes(partnerId);
    });
  }

  /** Brothers and sisters, oldest first, marked full or half. */
  siblings(personId: string): { person: Person; half: boolean }[] {
    const mine = new Set(this.parentLinksOf(personId).map((l) => l.parentId));
    if (mine.size === 0) return [];
    const seen = new Map<string, Set<string>>();
    for (const pid of mine) {
      for (const l of this.childLinksOf(pid)) {
        if (l.childId === personId) continue;
        if (!seen.has(l.childId)) seen.set(l.childId, new Set());
        seen.get(l.childId)!.add(pid);
      }
    }
    const list = [...seen.entries()].map(([id, shared]) => {
      const theirs = new Set(this.parentLinksOf(id).map((l) => l.parentId));
      const half = shared.size < Math.max(mine.size, theirs.size);
      return { person: this.persons.get(id)!, half };
    });
    return list.sort((a, b) => sortKey(a.person.birthDate).localeCompare(sortKey(b.person.birthDate)));
  }

  /** True when `ancestorId` is a parent, grandparent ... of `personId`. */
  isAncestor(ancestorId: string, personId: string): boolean {
    const stack = [personId];
    const seen = new Set<string>();
    while (stack.length) {
      const id = stack.pop()!;
      for (const l of this.parentLinksOf(id)) {
        if (l.parentId === ancestorId) return true;
        if (!seen.has(l.parentId)) {
          seen.add(l.parentId);
          stack.push(l.parentId);
        }
      }
    }
    return false;
  }

  /** Every ancestor with the smallest number of generations up to it. */
  ancestorDepths(personId: string): Map<string, number> {
    const depth = new Map<string, number>([[personId, 0]]);
    let frontier = [personId];
    while (frontier.length) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const l of this.parentLinksOf(id)) {
          // Step and milk (susuan) parents are named separately, not traced as lineage
          if (l.kind === "step" || l.kind === "milk") continue;
          if (!depth.has(l.parentId)) {
            depth.set(l.parentId, depth.get(id)! + 1);
            next.push(l.parentId);
          }
        }
      }
      frontier = next;
    }
    return depth;
  }

  /**
   * Descendants grouped by generation: [children, grandchildren, great-grandchildren, ...].
   * Each person is counted once, at their closest generation (cousin marriages can reach
   * someone twice). By default only birth children are followed.
   */
  descendantsByGeneration(personId: string, opts: { includeNonBirth?: boolean } = {}): Person[][] {
    const seen = new Set([personId]);
    const out: Person[][] = [];
    let frontier = [personId];
    while (frontier.length) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const l of this.childLinksOf(id)) {
          if (!opts.includeNonBirth && l.kind !== "birth") continue;
          if (seen.has(l.childId)) continue;
          seen.add(l.childId);
          next.push(l.childId);
        }
      }
      if (next.length) out.push(byBirth(next.map((id) => this.persons.get(id)!)));
      frontier = next;
    }
    return out;
  }

  /** Number of people connected to `personId` through any relationship. */
  connectedCount(personId: string): number {
    const seen = new Set([personId]);
    const stack = [personId];
    while (stack.length) {
      const id = stack.pop()!;
      const next = [
        ...this.parentLinksOf(id).map((l) => l.parentId),
        ...this.childLinksOf(id).map((l) => l.childId),
        ...this.partners(id).map((p) => p.id),
      ];
      for (const n of next) {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    return seen.size;
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function byBirth(list: Person[]): Person[] {
  return [...list].sort((a, b) => sortKey(a.birthDate).localeCompare(sortKey(b.birthDate)) || a.createdAt.localeCompare(b.createdAt));
}
