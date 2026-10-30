import { sortKey } from "./dates";
import type { FamilyGraph } from "./graph";
import type { Person } from "./model";

export interface PrintOptions {
  startId: string;
  /** Generations above the start person (0 = start person's own generation) */
  up: number;
  /** Generations below the start person (Infinity = all) */
  down: number;
  /** Everyone descended from the top ancestors (siblings, cousins ...), not only the direct line */
  relatives: boolean;
  order: "top" | "bottom";
}

/** People to print, grouped by generation (relative to the start person: -2 = grandparents). */
export function printGroups(graph: FamilyGraph, o: PrintOptions): { gen: number; people: Person[] }[] {
  const start = graph.get(o.startId);
  if (!start) return [];
  const gen = new Map<string, number>();

  // Ancestors up to `up` generations (birth and adoptive lines, as in the tree)
  const anc = graph.ancestorDepths(start.id);
  for (const [id, d] of anc) if (d <= o.up) gen.set(id, -d);

  const lineage = (childId: string) => graph.childLinksOf(childId).filter((l) => l.kind === "birth" || l.kind === "adopted");

  if (o.relatives) {
    // From each top-most included ancestor, take every descendant down to the limit
    const roots = [...gen.keys()].filter((id) => !graph.parentLinksOf(id).some((l) => gen.has(l.parentId)));
    // Walk down from the roots; people on the direct line already have a generation but
    // still need their own children visited
    const visited = new Set(roots);
    let frontier = roots;
    while (frontier.length) {
      const next: string[] = [];
      for (const id of frontier) {
        const g = gen.get(id)! + 1;
        if (g > o.down) continue;
        for (const l of lineage(id)) {
          if (visited.has(l.childId)) continue;
          visited.add(l.childId);
          if (!gen.has(l.childId)) gen.set(l.childId, g);
          next.push(l.childId);
        }
      }
      frontier = next;
    }
  } else {
    // Direct line: the start person's own descendants
    let frontier = [start.id];
    for (let g = 1; g <= o.down && frontier.length; g++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const l of lineage(id)) {
          if (gen.has(l.childId)) continue;
          gen.set(l.childId, g);
          next.push(l.childId);
        }
      }
      frontier = next;
    }
  }

  const byGen = new Map<number, Person[]>();
  for (const [id, g] of gen) {
    const list = byGen.get(g);
    const p = graph.get(id)!;
    if (list) list.push(p);
    else byGen.set(g, [p]);
  }
  const groups = [...byGen.entries()].map(([g, people]) => ({
    gen: g,
    people: people.sort((a, b) => sortKey(a.birthDate).localeCompare(sortKey(b.birthDate)) || a.givenName.localeCompare(b.givenName)),
  }));
  return groups.sort((a, b) => (o.order === "top" ? a.gen - b.gen : b.gen - a.gen));
}

export interface PrintRow {
  name: string;
  relation: string;
  born: string;
  died: string;
  spouses: string;
  descendants: string;
  living: boolean;
}

export interface PrintLabels {
  title: string;
  subtitle: string;
  footer: string;
  cols: { no: string; name: string; relation: string; born: string; died: string; spouse: string; desc: string };
  showSpouses: boolean;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A4 landscape HTML table, one section per generation, ready for expo-print. */
export function printHtml(groups: { label: string; rows: PrintRow[] }[], l: PrintLabels): string {
  let n = 0;
  const head = `<tr><th class="no">${esc(l.cols.no)}</th><th>${esc(l.cols.name)}</th><th>${esc(l.cols.relation)}</th><th>${esc(l.cols.born)}</th><th>${esc(l.cols.died)}</th>${l.showSpouses ? `<th>${esc(l.cols.spouse)}</th>` : ""}<th class="num">${esc(l.cols.desc)}</th></tr>`;
  const body = groups
    .map(
      (g) =>
        `<tr class="gen"><td colspan="${l.showSpouses ? 7 : 6}">${esc(g.label)}</td></tr>` +
        g.rows
          .map(
            (r) =>
              `<tr><td class="no">${++n}</td><td class="name">${esc(r.name)}${r.living ? "" : ' <span class="dec">✿</span>'}</td><td>${esc(r.relation)}</td><td>${esc(r.born)}</td><td>${esc(r.died)}</td>${l.showSpouses ? `<td>${esc(r.spouses)}</td>` : ""}<td class="num">${esc(r.descendants)}</td></tr>`,
          )
          .join(""),
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
@page { size: A4 landscape; margin: 14mm 12mm; }
body { font-family: -apple-system, Roboto, "Segoe UI", sans-serif; color: #1d1d1d; font-size: 10.5pt; }
h1 { font-size: 18pt; margin: 0 0 2px; color: #1B6B4A; }
.sub { color: #555; margin-bottom: 10px; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
th { background: #1B6B4A; color: #fff; text-align: left; padding: 5px 6px; font-weight: 600; font-size: 9.5pt; }
td { padding: 4px 6px; border-bottom: 1px solid #ddd; vertical-align: top; }
tr { page-break-inside: avoid; }
tr.gen td { background: #EAF3EE; font-weight: 700; color: #1B6B4A; border-bottom: 1px solid #B9D6C5; padding-top: 7px; }
.no { width: 28px; text-align: right; color: #777; }
.num { text-align: right; }
.name { font-weight: 600; }
.dec { color: #888; font-weight: 400; }
.foot { margin-top: 10px; color: #888; font-size: 8.5pt; }
</style></head><body>
<h1>${esc(l.title)}</h1><div class="sub">${esc(l.subtitle)}</div>
<table><thead>${head}</thead><tbody>${body}</tbody></table>
<div class="foot">✿ = ${esc(l.footer)}</div>
</body></html>`;
}
