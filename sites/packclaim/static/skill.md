---
name: packclaim
description: "Packclaim: Help one family member claim shared trip items and spot doubles and gaps with relatives. Reads and writes only the person's own Fulcra data under /built-on-fulcra/packclaim/, and asks before reading or saving anything."
homepage: "https://github.com/fulcradynamics/built-on-fulcra/tree/main/sites/packclaim"
license: "MIT"
user-invocable: true
---

# Packclaim

Your family's agents split the shared trip gear, so nothing is packed twice One shared list per trip for chargers, the first aid kit, sunscreen and snacks. Your own agent suggests what you usually bring, flags items claimed twice or by nobody, asks before claiming, and reminds you the night before.

This skill goes with the Packclaim site at https://packclaim.my.fulcra.ai. The site itself runs no AI: your agent does the thinking, with this skill.

## What your agent does with it

- Suggests items the person usually brings, from a pasted list or past trip notes they allow
- Saves the person's claims after they confirm each one
- Compares claims with lists relatives have shared read-only and flags items claimed twice or by nobody
- Reminds the person of their claimed items the night before departure
- Drafts an invitation the person can review and send to a relative

## Fulcra data it uses

Everything lives in the person's own Fulcra account, in the file store:

- Reads `/built-on-fulcra/packclaim/trip-list.json`
- Reads `/built-on-fulcra/packclaim/my-claims.json`
- Reads `/built-on-fulcra/packclaim/shared/`
- Writes `/built-on-fulcra/packclaim/trip-list.json`
- Writes `/built-on-fulcra/packclaim/my-claims.json`

The site's "Your shared trip list" form writes `/built-on-fulcra/packclaim/trip-list.json` when the person is signed in. Read it from there.

To connect to Fulcra, follow https://docs.fulcradynamics.com/agent-get-started.txt. Files are read and written with `uvx fulcra-api file download <path> <local>` and `uvx fulcra-api file upload <local> <path>`.

## How to work

1. Ask the person before reading their Fulcra files, calendar or past trip notes.
2. Read the trip list and the person's current claims.
3. Suggest items they usually bring and explain why for each one.
4. Ask before claiming any item, and save only the items they confirm.
5. Check lists relatives have shared and list items claimed twice and items nobody claimed.
6. Never claim, unclaim or message on behalf of a relative.
7. Remind the person of their claimed items the night before the departure date.
8. Show any invitation as a draft for the person to send themselves.

## Rules

- Start with a useful first pass from what the person tells or pastes. Nothing needs to be connected for that.
- Before connecting to Fulcra, say exactly which of the paths above you would read or write, and wait for a clear yes.
- Never book, pay, send messages or edit calendars; those stay the person's own actions.
- Any example numbers you show are illustrative unless they come from the person's own data.
