import type { FamilyGraph } from "./graph";
import type { Person, Sex } from "./model";

/**
 * Lays out the "family view" around one focus person:
 *   - ancestor couples above (father's side left, mother's side right)
 *   - the focus person with their spouses in the middle row
 *   - children (each with their spouse) below, optionally grandchildren
 * Coordinates are in canvas pixels; the canvas pans and zooms over them.
 */

export const HALF_W = 104;
export const CARD_H = 140;
export const FOCUS_W = 124;
export const FOCUS_H = 170;
const GAP_X = 18; // between couples
const ROW_GAP = 64; // vertical space between rows (room for connector lines)
const PAD = 60;

export type AddRole = "father" | "mother" | "spouse";

export interface Card {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  person?: Person;
  /** For "Add father / mother / spouse" placeholders */
  add?: { role: AddRole; of: string; sex: Sex };
  focus?: boolean;
  /** Descendants not shown: `hidden` because the branch is collapsed, `more` because they are below the generations shown */
  hidden?: number;
  more?: number;
  /** Where the branch button sits (below the couple), when this person has children; `open` when they are drawn */
  chip?: { x: number; y: number; open: boolean };
}

/** Background frame grouping the two halves of a couple. */
export interface Frame {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Line {
  key: string;
  points: number[]; // x1,y1,x2,y2,...
}

export interface TreeLayout {
  cards: Card[];
  frames: Frame[];
  lines: Line[];
  /** The same connections as whole parent-to-child paths, for drawing smooth curved corners */
  curves: number[][];
  width: number;
  height: number;
  focusX: number;
  focusY: number;
}

export interface LayoutOptions {
  /** Generations of ancestors to show above the focus person (1-6) */
  up: number;
  /** Generations of descendants to show below (0-3) */
  down: number;
  /** Show "Add father / mother / spouse" placeholders */
  showAdd: boolean;
  /** People whose children are folded away ("+N" on their card) */
  collapsed?: string[];
  /** Draw the original (plain views) tree instead of the game-style one */
  classic?: boolean;
  /** Tree screen background template (lib/backgrounds.ts) */
  background?: string;
}

export const DEFAULT_OPTIONS: LayoutOptions = { up: 3, down: 2, showAdd: true };

interface UpNode {
  childId: string;
  father?: Person;
  mother?: Person;
  fatherUp?: UpNode;
  motherUp?: UpNode;
  width: number;
}

interface DownNode {
  hidden?: number;
  more?: number;
  person: Person;
  partner?: Person;
  addSpouse: boolean;
  kids: DownNode[];
  width: number;
}

const COUPLE_W = HALF_W * 2;

export function layoutTree(graph: FamilyGraph, focusId: string, opts: LayoutOptions = DEFAULT_OPTIONS): TreeLayout | null {
  const focus = graph.get(focusId);
  if (!focus) return null;
  const collapsed = new Set(opts.collapsed ?? []);
  const cards: Card[] = [];
  const frames: Frame[] = [];
  const lines: Line[] = [];
  const curves: number[][] = [];

  // ---------- Middle row: focus + partners (spouses and other co-parents) ----------
  const partnerIds: string[] = graph.partners(focusId).map((p) => p.id);
  for (const c of graph.children(focusId)) {
    for (const l of graph.parentLinksOf(c.id)) {
      if (l.parentId !== focusId && !partnerIds.includes(l.parentId)) partnerIds.push(l.parentId);
    }
  }
  const partners = partnerIds.map((id) => graph.get(id)!);

  const focusCard: Card = {
    key: "focus",
    x: -FOCUS_W / 2,
    y: 0,
    w: FOCUS_W,
    h: FOCUS_H,
    person: focus,
    focus: true,
  };
  cards.push(focusCard);
  frames.push({ key: "f-focus", x: focusCard.x, y: 0, w: FOCUS_W, h: FOCUS_H });
  const rowTop = FOCUS_H - CARD_H; // partner cards align to the bottom of the focus card
  let px = FOCUS_W / 2 + 12;
  const partnerCards: Card[] = [];
  for (const p of partners) {
    const c: Card = {
      key: `partner-${p.id}`,
      x: px,
      y: rowTop,
      w: HALF_W,
      h: CARD_H,
      person: p,
    };
    partnerCards.push(c);
    cards.push(c);
    frames.push({
      key: `f-partner-${p.id}`,
      x: px,
      y: rowTop,
      w: HALF_W,
      h: CARD_H,
    });
    px += HALF_W + 10;
  }
  if (partners.length === 0 && opts.showAdd) {
    const c: Card = {
      key: "add-spouse-focus",
      x: px,
      y: rowTop,
      w: HALF_W,
      h: CARD_H,
      add: { role: "spouse", of: focusId, sex: opposite(focus.sex) },
    };
    cards.push(c);
    frames.push({
      key: "f-add-spouse-focus",
      x: px,
      y: rowTop,
      w: HALF_W,
      h: CARD_H,
    });
  }

  // ---------- Ancestors ----------
  const buildUp = (childId: string, gen: number): UpNode | undefined => {
    if (gen > opts.up) return undefined;
    const father = graph.father(childId);
    const mother = graph.mother(childId);
    if (!father && !mother && !opts.showAdd) return undefined;
    const node: UpNode = { childId, father, mother, width: 0 };
    if (father) node.fatherUp = buildUp(father.id, gen + 1);
    if (mother) node.motherUp = buildUp(mother.id, gen + 1);
    const self = father || mother || opts.showAdd ? COUPLE_W : HALF_W;
    const inner = (node.fatherUp?.width ?? 0) + (node.motherUp?.width ?? 0) + (node.fatherUp && node.motherUp ? GAP_X : 0);
    node.width = Math.max(self, inner);
    return node;
  };

  /** Places an ancestor couple; returns the x of the father half / mother half centers. */
  const placeUp = (node: UpNode, left: number, gen: number, targetX: number, targetY: number, path: string) => {
    const y = -gen * (CARD_H + ROW_GAP);
    const cx = left + node.width / 2;
    const both = opts.showAdd || (!!node.father && !!node.mother);
    const w = both ? COUPLE_W : HALF_W;
    const x0 = cx - w / 2;
    const motherX = both ? x0 + HALF_W : x0;
    frames.push({ key: `f-${path}`, x: x0, y, w, h: CARD_H });
    const half = (p: Person | undefined, role: "father" | "mother", x: number): Card => {
      if (p)
        return {
          key: `${path}-${role}`,
          x,
          y,
          w: HALF_W,
          h: CARD_H,
          person: p,
        };
      return {
        key: `${path}-add-${role}`,
        x,
        y,
        w: HALF_W,
        h: CARD_H,
        add: {
          role,
          of: node.childId,
          sex: role === "father" ? "male" : "female",
        },
      };
    };
    if (node.father || opts.showAdd) cards.push(half(node.father, "father", x0));
    if (node.mother || opts.showAdd) cards.push(half(node.mother, "mother", motherX));
    // connector from couple down to the child
    const bottom = y + CARD_H;
    const midY = bottom + ROW_GAP / 2;
    lines.push({
      key: `l-${path}`,
      points: [cx, bottom, cx, midY, targetX, midY, targetX, targetY],
    });
    curves.push([cx, bottom, cx, midY, targetX, midY, targetX, targetY]);

    const inner = (node.fatherUp?.width ?? 0) + (node.motherUp?.width ?? 0) + (node.fatherUp && node.motherUp ? GAP_X : 0);
    let off = left + (node.width - inner) / 2;
    if (node.fatherUp) {
      placeUp(node.fatherUp, off, gen + 1, x0 + HALF_W / 2, y, `${path}F`);
      off += node.fatherUp.width + GAP_X;
    }
    if (node.motherUp) placeUp(node.motherUp, off, gen + 1, motherX + HALF_W / 2, y, `${path}M`);
  };

  const root = opts.up > 0 ? buildUp(focusId, 1) : undefined;
  if (root) placeUp(root, -root.width / 2, 1, 0, 0, "up");

  // ---------- Descendants ----------
  const buildDown = (person: Person, gen: number, seen: Set<string>): DownNode => {
    const partner = graph.partners(person.id)[0];
    const addSpouse = !partner && opts.showAdd;
    const ownKids = graph.children(person.id).filter((k) => !seen.has(k.id));
    const isCollapsed = collapsed.has(person.id) && ownKids.length > 0;
    const kids = gen < opts.down && !isCollapsed ? ownKids.map((k) => buildDown(k, gen + 1, new Set([...seen, k.id]))) : [];
    const self = partner || addSpouse ? COUPLE_W : HALF_W;
    const inner = kids.reduce((s, k) => s + k.width, 0) + Math.max(0, kids.length - 1) * GAP_X;
    const below = ownKids.length && !kids.length ? countDescendants(graph, person.id) : 0;
    return {
      person,
      partner,
      addSpouse,
      kids,
      width: Math.max(self, inner),
      hidden: isCollapsed ? below : undefined,
      more: !isCollapsed && below ? below : undefined,
    };
  };

  const placeDown = (node: DownNode, left: number, y: number, path: string): { x: number; y: number } => {
    const self = node.partner || node.addSpouse ? COUPLE_W : HALF_W;
    const x0 = left + (node.width - self) / 2;
    frames.push({ key: `f-${path}`, x: x0, y, w: self, h: CARD_H });
    cards.push({
      key: `${path}-p`,
      x: x0,
      y,
      w: HALF_W,
      h: CARD_H,
      person: node.person,
      hidden: node.hidden,
      more: node.more,
      chip: node.kids.length || node.hidden || node.more ? { x: x0 + self / 2, y: y + CARD_H, open: node.kids.length > 0 } : undefined,
    });
    if (node.partner)
      cards.push({
        key: `${path}-s`,
        x: x0 + HALF_W,
        y,
        w: HALF_W,
        h: CARD_H,
        person: node.partner,
      });
    else if (node.addSpouse)
      cards.push({
        key: `${path}-add`,
        x: x0 + HALF_W,
        y,
        w: HALF_W,
        h: CARD_H,
        add: {
          role: "spouse",
          of: node.person.id,
          sex: opposite(node.person.sex),
        },
      });
    if (node.kids.length) {
      const fromX = x0 + self / 2;
      const fromY = y + CARD_H;
      placeKids(node.kids, left + (node.width - kidsWidth(node.kids)) / 2, y + CARD_H + ROW_GAP, fromX, fromY, path);
    }
    return { x: x0 + HALF_W / 2, y };
  };

  const kidsWidth = (kids: DownNode[]) => kids.reduce((s, k) => s + k.width, 0) + Math.max(0, kids.length - 1) * GAP_X;

  const placeKids = (kids: DownNode[], left: number, y: number, fromX: number, fromY: number, path: string) => {
    const busY = y - ROW_GAP / 2;
    const tops: number[] = [];
    let off = left;
    kids.forEach((k, i) => {
      const top = placeDown(k, off, y, `${path}-${i}`);
      tops.push(top.x);
      off += k.width + GAP_X;
    });
    lines.push({ key: `l-${path}-stem`, points: [fromX, fromY, fromX, busY] });
    const minX = Math.min(fromX, ...tops);
    const maxX = Math.max(fromX, ...tops);
    lines.push({ key: `l-${path}-bus`, points: [minX, busY, maxX, busY] });
    tops.forEach((x, i) => {
      lines.push({ key: `l-${path}-k${i}`, points: [x, busY, x, y] });
      curves.push([fromX, fromY, fromX, busY, x, busY, x, y]);
    });
  };

  if (opts.down > 0) {
    const groups: { from: Card | null; kids: DownNode[] }[] = [];
    const seen = new Set([focusId]);
    partners.forEach((p, i) => {
      const kids = graph.childrenWith(focusId, p.id).map((k) => buildDown(k, 1, new Set([...seen, k.id])));
      if (kids.length) groups.push({ from: partnerCards[i], kids });
    });
    const solo = graph.childrenWith(focusId, null).map((k) => buildDown(k, 1, new Set([...seen, k.id])));
    if (solo.length) groups.push({ from: null, kids: solo });

    if (groups.length) {
      const total = groups.reduce((s, gr) => s + kidsWidth(gr.kids), 0) + (groups.length - 1) * GAP_X * 2;
      const rowRight = partnerCards.length ? partnerCards[partnerCards.length - 1].x + HALF_W : FOCUS_W / 2;
      const center = (-FOCUS_W / 2 + rowRight) / 2;
      let left = center - total / 2;
      const y = FOCUS_H + ROW_GAP + 10;
      groups.forEach((gr, gi) => {
        let fromX = 0;
        const fromY = FOCUS_H + 10 + gi * 6;
        if (gr.from) {
          const pc = gr.from.x + HALF_W / 2;
          fromX = (0 + pc) / 2;
          // join the two parents under their cards
          lines.push({
            key: `l-join-${gi}`,
            points: [0, FOCUS_H, 0, fromY, pc, fromY, pc, gr.from.y + CARD_H],
          });
          curves.push([0, FOCUS_H, 0, fromY, fromX, fromY], [pc, gr.from.y + CARD_H, pc, fromY, fromX, fromY]);
        } else {
          lines.push({ key: `l-join-${gi}`, points: [0, FOCUS_H, 0, fromY] });
          curves.push([0, FOCUS_H, 0, fromY]);
        }
        placeKids(gr.kids, left, y, fromX, fromY, `down${gi}`);
        left += kidsWidth(gr.kids) + GAP_X * 2;
      });
    }
  }

  // ---------- Normalise to positive coordinates ----------
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const b of [...cards, ...frames]) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  const dx = PAD - minX;
  const dy = PAD - minY;
  for (const b of [...cards, ...frames]) {
    b.x += dx;
    b.y += dy;
  }
  const shift = (pts: number[]) => pts.map((v, i) => (i % 2 === 0 ? v + dx : v + dy));
  for (const l of lines) l.points = shift(l.points);
  for (let i = 0; i < curves.length; i++) curves[i] = shift(curves[i]);

