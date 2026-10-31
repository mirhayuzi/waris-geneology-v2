import type { Card, TreeLayout } from "./layout";
import { cardName, type Person } from "./model";

/**
 * The family tree as one printable page (PDF): the tree drawn as SVG inside a certificate
 * frame ("Sijil Salasilah"), scaled to fit an A4 or A3 landscape page.
 */
export type PaperSize = "a4" | "a3";

export const PAPER: Record<PaperSize, { w: number; h: number; css: string }> = {
  a4: { w: 842, h: 595, css: "A4 landscape" },
  a3: { w: 1191, h: 842, css: "A3 landscape" },
};

export interface ChartLabels {
  /** Small caps line at the top, e.g. "SIJIL SALASILAH" */
  kicker: string;
  /** e.g. "Keturunan Tiajar binti Sibil" */
  title: string;
  /** e.g. the family name */
  subtitle?: string;
  /** e.g. "79 orang · 5 generasi · 31 Okt 2026" */
  footer: string;
  /** Lifespan text for a person, e.g. "1950–1998" */
  life: (p: Person) => string;
  /** Shown beside the ✿ mark */
  deceased: string;
}

export interface ChartPhotos {
  [personId: string]: string | undefined; // data: URI of a small photo
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const MALE = "#2B7FD4";
const FEMALE = "#E0517F";
const INDIGO = "#2E3F8F";
const KUNYIT = "#D49A00";

/** A polyline with rounded corners, as an SVG path. */
export function roundedPath(pts: number[], r = 14): string {
  if (pts.length < 4) return "";
  let d = `M${pts[0]} ${pts[1]}`;
  for (let i = 2; i < pts.length - 2; i += 2) {
    const [px, py, x, y, nx, ny] = [pts[i - 2], pts[i - 1], pts[i], pts[i + 1], pts[i + 2], pts[i + 3]];
    const inLen = Math.hypot(x - px, y - py);
    const outLen = Math.hypot(nx - x, ny - y);
    const k = Math.min(r, inLen / 2, outLen / 2);
    if (!k) {
      d += ` L${x} ${y}`;
      continue;
    }
    const ax = x - ((x - px) / inLen) * k;
    const ay = y - ((y - py) / inLen) * k;
    const bx = x + ((nx - x) / outLen) * k;
    const by = y + ((ny - y) / outLen) * k;
    d += ` L${ax.toFixed(1)} ${ay.toFixed(1)} Q${x} ${y} ${bx.toFixed(1)} ${by.toFixed(1)}`;
  }
  d += ` L${pts[pts.length - 2]} ${pts[pts.length - 1]}`;
  return d;
}

/** Splits a name into at most two lines that fit roughly `max` characters each. */
export function wrapName(text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= max) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > 2)
    return [
      lines[0],
      `${lines
        .slice(1)
        .join(" ")
        .slice(0, max - 1)}…`,
    ];
  return lines.map((l) => (l.length > max + 2 ? `${l.slice(0, max)}…` : l));
}

function cardSvg(k: Card, photos: ChartPhotos, l: ChartLabels): string {
  const p = k.person;
  if (!p) return "";
  const cx = k.x + k.w / 2;
  const female = p.sex === "female";
  const r = k.focus ? 34 : 24;
  const top = k.y + (k.focus ? 14 : 10);
  const cy = top + r;
  const photo = photos[p.id];
  const out: string[] = [];
  out.push(
    `<rect x="${k.x}" y="${k.y}" width="${k.w}" height="${k.h}" rx="8" fill="#fff" stroke="${k.focus ? KUNYIT : "#C9CEDF"}" stroke-width="${k.focus ? 2.5 : 1}"/>`,
    `<rect x="${k.x + 5}" y="${k.y}" width="${k.w - 10}" height="3.5" rx="1.7" fill="${female ? FEMALE : MALE}"/>`,
  );
  if (photo) {
    out.push(
      `<clipPath id="c-${k.key}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`,
      `<image href="${photo}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#c-${k.key})" ${p.living ? "" : 'opacity="0.6"'}/>`,
    );
  } else {
    out.push(
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${female ? "#F8D2DE" : "#BDE6F5"}" ${p.living ? "" : 'opacity="0.6"'}/>`,
      `<text x="${cx}" y="${cy + r * 0.36}" text-anchor="middle" font-size="${r}" font-weight="700" fill="${female ? "#9E1F4F" : "#0E4D6E"}">${esc((p.givenName || "?").charAt(0).toUpperCase())}</text>`,
    );
  }
  if (k.focus) out.push(`<circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="none" stroke="${KUNYIT}" stroke-width="2.5"/>`);
  if (!p.living) out.push(`<text x="${cx + r * 0.75}" y="${cy + r}" text-anchor="middle" font-size="${k.focus ? 15 : 12}" fill="#6B6B6B">✿</text>`);

  const [l1, l2] = cardName(p);
  const fs = k.focus ? 13 : 11;
  const max = Math.floor(k.w / (fs * 0.56));
  const lines = [...wrapName(`${k.focus && p.prefix ? `${p.prefix} ` : ""}${l1}`, max), ...(l2 ? wrapName(l2, max).slice(0, 1) : [])].slice(0, 3);
  let y = cy + r + fs + 6;
  lines.forEach((line, i) => {
    out.push(
      `<text x="${cx}" y="${y}" text-anchor="middle" font-size="${i === 0 ? fs : fs - 1}" font-weight="${i === 0 ? 700 : 500}" fill="#1A1D2E">${esc(line)}</text>`,
    );
    y += fs + 2;
  });
  out.push(`<text x="${cx}" y="${k.y + k.h - 8}" text-anchor="middle" font-size="${fs - 2}" fill="#63677A">${esc(l.life(p))}</text>`);
  return out.join("");
}

