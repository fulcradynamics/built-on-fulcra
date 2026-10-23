# Packclaim build report

Deployed URL: **https://packclaim.my.fulcra.ai** (deploy project f8011cbb-29e2-4590-8730-ba92f1a8e3dd; last deployment dpl_Egbmc9QtZEPq5GATwjHSb3xFR4Mh, 2026-10-23).

Built with the build-and-deploy-a-web-app harness. Workspace: `workspace/packclaim/` (plan, spec, decisions, progress, overview, outstanding issues, one history file per run). Run events go to `MomentAnnotation/76d4585b-7128-4288-a3ce-647a39eea5bd` and show on the owner-only `/harness` page.

## Milestones

### M1 — Working baseline and harness dashboard: complete (run-m1-20261023a)
Evaluated against the deployed site:
- `GET /` 200, title "Packclaim"; `POST /api/auth/device/code` 200 with `device_code`, `user_code`, `verification_uri` (device flow starts).
- `/api/harness/runs`, `/overview`, `/issues`: 401 with no cookie, 403 with the owner token's userid claim altered. `/api/harness/owner`: `{"isOwner":false}` with altered or missing token, `{"isOwner":true}` for the owner.
- Owner `runs` returned the run's real records, including the REVIEW progress event, which was also read back with `uvx fulcra-api get-records`.
- Headless Chrome with the owner cookie: `/harness` showed the owner nav, run steps with detail and evidence, and the overview and issues panels. Signed out: branded sign-in screen, no owner nav.
- `npm run check`: 0 errors. `npm run build`: ok.

### M2 — Public home page, skill and fork blocks: complete (run-m2-20261023a)
Headless Chrome, signed out, on the deployed site (16 checks passed):
- Headline, "Use this with your agent", "Your shared trip list" (with the sign-in reason) and "Make it yours" visible.
- Both prompts are exactly the specified text. Clicking each Copy button put that exact prompt on the clipboard (read back from the clipboard).
- Source link visible. "Sign in with Fulcra" goes to `/signin`, which shows the template's Sign In and Create Account buttons. 0 disabled buttons, 0 page errors.
- `curl`: `/skill.md` and `/fork.md` return 200 `text/markdown`, byte-identical to `static/`.

### M3 — Save and show the trip list: complete (run-m3-20261023a)
- `bash tools/e2e-site.sh sites/packclaim`: exit 0. All 6 steps ok (home with both prompts, skill/fork, 401 signed out, save, read back, 400 without a trip name). Result line: "e2e ok: 2 write(s) by e2e-visitor, all under declared paths".
- `node tools/check-site.mjs sites/packclaim`: `ok packclaim`.
- Live site with the real Fulcra API, CLI token as the `fulcra_access_token` cookie: `GET` and `POST /api/trip` return 401 without the cookie. `POST` returned 200, and `GET` returned 200 with the same trip name, date, items, claims and notes. `uvx fulcra-api file download` of `/built-on-fulcra/packclaim/trip-list.json` and `my-claims.json` showed the saved JSON.
- Headless Chrome signed in (14 checks passed): the form pre-fills from the saved list. Edited it, claimed an item with a chip, and the warning for a claim not on the shared list appeared. Save showed "Saved to your Fulcra account."; after a reload the saved name, claims and notes were shown. 0 page errors.

## Missing or not checked
- **Interactive sign-in was not tried by a person.** The Auth0 popup flow needs a human. Signed-in behavior was evaluated with the CLI token as the cookie. This is listed in `workspace/packclaim/outstanding-issues.md` for surface testing.
- The site does not read relatives' shared lists in `/built-on-fulcra/packclaim/shared/`. The visitor's agent does that through the skill. The "items claimed twice" check is the agent's job; the page only shows the visitor's own unclaimed shared items and claims that are not on the list.
- Each save adds a new file entry in Fulcra (the API keeps earlier entries). The site always reads the newest uploaded one.
- A `probe.json` test file was written to the owner's `/built-on-fulcra/packclaim/` while probing the real upload API. DELETE returned 204, but the name still showed in the folder listing afterwards.

## Changes outside app code
- `jsconfig.json`: `checkJs` and `strict` set to false. The unmodified template fails `npm run check` with 60+ strict-JS errors in sign-in files that must not be edited.
- `vite.config.js`: `preview.host` is `127.0.0.1`, so `tools/e2e-site.sh` can reach `vite preview`.
