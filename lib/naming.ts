/**
 * A readable file name: "Salasilah Keturunan Tiajar binti Sibil" + ".pdf" →
 * "Salasilah-Keturunan-Tiajar-binti-Sibil.pdf". Keeps letters (any language) and digits.
 */
export function fileName(title: string, ext: string): string {
  const base = title
    .normalize("NFC")
    .replace(/[\\/:*?"<>|#%&{}$!'`@+=,;[\]()]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join("-")
    .slice(0, 80)
    .replace(/-+$/, "");
  return `${base || "Waris"}.${ext}`;
}
