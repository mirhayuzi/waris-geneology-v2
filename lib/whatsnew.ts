import type { Lang } from "./i18n";

/** Short release notes shown on the About page ("What's new"). Newest first. */
export const RELEASES: { version: string; notes: Record<Lang, string[]> }[] = [
  {
    version: "2.5.0",
    notes: {
      en: [
        "Share → Waris: send a family file from WhatsApp, Telegram or Files straight into Waris",
        "Family tree chart: a printable certificate (Sijil Salasilah) as a PDF, A4 or A3, with photos",
        "Ready for Google Play: Waris now has its permanent app ID",
      ],
      bm: [
        "Kongsi → Waris: hantar fail keluarga dari WhatsApp, Telegram atau Fail terus ke Waris",
        "Carta salasilah: sijil yang boleh dicetak (Sijil Salasilah) sebagai PDF, A4 atau A3, dengan gambar",
        "Sedia untuk Google Play: Waris kini mempunyai ID aplikasi yang tetap",
      ],
    },
  },
  {
    version: "2.4.1",
    notes: {
      en: [
        "The banner now shows whose line you are looking at: \"Descendants of …\", with their people, generations and photos",
        "Every pop-up has a ✕ to close it, and tapping beside it closes it too (easier when the phone is sideways)",
      ],
      bm: [
        "Sepanduk kini menunjukkan keturunan siapa yang anda lihat: \"Keturunan …\", dengan bilangan orang, generasi dan gambar",
        "Setiap tetingkap timbul ada ✕ untuk tutup, dan ketik di sebelahnya juga menutupnya (lebih mudah ketika telefon mengiring)",
      ],
    },
  },
  {
    version: "2.4.0",
    notes: {
      en: [
        "A fresh look: the new Waris font across the app",
        "Family banner on the tree: family name, people, generations and photos",
        "Phones can turn sideways too, on every screen",
        "Welcome screens for new users, and this note after each update",
      ],
      bm: [
        "Rupa baharu: fon Waris yang baharu di seluruh aplikasi",
        "Sepanduk keluarga pada salasilah: nama keluarga, bilangan orang, generasi dan gambar",
        "Telefon juga boleh dipusing mengiring, di semua skrin",
        "Skrin selamat datang untuk pengguna baharu, dan nota ini selepas setiap kemas kini",
      ],
    },
  },
  {
    version: "2.3.2",
    notes: {
      en: [
        "Big families open at a readable size around the centre person; pinch out to see everyone",
        "Choose a tree background: Plain, Batik, Paper, Songket, Dusk or Night (Tree view settings)",
      ],
      bm: [
        "Keluarga besar dibuka pada saiz yang boleh dibaca di sekitar orang di tengah; cubit keluar untuk lihat semua",
        "Pilih latar belakang salasilah: Biasa, Batik, Kertas, Songket, Senja atau Malam (tetapan Paparan salasilah)",
      ],
    },
  },
  {
    version: "2.3.1",
    notes: {
      en: [
        "New Waris icon and opening screen",
        "About page with the version and what's new",
        "Saving no longer fails after the phone closes the app in the background",
        "Tablets show the profile as its own page, like phones",
      ],
      bm: [
        "Ikon dan skrin pembuka Waris yang baharu",
        "Halaman Tentang Waris dengan versi dan apa yang baharu",
        "Simpan tidak lagi gagal selepas telefon menutup aplikasi di latar belakang",
        "Tablet memaparkan profil sebagai halaman sendiri, sama seperti telefon",
      ],
    },
  },
  {
    version: "2.3.0",
    notes: {
      en: [
        "Game-style tree: curved lines, glowing ring, smooth jumps",
        "Fold a family away with −, open it again with +N",
        "Classic tree still available in Tree view settings",
        "Faster with very big families (5,000 people)",
      ],
      bm: [
        "Salasilah gaya permainan: garisan melengkung, cincin bercahaya, lompatan lancar",
        "Lipat sesebuah keluarga dengan −, buka semula dengan +N",
        "Salasilah klasik masih ada dalam tetapan Paparan salasilah",
        "Lebih pantas untuk keluarga sangat besar (5,000 orang)",
      ],
    },
  },
];

/**
 * The release whose notes to show once at start-up: the current version, if it has notes and
 * they were not shown yet. A brand-new user (no family yet) is not shown them.
 */
export function releaseToShow(current: string, seen: string | undefined, hasFamily: boolean) {
  if (seen === current || (!seen && !hasFamily)) return undefined;
  return RELEASES.find((r) => r.version === current);
}
