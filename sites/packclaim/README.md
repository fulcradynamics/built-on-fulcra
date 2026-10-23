# Packclaim

Live at **https://packclaim.my.fulcra.ai**

Packclaim lets each family member's agent claim shared trip items, so nothing gets packed twice or left behind. It is for families and relatives travelling together who split shared gear like chargers, the first aid kit, sunscreen and snacks.

The site itself runs no AI and makes no model calls. Your own agent does the thinking, using the skill the site serves.

## What the site does

- **Home page (no account needed):** explains the idea, gives you a one-line prompt for your agent ("Use this with your agent"), and a one-line prompt to fork the site ("Make it yours"), each with a copy button.
- **`/skill.md`:** the Packclaim skill for your agent. Loading it tells the agent how to help one family member: suggest items you usually bring, ask before claiming anything, save only the claims you confirm, compare your claims with lists relatives have shared read-only and flag items claimed twice or by nobody, and remind you the night before departure. It also lists exactly which Fulcra files it may read and write, and tells the agent to ask you first.
- **`/fork.md`:** the source link and how to build your own copy.
- **"Your shared trip list" (signed in):** a form with trip name, departure date, shared items, the items you are bringing, and notes for your agent. Saving writes it to your own Fulcra account; opening the page again reads it back so you can check and edit your claims. The form shows shared items you have not claimed and claims that are not on the shared list.

## Why sign in

The trip list and the items you claim land in your own Fulcra account, where your agent reads them and can share them read-only with relatives' agents. Browsing the site and using the skill never need an account.

Sign-in is the Fulcra app template's Auth0 device flow, unchanged. Files written, all in your own Fulcra file store:

- `/built-on-fulcra/packclaim/trip-list.json`: the whole form
- `/built-on-fulcra/packclaim/my-claims.json`: just your claims, trip name and date

Your agent may also read `/built-on-fulcra/packclaim/shared/`, where relatives' shared lists go; the site does not read that folder itself.

## Run it

Needs Node 20+.

```sh
npm install
cp .env.example .env
npm run dev          # http://localhost:6173
```

`.env.example` holds every setting the site needs, and none of them is a secret: the public Auth0 and Fulcra API settings, plus `OWNER_USER_ID`, `PUBLIC_HARNESS_ANNOTATION_ID` and `PUBLIC_WORKSPACE_PATH` for the owner-only build dashboard at `/harness`. In a fork, set those three to your own values (or leave them; the dashboard only opens for the owner id).

Checks:

```sh
npm run check
# from the repository root: build, run against a fake Fulcra API, and check the writes
bash tools/e2e-site.sh sites/packclaim
node tools/check-site.mjs sites/packclaim
```

`npm run test:e2e` runs the core flow over HTTP against `BASE_URL`, signed in by sending `FAKE_FULCRA_TOKEN` as the `fulcra_access_token` cookie.

## How it is built

- `src/routes/+page.svelte`: the home page
- `src/routes/signin/+page.svelte`: the template sign-in screen, returning to the trip list
- `src/lib/components/TripList.svelte`: the signed-in form
- `src/routes/api/trip/+server.js`: save (`POST`) and read (`GET`) with the visitor's own token
- `src/lib/server/packclaim-files.js`: Fulcra file store calls (`POST /input/v1/file`, upload to the returned url, list and download)
- `static/skill.md`, `static/fork.md`: served as is

## Fork it

Paste this into your agent:

> Fork https://github.com/fulcradynamics/built-on-fulcra/tree/main/sites/packclaim with the build-and-deploy-a-web-app skill (npx skills add fulcradynamics/agent-skills --skill build-and-deploy-a-web-app) and put my own agent behind it.

Or copy this folder by hand. Things you will likely change: the name and copy in `src/routes/+page.svelte`, the default shared items at the top of `TripList.svelte`, the list fields, and the skill text in `static/skill.md`. Deploy with the build-and-deploy-a-web-app skill and point your own agent at your served `/skill.md`; it reads and writes the same `/built-on-fulcra/packclaim/` files in your Fulcra account.

MIT licensed.