  return {
    cards,
    frames,
    lines,
    curves,
    width: maxX - minX + PAD * 2,
    height: maxY - minY + PAD * 2,
    focusX: dx,
    focusY: dy + FOCUS_H / 2,
  };
}

function opposite(sex: Sex): Sex {
  return sex === "male" ? "female" : "male";
}

/**
 * A connector line as straight horizontal/vertical bars (x, y, width, height), so the
 * tree can draw them as plain views. A single SVG the size of the whole tree is drawn
 * into one bitmap on Android, which runs out of memory on wide trees.
 */
export function lineBars(line: Line, thickness: number): { x: number; y: number; w: number; h: number }[] {
  const out: { x: number; y: number; w: number; h: number }[] = [];
  const t = thickness / 2;
  const p = line.points;
  const bar = (x1: number, y1: number, x2: number, y2: number) => {
    if (y1 === y2 && x1 === x2) return;
    if (y1 === y2)
      out.push({
        x: Math.min(x1, x2) - t,
        y: y1 - t,
        w: Math.abs(x2 - x1) + thickness,
        h: thickness,
      });
    else if (x1 === x2)
      out.push({
        x: x1 - t,
        y: Math.min(y1, y2) - t,
        w: thickness,
        h: Math.abs(y2 - y1) + thickness,
      });
    else {
      // not expected from the layout; draw as an elbow
      bar(x1, y1, x2, y1);
      bar(x2, y1, x2, y2);
    }
  };
  for (let i = 0; i + 3 < p.length; i += 2) bar(p[i], p[i + 1], p[i + 2], p[i + 3]);
  return out;
}

/** Everyone below a person (each counted once). */
export function countDescendants(graph: FamilyGraph, id: string): number {
  const seen = new Set([id]);
  const stack = [id];
  while (stack.length) {
    for (const l of graph.childLinksOf(stack.pop()!)) {
      if (seen.has(l.childId)) continue;
      seen.add(l.childId);
      stack.push(l.childId);
    }
  }
  return seen.size - 1;
}
