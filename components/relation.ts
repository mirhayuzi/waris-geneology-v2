import type { TKey } from "@/lib/i18n";
import type { Kin, RelationText } from "@/lib/kinship";

type T = (key: TKey, vars?: Record<string, string | number>) => string;

/** One kin term in the chosen language, with the other language in brackets. */
export const kinText = (k: Kin, lang: "en" | "bm") => (lang === "bm" ? `${k.bm} (${k.en})` : `${k.en} (${k.bm})`);

/**
 * Main line and optional second line for "B is A's ___".
 * e.g. main "nenek (sebelah ibu)", or main "makcik ipar" / sub "ibu mertua kepada abang Halimah".
 */
export function relationLines(r: RelationText, lang: "en" | "bm", t: T): { main: string; sub?: string } {
  const side = r.side ? ` (${t(r.side === "father" ? "sideFather" : "sideMother")})` : "";
  if (r.direct.length) {
    const main = r.direct.map((k) => (lang === "bm" ? k.bm : k.en)).join(" · ") + side;
    const sub = r.direct.map((k) => (lang === "bm" ? k.en : k.bm)).join(" · ");
    return { main, sub };
  }
  const via = r.via!;
  const own = lang === "bm" ? via.bm : via.en;
  const other = lang === "bm" ? via.en : via.bm;
  return r.custom ? { main: r.custom, sub: own } : { main: own, sub: other };
}
