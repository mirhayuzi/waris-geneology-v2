import { useColorScheme } from "react-native";

/** "Batik indigo": indigo with turmeric (kunyit) highlights. Male/female card colours stay blue/pink. */
const light = {
  primary: "#2E3F8F",
  primaryText: "#FFFFFF",
  accent: "#D49A00",
  background: "#F4F5FA",
  canvas: "#E6E9F3",
  surface: "#FFFFFF",
  surfaceAlt: "#ECEEF6",
  text: "#1A1D2E",
  muted: "#63677A",
  border: "#D5D9E6",
  line: "#6A6F86",
  male: "#2B7FD4",
  maleSoft: "#BDE6F5",
  maleDark: "#0E4D6E",
  female: "#E0517F",
  femaleSoft: "#F8D2DE",
  femaleDark: "#9E1F4F",
  addCircle: "#5A5F78",
  danger: "#C62828",
  focusRing: "#D49A00",
};

const dark: typeof light = {
  primary: "#5C6FD6",
  primaryText: "#FFFFFF",
  accent: "#F2B92B",
  background: "#12131C",
  canvas: "#1A1C28",
  surface: "#232638",
  surfaceAlt: "#1D2030",
  text: "#EEF0F8",
  muted: "#9EA3BA",
  border: "#353A52",
  line: "#7E84A3",
  male: "#5AA8F0",
  maleSoft: "#1F4A60",
  maleDark: "#BDE6F5",
  female: "#F07AA0",
  femaleSoft: "#5A2A3A",
  femaleDark: "#F8D2DE",
  addCircle: "#6B7090",
  danger: "#EF5350",
  focusRing: "#F2B92B",
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}
