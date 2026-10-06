/**
 * Account rules shared by the sign-up form, the server actions and scripts/create-admin.ts.
 * No server-only import: the CLI script uses this too.
 */

/** OWASP Password Storage Cheat Sheet minimum for argon2id: 19 MiB, 2 iterations, 1 lane. */
export const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

/** A short handle ("ada.l") or an email address ("name@example.com"), always lowercase. */
export const USERNAME_RE = /^(?:[a-z0-9][a-z0-9_.-]{2,31}|[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24})$/;

export function usernameProblem(u: string): string | null {
  if (!USERNAME_RE.test(u)) {
    return "Use your email address, or 3 to 32 characters: lowercase letters, digits, dots, dashes or underscores.";
  }
  return null;
}

// The most common passwords that pass a length rule. Not exhaustive; length does most of the work.
const COMMON = new Set([
  "password123", "password1234", "qwertyuiop", "1234567890", "iloveyou12", "shockers123", "wichitastate",
  "wsushockers", "letmein123", "aiclub2026", "aiclubwsu", "passw0rd123", "welcome123", "abcdefghij",
]);

export function passwordProblem(p: string, username: string): string | null {
  if (p.length < 10) return "Use at least 10 characters. A short sentence works well.";
  if (p.length > 128) return "Use 128 characters or fewer.";
  if (p.toLowerCase().includes(username.toLowerCase())) return "Don't include your username in your password.";
  if (COMMON.has(p.toLowerCase())) return "That password is too common. Pick something only you would use.";
  if (/^(.)\1+$/.test(p)) return "Don't repeat one character.";
  return null;
}

export type Role = "admin" | "officer" | "member";

/**
 * What each role may do. One place, called by every server action.
 */
const POLICY = {
  "post.edit": ["admin", "officer", "member"],
  "post.approve": ["admin", "officer"],
  "post.markPosted": ["admin", "officer"],
  "post.delete": ["admin", "officer"],
  "event.edit": ["admin", "officer"],
  "event.delete": ["admin", "officer"],
  "library.edit": ["admin", "officer", "member"],
  "library.archive": ["admin", "officer"],
  "results.edit": ["admin", "officer"],
  "team.manage": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof POLICY;

export function can(role: Role, permission: Permission): boolean {
  return (POLICY[permission] as readonly Role[]).includes(role);
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  officer: "Officer",
  member: "Member",
};

export const ROLE_HELP: Record<Role, string> = {
  admin: "Plans, writes, approves, and manages the team and invites.",
  officer: "Plans events, writes posts and approves other people's posts.",
  member: "Writes drafts and asks an officer to review them.",
};
