import type { Repo } from "./repo";
import { SqliteRepo } from "./repo-sqlite";

/** On the phone the family tree is stored in a local SQLite database (waris.db). */
export async function openRepo(): Promise<Repo> {
  return SqliteRepo.open();
}

export const IS_PREVIEW = false;
