import type { Repo } from "./repo";
import { SqliteRepo } from "./repo-sqlite";

let opening: Promise<Repo> | undefined;

/** On the phone the family tree is stored in a local SQLite database (waris.db). */
export function openRepo(): Promise<Repo> {
  // Share initialization across remounts; two migrations must not race on the same file.
  opening ??= SqliteRepo.open().catch((error) => {
    opening = undefined;
    throw error;
  });
  return opening;
}

export const IS_PREVIEW = false;
