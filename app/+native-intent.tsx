/**
 * Files opened with Waris from other apps arrive as content:// or file:// links.
 * Send them to the Open screen instead of treating them as a page address.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (/^(content|file):\/\//i.test(path)) return `/open?uri=${encodeURIComponent(path)}`;
    return path;
  } catch {
    return "/";
  }
}
