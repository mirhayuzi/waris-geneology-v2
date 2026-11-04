import { setIncomingFile } from "@/lib/incoming-file";

/**
 * Files opened with Waris from other apps arrive as content:// or file:// links.
 * Keep the link aside (special characters in it must not be touched) and show the
 * Open screen instead of treating it as a page address.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (/^(content|file):\/\//i.test(path)) {
      return `/open?t=${setIncomingFile(path)}`;
    }
    return path;
  } catch {
    return "/";
  }
}
