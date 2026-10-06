# Building on the content desk

How this codebase is put together, for whoever works on it next. Read `BRIEF.md` first for
what the desk is for.

## Stack

- Next.js 16.3 App Router, React 19.3, TypeScript, CSS modules on design tokens. No Tailwind.
- Postgres through Drizzle ORM (`lib/db`). Neon in production, local Postgres in development.
- Vercel Blob for images. Hosted on Vercel. No AI services and no API keys, by the club's choice:
  keep it that way unless the club decides otherwise.
- Next 16 ships its own docs in `node_modules/next/dist/docs/`. Read them before using an API
  you remember from an older version (`proxy.ts` replaced `middleware.ts`; `refresh()` from
  `next/cache` re-renders the page after a server action).

## Where things live

| Path | What |
|---|---|
| `app/(auth)/` | Sign in, invite acceptance. Public. |
| `app/(desk)/` | Every signed-in page. The layout redirects signed-out visitors. |
| `app/api/` | Route handlers: Blob upload tokens, caption drafts. |
| `lib/auth/` | Sessions, password rules, roles and the permission table (`rules.ts`). |
| `lib/db/schema.ts` | The whole database. Change it, then `pnpm db:generate` and `pnpm db:migrate`. |
| `lib/posts/` | Post content types, the factory that builds slides from an event, and `workflow.ts`: every write to a post goes through it. |
| `lib/brand/` | Series presets, the event post plan, and the brand/voice checks. |
| `lib/time.ts` | Wichita time. Every date shown or bucketed by day goes through it. |
| `components/post/` | The brand templates (`PostCanvas`) and thumbnails. |
| `styles/post.css` | The graphics' CSS, carried over from the original desk. The club's identity: edit with care. |
| `styles/tokens.css`, `app/globals.css` | Interface tokens and shared controls. |

## Rules that keep it safe

1. **Every server action and route handler checks who is asking, itself.** First line:
   `await requireUser()` or `await requirePermission("…")` from `lib/auth/session.ts`. The
   layout redirect and `proxy.ts` are conveniences, not gates.
2. **Every post write goes through `lib/posts/workflow.ts`.** It holds the review rules (no
   self-approval, approval tied to a version, conditional status updates). Don't update the
   `posts` table from anywhere else.
3. **Validate input with zod** in the action, return `FormState` (`lib/actions.ts`) to forms,
   and keep what the person typed in `values` so a failed submit loses nothing.
4. **Never trust a URL or ID from the browser.** Look the record up; check the role.
5. **No secrets in `NEXT_PUBLIC_*`.** Environment is validated in `lib/env.ts`.

## Interface rules: the night studio

The desk is a dark workspace built so the club's graphics are the brightest things on screen.
It deliberately looks nothing like the posts themselves. Keep to these:

- **Ground and surfaces.** Graphite workspace (`--paper`), floating panels (`--raised`, `.panel`),
  sunk wells for inputs and previews (`--sunk`). Day mode (`data-theme="light"`) is a cool grey
  studio built from the same tokens. Use tokens only, never raw colours.
- **Colour has jobs.** Brand ivory is the primary action (`.btn-primary`). Gold (`--spark`, `<Spark />`)
  means "this needs someone" and nothing else. `--select` outlines what is selected on a canvas.
  State colours (`--ok`, `--danger`, `--spark-ink`) are for status words.
- **Two families, kept apart.** The interface is Instrument Sans (`--font-ui`). Geist, Geist Mono
  and Newsreader belong to the graphics (`.aic-post`) and long captions (`.read`).
- **Show the real graphics** (`<PostThumb>`) large enough to read, with `--shadow-graphic`.
  Graphics are never rounded.
- **No dashboard tells.** Sentence case everywhere, no uppercase letter-spaced labels in the
  interface, no pill badges, no tinted stat tiles, no coloured side stripes. Status is a word in
  its state colour: `<StatusWord status=… />`.
- **Navigation** is the left rail (a bottom bar on phones) plus the ⌘K command bar
  (`components/shell/CommandBar.tsx`). New sections go in `NAV` in `Rail.tsx`; new commands in
  `COMMANDS` in `CommandBar.tsx`.
- **Shared controls** are global classes: `.btn` `.btn-primary` `.btn-quiet` `.btn-danger` `.btn-s`,
  `.field` `.input` `.hint` `.error`, `.seg`, `.check`, `.notice`, `.table`, `.empty`, `dialog.dlg`,
  `kbd`. Form fields: `components/forms/Field.tsx`.
- **States are designed.** Empty states say what to do next; errors say what happened and how to
  fix it. Every control works by keyboard, has a visible label and a visible focus ring.

## Times

Everything is Wichita time (`America/Chicago`), via `lib/time.ts`: `dayKey`, `fmtDate`,
`fmtTime`, `toLocalInput` / `fromLocalInput` for `<input type="datetime-local">`. Never call
`toLocaleDateString()` without the zone, and never bucket by `getDate()`.

## Running it

```sh
cp .env.example .env.local        # local Postgres URL is already in it
createdb aiclub_desk
pnpm install
pnpm db:migrate
pnpm admin:create yourname "Your Name"
pnpm dev
```

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test` (unit), `pnpm build && pnpm test:e2e`.
Don't run `next build` while `next dev` is running in the same folder; it corrupts `.next`.