/** The tree alone, as an SVG fitted to its own size (viewBox = the layout). */
export function treeSvg(layout: TreeLayout, photos: ChartPhotos, l: ChartLabels): string {
  // a soft band behind each couple
  const frames = layout.frames.map((f) => `<rect x="${f.x - 3}" y="${f.y - 3}" width="${f.w + 6}" height="${f.h + 6}" rx="10" fill="#E8EBF7"/>`).join("");
  const lines = layout.curves.map((pts) => `<path d="${roundedPath(pts)}" fill="none" stroke="#6A6F86" stroke-width="2" stroke-linecap="round"/>`).join("");
  const cards = layout.cards.map((k) => cardSvg(k, photos, l)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" preserveAspectRatio="xMidYMid meet">${lines}${frames}${cards}</svg>`;
}

/** The whole printable page. */
export function chartHtml(layout: TreeLayout, paper: PaperSize, l: ChartLabels, photos: ChartPhotos = {}): string {
  const P = PAPER[paper];
  const big = paper === "a3" ? 1.35 : 1;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
@page { size: ${P.css}; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: -apple-system, Roboto, "Segoe UI", sans-serif; color: #1A1D2E; }
.page { width: ${P.w}pt; height: ${P.h}pt; padding: ${16 * big}pt; background: #FBF8F1; }
.frame { width: 100%; height: 100%; border: ${3 * big}pt double ${INDIGO}; outline: ${1 * big}pt solid ${KUNYIT}; outline-offset: -${8 * big}pt; position: relative; display: flex; flex-direction: column; align-items: center; padding: ${18 * big}pt ${24 * big}pt ${12 * big}pt; }
.corner { position: absolute; width: ${26 * big}pt; height: ${26 * big}pt; border-color: ${KUNYIT}; border-style: solid; }
.tl { top: ${12 * big}pt; left: ${12 * big}pt; border-width: ${2 * big}pt 0 0 ${2 * big}pt; }
.tr { top: ${12 * big}pt; right: ${12 * big}pt; border-width: ${2 * big}pt ${2 * big}pt 0 0; }
.bl { bottom: ${12 * big}pt; left: ${12 * big}pt; border-width: 0 0 ${2 * big}pt ${2 * big}pt; }
.br { bottom: ${12 * big}pt; right: ${12 * big}pt; border-width: 0 ${2 * big}pt ${2 * big}pt 0; }
.kicker { font-size: ${9 * big}pt; letter-spacing: 0.3em; color: #8A6500; font-weight: 700; }
h1 { margin: ${3 * big}pt 0 0; font-size: ${21 * big}pt; color: ${INDIGO}; font-weight: 800; text-align: center; }
.sub { font-size: ${10 * big}pt; color: #63677A; margin-top: ${2 * big}pt; }
.rule { width: ${60 * big}pt; height: ${2 * big}pt; background: ${KUNYIT}; margin: ${7 * big}pt 0 ${5 * big}pt; }
.tree { flex: 1; width: 100%; min-height: 0; display: flex; }
.tree svg { width: 100%; height: 100%; }
.foot { width: 100%; display: flex; justify-content: space-between; font-size: ${8 * big}pt; color: #63677A; margin-top: ${4 * big}pt; }
.brand { color: ${INDIGO}; font-weight: 700; }
</style></head><body><div class="page"><div class="frame">
<div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
<div class="kicker">${esc(l.kicker)}</div>
<h1>${esc(l.title)}</h1>
${l.subtitle ? `<div class="sub">${esc(l.subtitle)}</div>` : ""}
<div class="rule"></div>
<div class="tree">${treeSvg(layout, photos, l)}</div>
<div class="foot" style="padding: 0 18pt"><span>${esc(l.footer)} · ✿ ${esc(l.deceased)}</span><span class="brand">Waris</span></div>
</div></div></body></html>`;
}
