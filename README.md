# AI Club Content Desk

Designed and built by **Aege**.

The AI Club at Wichita State plans events, makes on-brand Instagram and LinkedIn graphics,
reviews them together and logs how they did, all in one shared place.

- **Events first.** Add an event once: date, room, speakers, partners. The desk drafts its
  posts: announcement, LinkedIn post, reminder, day-of story and recap, already filled in.
- **The club's own templates.** Ivory and black grounds, the ledger grid, the gold spark.
  Live preview, carousels, crop by dragging, PNG and zip export in every format.
- **A second pair of eyes.** Ask an officer for review; nobody approves their own post.
- **Brand checks** on every word, and captions pre-filled from the event's facts.
- **A calendar** that flags gaps: no reminder, no recap, overdue posts.
- **A library** of speakers, partner logos and rooms, entered once.
- **Results**: reach, likes, RSVPs and turnout, recorded after the fact.

## Where it runs

- A Vercel project on the Hobby plan.
- Neon Postgres and Vercel Blob, both connected through the Vercel dashboard.
- No AI and no API keys. The database and image storage are connected by Vercel's own
  integrations, so there are no keys to look after.

## First run in production

```sh
vercel env pull .env.production.local       # DATABASE_URL etc.; keep this file private
DATABASE_URL="<unpooled Neon URL>" pnpm db:migrate
DATABASE_URL="<unpooled Neon URL>" pnpm admin:create yourname "Your Name"
```

Then sign in and invite the other officers from **Team**. Invite links work once and last
7 days.

## Working on it

See `docs/BUILDING.md` for the structure, the safety rules and the interface rules, and
`BRIEF.md` for what the desk is for.

```sh
cp .env.example .env.local && createdb aiclub_desk
pnpm install && pnpm db:migrate && pnpm admin:create you "You"
pnpm dev
pnpm seed:demo        # optional: sample events marked [Sample], local only
```

Checks before deploying: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration`,
then `pnpm build && pnpm test:e2e`.
