import { setIncomingFile } from "@/lib/files";

/**
 * Files opened with Waris from other apps arrive as content:// or file:// links.
 * Keep the link aside (special characters in it must not be touched) and show the
 * Open screen instead of treating it as a page address.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (/^(content|file):\/\//i.test(path)) {
      setIncomingFile(path);
      return `/open?t=${Date.now()}`;
    }
    return path;
  } catch {
    return "/";
  }
}
