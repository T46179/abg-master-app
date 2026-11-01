/** Mirrors the password policy configured in Supabase. Never apply to existing-account sign-in. */
export const PASSWORD_REQUIREMENTS = [
  { label: "At least 8 characters", error: "Use at least 8 characters.", accepts: (value: string) => value.length >= 8 },
  { label: "At least 1 number, e.g. 123456", error: "Include at least 1 number.", accepts: (value: string) => /[0-9]/.test(value) },
  { label: "At least 1 uppercase letter, e.g. ABC", error: "Include at least 1 uppercase letter.", accepts: (value: string) => /[A-Z]/.test(value) },
  { label: "At least 1 lowercase letter, e.g. abc", error: "Include at least 1 lowercase letter.", accepts: (value: string) => /[a-z]/.test(value) },
  { label: "At least 1 special character, e.g. @#$", error: "Include at least 1 special character.", accepts: (value: string) => /[^A-Za-z0-9\s]/.test(value) }
] as const;
export function passwordRequirementError(value: string): string | undefined {
  return PASSWORD_REQUIREMENTS.find(requirement => !requirement.accepts(value))?.error;
}
