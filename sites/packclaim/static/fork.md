# Make Packclaim yours

Packclaim is a small open-source site: Lets each family member's agent claim shared trip items, so nothing gets packed twice or left behind.. It is built to be forked, so you can run your own copy and put your own agent behind it.

Source: https://github.com/fulcradynamics/built-on-fulcra/tree/main/sites/packclaim
Live: https://packclaim.my.fulcra.ai

## The one-line way

Paste this to your agent:

```text
Fork https://github.com/fulcradynamics/built-on-fulcra/tree/main/sites/packclaim with the build-and-deploy-a-web-app skill (npx skills add fulcradynamics/agent-skills --skill build-and-deploy-a-web-app) and put my own agent behind it.
```

The build-and-deploy-a-web-app skill clones the source, keeps the Fulcra sign-in as it is, plans your changes with you, builds them, checks them and deploys your copy to its own Fulcra address. You do not need a Vercel account.

## What you would change

A visitor who forks Packclaim can rename it, change the default shared items or the list fields, and edit the skill text at /skill.md. They deploy it with the build-and-deploy-a-web-app skill and point their own agent at the served skill, which reads and writes the same /built-on-fulcra/packclaim/ files in their Fulcra account.

## By hand

```bash
git clone https://github.com/fulcradynamics/built-on-fulcra
cd built-on-fulcra/sites/packclaim
npm install
cp .env.example .env
npm run dev
```

The site's skill for your agent is in `static/skill.md`. It uses only paths under `/built-on-fulcra/packclaim/` in the signed-in person's own Fulcra account.
