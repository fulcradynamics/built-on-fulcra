import { error, json } from '@sveltejs/kit';
import { readJson, writeJson, TRIP_LIST, MY_CLAIMS } from '$lib/server/packclaim-files.js';

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const text = String(item ?? '').trim().slice(0, 200);
    const key = text.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      out.push(text);
    }
  }
  return out.slice(0, 200);
}

function token(cookies) {
  const accessToken = cookies.get('fulcra_access_token');
  if (!accessToken) throw error(401, 'Sign in to save your trip list');
  return accessToken;
}

// Read the saved trip list and claims back from the visitor's Fulcra file store.
export async function GET({ cookies }) {
  const accessToken = token(cookies);
  try {
    const [tripList, myClaims] = await Promise.all([readJson(accessToken, TRIP_LIST), readJson(accessToken, MY_CLAIMS)]);
    return json({ tripList, myClaims });
  } catch (err) {
    console.error('Error reading trip list:', err);
    if (err.message?.includes('401')) throw error(401, 'Session expired, please sign in again');
    throw error(502, 'Could not read your trip list from Fulcra');
  }
}

// Save the trip list and the visitor's claims to their own Fulcra file store.
export async function POST({ cookies, request }) {
  const accessToken = token(cookies);
  const body = await request.json().catch(() => null);
  if (!body) throw error(400, 'Expected a JSON body');

  const tripName = String(body.tripName ?? '').trim().slice(0, 200);
  if (!tripName) throw error(400, 'Trip name is required');
  const departureDate = String(body.departureDate ?? '').trim();
  if (departureDate && !/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) throw error(400, 'Departure date must be YYYY-MM-DD');

  const updatedAt = new Date().toISOString();
  const tripList = {
    schema: 'packclaim.trip-list.v1',
    tripName,
    departureDate: departureDate || null,
    sharedItems: cleanList(body.sharedItems),
    myClaims: cleanList(body.myClaims),
    notes: String(body.notes ?? '').slice(0, 4000),
    updatedAt
  };
  const myClaims = {
    schema: 'packclaim.my-claims.v1',
    tripName,
    departureDate: tripList.departureDate,
    items: tripList.myClaims,
    updatedAt
  };

  try {
    await writeJson(accessToken, TRIP_LIST, tripList);
    await writeJson(accessToken, MY_CLAIMS, myClaims);
  } catch (err) {
    console.error('Error saving trip list:', err);
    if (err.message?.includes('401')) throw error(401, 'Session expired, please sign in again');
    throw error(502, 'Could not save your trip list to Fulcra');
  }
  return json({ tripList, myClaims });
}
