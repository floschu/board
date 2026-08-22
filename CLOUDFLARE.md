# Self-host on Cloudflare Pages

Deploy your own board to [Cloudflare Pages](https://pages.cloudflare.com/) with data
**synced across your devices** via [Cloudflare D1](https://developers.cloudflare.com/d1/)
(SQLite). This is an alternative to the Docker self-host path — no server to run, and a
generous free tier.

> [!IMPORTANT]
> **The `/api/data` endpoint has no authentication of its own.** Anyone who can reach the
> site can read, overwrite, and delete your entire board. On a publicly reachable deploy
> (e.g. a `*.pages.dev` URL or a public custom domain) you **must** put an access control
> in front of it — [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
> is the zero-code way to do this. See [Restrict access](#restrict-access-required-for-public-deploys).

## How it works

The default GitHub Pages build stores data in your browser. The Cloudflare build
(`--mode cloudflare`, storage mode `api`) instead talks to a small API:

| File | Role |
|------|------|
| `functions/api/data.js` | `/api/data` as a Cloudflare Pages Function, backed by D1 (a Workers-runtime port of the Docker server in `server/`). |
| `functions/_shared/validation.js` | Same payload validation as `server/validation.js`. |
| `schema.sql` | The D1 tables. |
| `wrangler.toml` | Project name + D1 binding. |
| `.env.cloudflare` | Build flags (`VITE_STORAGE_MODE=api`, `VITE_BASE_URL=/`). |

None of this affects `npm run dev`, the default `npm run build`, or the Docker path.

## One-time setup

Requires a Cloudflare account and the wrangler CLI login:

```bash
npm install
npx wrangler login
```

**1. Create the D1 database and its tables**

```bash
npx wrangler d1 create board            # prints a database_id (UUID) — save it
export D1_DATABASE_ID=<paste-the-uuid>  # the build fills wrangler.toml from this
node scripts/inject-d1-id.mjs           # writes the id into wrangler.toml locally
npx wrangler d1 execute board --remote --file=./schema.sql
git checkout wrangler.toml              # restore the committed placeholder
```

**2. Create the Pages project — pick a deploy style**

- **A. Push-to-deploy (recommended).** Dashboard → **Workers & Pages → Create → Pages**,
  then either:
  - **Connect to Git** and pick a repo you own — Cloudflare can only watch repos you
    administer, so to auto-deploy your own copy, **fork this repo first** and connect the
    fork (get upstream updates later with GitHub's "Sync fork"); or
  - **Clone a public repository** and paste this repo's Git URL
    (`https://github.com/floschu/board`) — no fork required.

  Either way, set **Build command** `npm run build:cloudflare` and **Build output
  directory** `dist`. Connecting your own fork auto-deploys on every push; a public-URL
  clone deploys on demand (re-deploy to pull in updates).
- **B. CLI (direct upload).** No fork needed. `npx wrangler pages project create board --production-branch main`,
  then deploy from your machine on demand with `npm run deploy:cloudflare`.

**3. Provide the database id to the build**

`wrangler.toml` ships a placeholder D1 id so the repo stays generic; the build fills it in
from the `D1_DATABASE_ID` environment variable (see `scripts/inject-d1-id.mjs`), and the
`DB` binding itself is defined in `wrangler.toml` — so no dashboard binding is needed.

- **Push-to-deploy:** your Pages project → **Settings → Environment variables** → add a
  **build** variable `D1_DATABASE_ID` = the UUID from step 1, then redeploy.
- **CLI deploy:** `export D1_DATABASE_ID=<uuid>` before `npm run deploy:cloudflare`.

## Deploy

- **A. Git integration:** if you connected your own fork, just `git push` and Cloudflare
  builds and deploys. If you cloned the public repo by URL, trigger a redeploy from the
  dashboard to publish updates.
- **B. CLI:** `npm run deploy:cloudflare` (builds in Cloudflare mode, uploads `dist/` +
  `functions/`). Re-run any time to publish.

Your board is then live at the project's `*.pages.dev` URL.

### Custom domain (optional)

Pages project → **Custom domains** → add your domain (e.g. `board.example.com`). If the
domain's zone is on the same Cloudflare account, the DNS record is created for you.

## Restrict access (required for public deploys)

The API is unauthenticated, so **any deploy that is reachable from the public internet needs
an access control in front of it** — otherwise anyone with the URL can read and wipe your
data. The simplest option is Cloudflare Access.

Cloudflare **Zero Trust → Access → Applications → Add an application → Self-hosted**:

- **Application domain:** your board domain — and also add the `*.pages.dev` URL, since that
  stays reachable even after you attach a custom domain.
- **Policy:** Action **Allow**, Include → **Emails** → your email address.
- **Login method:** One-time PIN (email code), or Google/GitHub, etc.

Access gates the entire hostname, including `/api/*`, so the D1 API is protected too.

(You can skip this only when the deployment is genuinely not public — e.g. a local
`wrangler pages dev` session, or a private network — in which case Docker is usually a
better fit anyway.)

## Local test (before deploying)

```bash
npm run build:cloudflare
npx wrangler d1 execute board --local --file=./schema.sql
npx wrangler pages dev dist
```

`pages dev` reads the `DB` binding from `wrangler.toml` automatically — do **not** pass
`--d1 DB=board`, which points at a different local database than `wrangler d1 execute`
seeded (you'd get `no such table`). Open the printed URL, add a card, reload → it persists.
Inspect the local DB with:

```bash
npx wrangler d1 execute board --local --command "SELECT * FROM cards"
```

## Notes

- The whole dataset is re-saved on every change (small payloads for a personal board),
  matching the Docker server's behaviour.
- Keep `functions/_shared/validation.js` in sync with `server/validation.js`.
- To remove Cloudflare support entirely: delete `functions/`, `wrangler.toml`,
  `schema.sql`, `.env.cloudflare`, this file, and the `*:cloudflare` scripts in
  `package.json`; then delete the Pages project and D1 database in the dashboard.
