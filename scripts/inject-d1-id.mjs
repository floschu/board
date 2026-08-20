// Injects a real D1 database id into wrangler.toml at build time.
//
// The committed wrangler.toml ships a placeholder id so the public repo stays
// generic. Cloudflare Pages reads wrangler.toml *after* the build command runs
// to publish Functions, so replacing the placeholder here (from the
// D1_DATABASE_ID env var) makes the D1 binding valid for whichever account is
// deploying — without hardcoding anyone's id in the repo.
//
// No-op when D1_DATABASE_ID is unset (e.g. local dev / default builds), which
// keeps the placeholder in place; local `wrangler pages dev` does not validate
// the id. Set D1_DATABASE_ID as a Cloudflare Pages build environment variable
// (or export it before `npm run deploy:cloudflare`).

import { readFileSync, writeFileSync } from 'node:fs';

const PLACEHOLDER = 'REPLACE_WITH_YOUR_DATABASE_ID';
const id = process.env.D1_DATABASE_ID;

if (!id) {
  console.log('[inject-d1-id] D1_DATABASE_ID not set — leaving wrangler.toml unchanged');
  process.exit(0);
}

const path = new URL('../wrangler.toml', import.meta.url);
const toml = readFileSync(path, 'utf8');

if (!toml.includes(PLACEHOLDER)) {
  console.log('[inject-d1-id] placeholder not found — wrangler.toml already has a database id');
  process.exit(0);
}

writeFileSync(path, toml.replaceAll(PLACEHOLDER, id));
console.log('[inject-d1-id] injected D1_DATABASE_ID into wrangler.toml');
