import {
  ensureWorkspaceShape,
  getActiveAdminEmail,
  getCachedWorkspace,
  saveWorkspace,
} from "../services/workspaceStorage";

export type Database = any;

export function getAdminEmail(): string {
  return getActiveAdminEmail();
}

export function getDbKey(adminEmail?: string) {
  const email = adminEmail ?? getAdminEmail();
  return `db_${email}`;
}

export function loadDatabase(): Database {
  return getCachedWorkspace();
}

export async function saveDatabase(db: Database) {
  const email = getAdminEmail();
  return saveWorkspace(email, db);
}

export function ensureDbShape(db: Database): Database {
  return ensureWorkspaceShape(db);
}
