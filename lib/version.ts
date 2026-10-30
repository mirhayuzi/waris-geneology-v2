import Constants from "expo-constants";

/** This app's version, e.g. 2.3.1 build 17. Builds from GitHub carry their run number in the version code. */
export function appVersion(): { version: string; build?: number; date?: string } {
  const cfg = Constants.expoConfig;
  const code = Number(cfg?.android?.versionCode) || 0;
  return { version: cfg?.version ?? "?", build: code > 100 ? code - 100 : undefined, date: cfg?.extra?.buildDate as string | undefined };
}
