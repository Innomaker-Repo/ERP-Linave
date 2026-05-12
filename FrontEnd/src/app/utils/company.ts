import { getCachedWorkspace } from "../services/workspaceStorage";

export function getCompanyData() {
  return getCachedWorkspace().empresa || null;
}
