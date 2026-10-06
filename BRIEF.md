# AI Club Content Desk, rebuilt

## Who uses it, for what

Officers of the AI Club at Wichita State University (4 to 10 people, students, rotating every
year). Their job: announce every club event on Instagram and LinkedIn on time, on brand, with
facts right, and report how it went.

The one action that matters: **an event goes in once and every post it needs comes out of it,
reviewed by a second officer, on schedule.**

## What replaces what

| Old desk (wsuai-dash.zadok.dev) | New desk |
|---|---|
| Posts in one browser's IndexedDB; JSON export/import to share | Shared Postgres (Neon); every officer sees the same desk |
| No accounts; "approved by" is a typed name | Username + password accounts, invite links, roles; approval is a real second person |
| Posts only | Events first; an event generates its post plan (announce, LinkedIn, reminder, day-of, recap) |
| No dates | Calendar and week view; gaps flagged ("Workshop 03 has no reminder") |
| Re-upload speaker photos and partner logos each time | Library: speakers, partners, rooms, reused across posts |
| Blank caption boxes | Captions pre-filled from the event's facts (plain templates, no AI), then the same voice checks |
| "01 / 05" counter text | Real carousels: slides, exported as a numbered set |
| One PNG per click | One zip with every format, every slide and the captions |
| Nothing after posting | Results log: reach, likes, RSVPs, turnout; feeds the Recap template |

## Must never break

- The brand graphics: pixel output of the existing templates (ivory/black grounds, 72px ledger
  grid, gold spark, Geist / Geist Mono / Newsreader, 3px rules, data strip). Ported as-is.
- An officer cannot approve their own post.
- A signed-out visitor sees nothing but the sign-in page. Every mutation re-checks the session
  and role on the server.
- Invite links are single-use, expire, and only admins create them.
- Passwords: argon2id, never logged, rate-limited sign-in.

## Constraints

- Next.js 16.3 App Router, React 19.3, TypeScript, CSS modules on tokens. Strict nonce CSP stays.
- Vercel, Hobby plan: 12 functions, 10 s function
  timeout, non-commercial use only.
- Neon Postgres via the Marketplace; local Postgres in development.
- Vercel Blob for photos and logos.
- No AI services and no API keys: the club decided against them. Captions are pre-filled from
  plain templates.

## Facts that must come from the club

- Officer list and who is admin `[TBC]`
- Real event names, rooms, partner names `[TBC]`; the app ships empty, no invented events.
- Brand rules: taken from the old desk's voice check and template code.

## Done looks like

- Deployed on a club-controlled Vercel project, first admin created from the command line.
- An officer can: accept an invite, add an event, get its post plan, edit a post with live
  preview, request review, have another officer approve, export a zip, mark posted, log results.
- Calendar shows every scheduled post and flags gaps.
- Typecheck, lint, unit tests and e2e pass; ship-check passes on the deployed URL.
