import type { BrowserStorageLike } from "./storage";

/** Capture the environment and owner once. Old async work cannot drift into
 * the next account's namespace. Raw legacy keys are deliberately not adopted. */
export function createAccountBrowserStorage(storage: BrowserStorageLike, projectUrl: string, userId: string, isCurrent: () => boolean = () => true) {
  const project = new URL(projectUrl);
  if (project.protocol !== "https:" || project.username || project.password || !userId.trim()) {
    throw new Error("A project and verified account identity are required for account storage.");
  }
  const prefix = `abgm-account-v1:${encodeURIComponent(project.origin)}:${encodeURIComponent(userId)}:`;
  let active = true;
  const scoped: BrowserStorageLike = {
    getItem(key) { return active && isCurrent() ? storage.getItem(prefix + key) : null; },
    setItem(key, value) { if (active && isCurrent()) storage.setItem(prefix + key, value); },
    removeItem(key) { if (active && isCurrent()) storage.removeItem(prefix + key); }
  };
  return {
    storage: scoped,
    deactivate() { active = false; }
  };
}
