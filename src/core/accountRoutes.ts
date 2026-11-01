/** Public-facing URLs for the local account experience; email callback intake remains separate. */
export const ACCOUNT_PAGE_PATHS = {
  signin: "/sign-in",
  signup: "/create-account",
  forgot: "/forgot-password",
  reset: "/reset-password",
  checkEmail: "/check-email",
  password: "/create-password",
  completion: "/finish-account",
  link: "/account-link"
} as const;
export type AccountRoutePage = keyof typeof ACCOUNT_PAGE_PATHS;
export function accountPageFromPath(pathname: string): AccountRoutePage | null {
  const path = pathname.replace(/\/$/, "");
  return (Object.keys(ACCOUNT_PAGE_PATHS) as AccountRoutePage[]).find(page => ACCOUNT_PAGE_PATHS[page] === path) ?? null;
}
export function accountPageUrl(page: string, search = ""): string {
  const params = new URLSearchParams(search);
  const path = Object.prototype.hasOwnProperty.call(ACCOUNT_PAGE_PATHS, page)
    ? ACCOUNT_PAGE_PATHS[page as AccountRoutePage] : "/dev/exam-pilot";
  if (path !== "/dev/exam-pilot" || page === "exam") params.delete("account");
  else params.set("account", page);
  return path + (params.size ? "?" + params.toString() : "");
}
