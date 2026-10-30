import { useColorScheme } from "react-native";

const light = {
  primary: "#1B6B4A",
  primaryText: "#FFFFFF",
  accent: "#1E88B5",
  background: "#F7F7F5",
  canvas: "#E8EAEC",
  surface: "#FFFFFF",
  surfaceAlt: "#F0EFEC",
  text: "#1C1C1E",
  muted: "#6E6E73",
  border: "#D9D9DE",
  line: "#5B5F66",
  male: "#2B7FD4",
  maleSoft: "#BDE6F5",
  maleDark: "#0E4D6E",
  female: "#E0517F",
  femaleSoft: "#F8D2DE",
  femaleDark: "#9E1F4F",
  addCircle: "#55585E",
  danger: "#C62828",
  focusRing: "#1B6B4A",
};

const dark: typeof light = {
  primary: "#3DAA7A",
  primaryText: "#FFFFFF",
  accent: "#3AA6D8",
  background: "#151517",
  canvas: "#1E1F22",
  surface: "#2A2B2F",
  surfaceAlt: "#232427",
  text: "#F2F2F0",
  muted: "#A0A0A6",
  border: "#3C3D42",
  line: "#8A8F98",
  male: "#5AA8F0",
  maleSoft: "#1F4A60",
  maleDark: "#BDE6F5",
  female: "#F07AA0",
  femaleSoft: "#5A2A3A",
  femaleDark: "#F8D2DE",
  addCircle: "#6B6F76",
  danger: "#EF5350",
  focusRing: "#3DAA7A",
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}
