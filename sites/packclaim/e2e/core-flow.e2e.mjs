// End-to-end check of Packclaim's core flow over HTTP.
// BASE_URL: the running site. FAKE_FULCRA_TOKEN: a token the site's Fulcra API accepts.
import assert from 'node:assert/strict';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const TOKEN = process.env.FAKE_FULCRA_TOKEN;
assert.ok(TOKEN, 'FAKE_FULCRA_TOKEN is required');
const signedIn = { cookie: `fulcra_access_token=${TOKEN}` };

const decode = (s) =>
  s.replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

async function step(name, fn) {
  await fn();
  console.log(`ok - ${name}`);
}

await step('home page works signed out, with both prompts', async () => {
  const res = await fetch(`${BASE_URL}/`);
  assert.equal(res.status, 200);
  const html = decode(await res.text());
  assert.ok(html.includes('Use this with your agent'));
  assert.ok(html.includes('Make it yours'));
  assert.ok(
    html.includes(
      "Load the skill at https://packclaim.my.fulcra.ai/skill.md and use it to help me with this: Lets each family member's agent claim shared trip items, so nothing gets packed twice or left behind."
    )
  );
  assert.ok(
    html.includes(
      'Fork https://github.com/fulcradynamics/built-on-fulcra/tree/main/sites/packclaim with the build-and-deploy-a-web-app skill (npx skills add fulcradynamics/agent-skills --skill build-and-deploy-a-web-app) and put my own agent behind it.'
    )
  );
});

await step('serves /skill.md and /fork.md signed out', async () => {
  const skill = await fetch(`${BASE_URL}/skill.md`);
  assert.equal(skill.status, 200);
  assert.ok((await skill.text()).includes('name: packclaim'));
  const fork = await fetch(`${BASE_URL}/fork.md`);
  assert.equal(fork.status, 200);
  assert.ok((await fork.text()).includes('https://github.com/fulcradynamics/built-on-fulcra/tree/main/sites/packclaim'));
});

await step('trip list API needs sign-in', async () => {
  const res = await fetch(`${BASE_URL}/api/trip`);
  assert.equal(res.status, 401);
});

const trip = {
  tripName: `Lake cabin ${Date.now()}`,
  departureDate: '2026-12-19',
  sharedItems: ['Phone chargers', 'First aid kit', 'Sunscreen', 'Snacks for the drive'],
  myClaims: ['First aid kit', 'Sunscreen'],
  notes: 'Remind me the night before.'
};

await step('saves the trip list and claims signed in', async () => {
  const res = await fetch(`${BASE_URL}/api/trip`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...signedIn },
    body: JSON.stringify(trip)
  });
  assert.equal(res.status, 200, await res.clone().text());
  const body = await res.json();
  assert.equal(body.tripList.tripName, trip.tripName);
});

await step('reads the saved list back signed in', async () => {
  const res = await fetch(`${BASE_URL}/api/trip`, { headers: signedIn });
  assert.equal(res.status, 200);
  const { tripList, myClaims } = await res.json();
  assert.equal(tripList.tripName, trip.tripName);
  assert.equal(tripList.departureDate, trip.departureDate);
  assert.deepEqual(tripList.sharedItems, trip.sharedItems);
  assert.deepEqual(tripList.myClaims, trip.myClaims);
  assert.equal(tripList.notes, trip.notes);
  assert.deepEqual(myClaims.items, trip.myClaims);
});

await step('rejects a save without a trip name', async () => {
  const res = await fetch(`${BASE_URL}/api/trip`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...signedIn },
    body: JSON.stringify({ ...trip, tripName: ' ' })
  });
  assert.equal(res.status, 400);
});

console.log('core flow ok');
