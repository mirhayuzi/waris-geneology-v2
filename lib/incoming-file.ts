// Keep private file URIs out of route parameters. A screen can read its request again
// after a remount, and opening a second file cannot replace the first screen's URI.
const pending = new Map<string, string>();
let sequence = 0;

export function setIncomingFile(uri: string): string {
  const id = `${Date.now()}-${++sequence}`;
  pending.set(id, uri);
  // Navigation history may retain old screens; keep only a small number of requests.
  if (pending.size > 8) pending.delete(pending.keys().next().value!);
  return id;
}

export function getIncomingFile(id: string | undefined): string | null {
  return id ? pending.get(id) ?? null : null;
}

export function forgetIncomingFile(id: string | undefined): void {
  if (id) pending.delete(id);
}
