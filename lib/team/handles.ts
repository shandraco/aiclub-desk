/**
 * Social handles for speakers and partners, used when tagging a post.
 *
 * Instagram is stored as the bare handle, lowercase, without "@" ("wsu_aiclub"): a handle is
 * all Instagram needs to tag someone, and it is shown as "@wsu_aiclub".
 * LinkedIn is stored as the full profile URL ("https://www.linkedin.com/in/ada-lovelace"):
 * people (/in/) and organisations (/company/, /school/) live under different paths, and
 * LinkedIn tags by picking the profile, so the officer needs the link, not a bare name.
 *
 * People paste whatever they have (a handle, "@handle", a profile link); these accept all of
 * those and return one canonical form, or a message saying what to fix.
 */

export type HandleResult = { value: string } | { error: string };

const IG_RE = /^(?!.*\.\.)(?!\.)(?!.*\.$)[a-z0-9._]{1,30}$/;

export function normalizeInstagram(raw: string): HandleResult {
  let s = raw.trim();
  if (!s) return { value: "" };
  const url = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i.exec(s);
  if (url) s = url[1]!;
  else if (/[/:]/.test(s)) return { error: "Paste the Instagram handle (@name) or a link to the profile on instagram.com." };
  s = s.replace(/^@/, "").toLowerCase();
  if (!IG_RE.test(s)) {
    return { error: "Instagram handles are up to 30 letters, digits, dots or underscores, and can’t start or end with a dot." };
  }
  return { value: s };
}

const LI_PATH_RE = /^(in|company|school|showcase)\/([A-Za-z0-9\-_%.]{2,100})$/;

export function normalizeLinkedIn(raw: string): HandleResult {
  let s = raw.trim();
  if (!s) return { value: "" };
  const url = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(.+)$/i.exec(s);
  if (url) s = url[1]!;
  else if (/^https?:\/\//i.test(s) || s.includes(".com")) return { error: "That link isn’t on linkedin.com. Paste the profile or company page link." };
  s = s.replace(/^@/, "").split(/[?#]/)[0]!.replace(/\/+$/, "");
  if (!s.includes("/")) s = `in/${s}`;
  const m = LI_PATH_RE.exec(s);
  if (!m) return { error: "Paste the LinkedIn profile link, like linkedin.com/in/name or linkedin.com/company/name." };
  return { value: `https://www.linkedin.com/${m[1]}/${m[2]}` };
}

/** "in/ada-lovelace" for showing a stored LinkedIn URL compactly. */
export function linkedInLabel(url: string): string {
  return url.replace(/^https:\/\/www\.linkedin\.com\//, "");
}
