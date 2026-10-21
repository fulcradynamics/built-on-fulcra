# Built on Fulcra

Small public web apps built on [Fulcra](https://fulcradynamics.com). Each one lives in `sites/<id>/` and is made to be forked.

The sites themselves run no AI and make no model calls. The idea is that you fork one and put your own agent behind it.

## What every site gives you

- `/skill.md`: a skill you load into your own agent. It tells the agent what the site is for and which Fulcra paths it reads and writes.
- `/fork.md`: how to fork the site, including a "Make it yours" block you can paste to your agent.
- Optional sign-in. If a site asks you to sign in, it is so the data you enter lands in your own Fulcra account, at a path your agent reads through the skill. Browsing never needs an account.

## Fork a site

Give your agent this one line, with the site id filled in:

> Fork https://github.com/fulcradynamics/built-on-fulcra/tree/main/sites/&lt;id&gt; with the build-and-deploy-a-web-app skill (`npx skills add fulcradynamics/agent-skills --skill build-and-deploy-a-web-app`) and put your own agent behind it.

Or do it by hand:

```sh
cp -R sites/<id> my-site && cd my-site
npm install
cp .env.example .env
npm run dev
```

Each site is a SvelteKit app copied from [app-template-svelte](https://github.com/fulcradynamics/app-template-svelte), with Fulcra sign-in through an Auth0 device flow.

## Layout

- `sites/<id>/`: one folder per site. Each has its own `README.md` saying what it does.
- `tools/check-site.mjs`: static checks for a site (see below).
- `tools/fake-fulcra/`: a small fake of the Fulcra API, used for tests.
- `tools/e2e-site.sh`: builds a site and runs its end-to-end test against the fake.
- `.github/workflows/site-checks.yml`: the CI job, named `site-checks`.

## How a site is checked

The `site-checks` job runs on every pull request and every push to `main`. It needs no secrets and deploys nothing.

1. `node --test "tools/**/*.test.mjs"` tests the tools themselves.
2. For each changed site, `node tools/check-site.mjs sites/<id>` checks the contract: a valid `site.json`, a `static/skill.md` that names every Fulcra path the site reads or writes, a `static/fork.md` with the source link, a README, the `build`, `check` and `test:e2e` scripts, the template sign-in files, no committed `.env`, no placeholder copy such as "coming soon", and no hosted-model calls.
3. `npm ci && npm run check` in the site.
4. `bash tools/e2e-site.sh sites/<id>` builds the site, starts it next to the fake Fulcra API, and runs `npm run test:e2e`. If the site asks for sign-in, it then checks that a signed-in test visitor wrote data, and only under the paths in `site.json`.

The fake API (`node tools/fake-fulcra/server.mjs --port 8790 --log out.jsonl`) has no dependencies. It accepts any bearer token, keeps files and records in memory, and logs every write as one JSON line.

## Where the sites come from

Company OS, Fulcra's internal automation, builds the sites. It starts from mockups that people voted for, builds each one with the `build-and-deploy-a-web-app` skill, and opens a pull request here. The checks above must pass before it merges and deploys.

## License

MIT. See [LICENSE](LICENSE).
