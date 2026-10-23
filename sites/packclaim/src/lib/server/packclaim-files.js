import { env } from '$env/dynamic/public';

// Packclaim's files live in the visitor's own Fulcra file store.
export const FOLDER = '/built-on-fulcra/packclaim';
export const TRIP_LIST = 'trip-list.json';
export const MY_CLAIMS = 'my-claims.json';

const api = () => env.PUBLIC_FULCRA_API_ENDPOINT;

async function fulcra(accessToken, path, options = {}) {
  const response = await fetch(`${api()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, ...options.headers }
  });
  if (!response.ok) throw new Error(`Fulcra API ${response.status} on ${path}`);
  return response;
}

/**
 * Write JSON to FOLDER/name: create the file entry, then send the bytes to the
 * returned upload url (a pre-signed url, so no bearer token).
 */
export async function writeJson(accessToken, name, data) {
  const body = JSON.stringify(data, null, 2);
  const created = await fulcra(accessToken, 'input/v1/file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: FOLDER,
      name,
      content_type: 'application/json',
      content_length: Buffer.byteLength(body)
    })
  });
  const { url } = await created.json();
  const upload = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  if (!upload.ok) throw new Error(`Upload of ${name} failed: ${upload.status}`);
}

/** Read FOLDER/name as JSON, or null when it has not been saved yet. */
export async function readJson(accessToken, name) {
  const listing = await (await fulcra(accessToken, `input/v1/file?path=${encodeURIComponent(FOLDER)}`)).json();
  // Each save adds a new entry; entries still in state "created" never got their bytes.
  const latest = (listing?.files || [])
    .filter((f) => f.name === name && f.state !== 'created')
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  if (!latest) return null;
  const text = await (await fulcra(accessToken, `input/v1/file/${latest.id}/download`)).text();
  return JSON.parse(text);
}
