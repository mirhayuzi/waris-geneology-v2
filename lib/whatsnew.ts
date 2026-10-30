import type { Lang } from "./i18n";

/** Short release notes shown on the About page ("What's new"). Newest first. */
export const RELEASES: { version: string; notes: Record<Lang, string[]> }[] = [
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
