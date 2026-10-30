import { useColorScheme } from "react-native";

/**
 * Backgrounds for the tree screen. Each keeps the connecting lines at least 4:1 against
 * the background, and the pattern faint (about 1.2:1) so it never competes with the cards.
 */
export type BackgroundId = "plain" | "batik" | "kertas" | "songket" | "senja" | "malam";

export interface TreeBackground {
  /** Main colour (and the top of a gradient) */
  bg: string;
  /** Bottom colour of a gradient */
  bg2?: string;
  /** Lines between people */
  line: string;
  pattern?: "batik" | "dots" | "songket" | "stars";
  patternColor?: string;
}

export const BACKGROUND_IDS: BackgroundId[] = ["plain", "batik", "kertas", "songket", "senja", "malam"];

/** Templates that could become part of a paid version later (all free for now) */
export const PREMIUM_BACKGROUNDS: BackgroundId[] = ["batik", "kertas", "songket", "senja", "malam"];

const LIGHT: Record<BackgroundId, TreeBackground> = {
  plain: { bg: "#E6E9F3", line: "#6A6F86" },
  batik: { bg: "#E3E7F4", line: "#5A6080", pattern: "batik", patternColor: "#CCD3EA" },
  kertas: { bg: "#F4EFE4", line: "#7A6A4F", pattern: "dots", patternColor: "#E2D6BD" },
  songket: { bg: "#F6F1E7", line: "#6B5A2E", pattern: "songket", patternColor: "#E8D9AE" },
  senja: { bg: "#E7EAF7", bg2: "#F7E9CF", line: "#5F6480" },
  malam: { bg: "#1C2140", line: "#9AA3D0", pattern: "stars", patternColor: "#3A4275" },
};

const DARK: Record<BackgroundId, TreeBackground> = {
  plain: { bg: "#1A1C28", line: "#7E84A3" },
  batik: { bg: "#1B1F33", line: "#7E84A3", pattern: "batik", patternColor: "#272D49" },
  kertas: { bg: "#221F1A", line: "#A0937A", pattern: "dots", patternColor: "#332E25" },
  songket: { bg: "#1F1B14", line: "#B39B5E", pattern: "songket", patternColor: "#3A3220" },
  senja: { bg: "#1A1C2E", bg2: "#2A2218", line: "#8A90AE" },
  malam: { bg: "#1C2140", line: "#9AA3D0", pattern: "stars", patternColor: "#3A4275" },
};

export function backgroundOf(id: BackgroundId | undefined, dark: boolean): TreeBackground {
  const set = dark ? DARK : LIGHT;
  return set[id ?? "plain"] ?? set.plain;
}

export function useTreeBackground(id: BackgroundId | undefined): TreeBackground {
  return backgroundOf(id, useColorScheme() === "dark");
}

export const isBackgroundId = (v: string | undefined): v is BackgroundId => !!v && (BACKGROUND_IDS as string[]).includes(v);
