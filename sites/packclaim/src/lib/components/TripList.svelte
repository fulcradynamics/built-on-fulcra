<script>
  import { onMount } from 'svelte';

  const DEFAULT_SHARED_ITEMS = ['Phone chargers', 'First aid kit', 'Sunscreen', 'Snacks for the drive'];

  let tripName = $state('');
  let departureDate = $state('');
  let sharedText = $state(DEFAULT_SHARED_ITEMS.join('\n'));
  let claimsText = $state('');
  let notes = $state('');

  let loading = $state(true);
  let saving = $state(false);
  let message = $state(null);
  let errorMessage = $state(null);
  let savedAt = $state(null);

  const toList = (text) =>
    text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  const same = (a, b) => a.toLowerCase() === b.toLowerCase();

  let sharedItems = $derived(toList(sharedText));
  let myClaims = $derived(toList(claimsText));
  let unclaimed = $derived(sharedItems.filter((s) => !myClaims.some((c) => same(c, s))));
  let offList = $derived(myClaims.filter((c) => !sharedItems.some((s) => same(c, s))));

  function claim(item) {
    claimsText = [...myClaims, item].join('\n');
  }

  function fill(tripList) {
    tripName = tripList.tripName ?? '';
    departureDate = tripList.departureDate ?? '';
    sharedText = (tripList.sharedItems ?? []).join('\n');
    claimsText = (tripList.myClaims ?? []).join('\n');
    notes = tripList.notes ?? '';
    savedAt = tripList.updatedAt ?? null;
  }

  onMount(async () => {
    try {
      const res = await fetch('/api/trip');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `Error ${res.status}`);
      const { tripList } = await res.json();
      if (tripList) fill(tripList);
    } catch (err) {
      errorMessage = `Could not load your saved list: ${err.message}`;
    } finally {
      loading = false;
    }
  });

  async function save(event) {
    event.preventDefault();
    saving = true;
    message = null;
    errorMessage = null;
    try {
      const res = await fetch('/api/trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripName, departureDate, sharedItems, myClaims, notes })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
      fill(data.tripList);
      message = 'Saved to your Fulcra account.';
    } catch (err) {
      errorMessage = `Could not save: ${err.message}`;
    } finally {
      saving = false;
    }
  }

  const field =
    'w-full rounded-lg border border-fulcra-black-25 bg-fulcra-black-50 px-3 py-2 text-[14.5px] text-fulcra-white focus:border-fulcra-teal focus:outline-none';
  const label = 'mb-1.5 block text-[13.5px] font-medium text-[#d6d6da]';
</script>

<form class="flex flex-col gap-5 rounded-lg border border-fulcra-black-25 bg-[#1b1b23] p-5" onsubmit={save}>
  {#if loading}
    <div class="flex items-center gap-2 text-fulcra-gray">
      <span class="loading loading-spinner loading-sm"></span>
      <span class="text-[13px]">Loading your saved list…</span>
    </div>
  {/if}

  <div class="grid gap-5 sm:grid-cols-2">
    <div>
      <label class={label} for="tripName">Trip name</label>
      <input id="tripName" name="tripName" class={field} bind:value={tripName} required maxlength="200" />
    </div>
    <div>
      <label class={label} for="departureDate">Departure date</label>
      <input id="departureDate" name="departureDate" type="date" class={field} bind:value={departureDate} />
    </div>
  </div>

  <div class="grid gap-5 sm:grid-cols-2">
    <div>
      <label class={label} for="sharedItems">Shared items the family splits</label>
      <textarea id="sharedItems" name="sharedItems" rows="7" class={field} bind:value={sharedText}></textarea>
      <p class="mt-1 text-[12px] text-fulcra-gray">One item per line.</p>
    </div>
    <div>
      <label class={label} for="myClaims">Items I am bringing</label>
      <textarea id="myClaims" name="myClaims" rows="7" class={field} bind:value={claimsText}></textarea>
      <p class="mt-1 text-[12px] text-fulcra-gray">One item per line.</p>
    </div>
  </div>

  {#if unclaimed.length || offList.length}
    <div class="flex flex-col gap-3 rounded-lg border border-fulcra-black-25 p-4 text-[13.5px]">
      {#if unclaimed.length}
        <div>
          <p class="mb-2 text-[#d6d6da]">Shared items you have not claimed (a relative may be bringing them):</p>
          <div class="flex flex-wrap gap-2">
            {#each unclaimed as item}
              <button
                type="button"
                class="rounded-full border border-fulcra-black-20 px-3 py-1 text-fulcra-gray hover:border-fulcra-teal hover:text-fulcra-teal"
                onclick={() => claim(item)}>+ {item}</button
              >
            {/each}
          </div>
        </div>
      {/if}
      {#if offList.length}
        <p class="text-fulcra-gray">
          You are bringing items that are not on the shared list: {offList.join(', ')}.
        </p>
      {/if}
    </div>
  {/if}

  <div>
    <label class={label} for="notes">Notes for my agent</label>
    <textarea id="notes" name="notes" rows="3" class={field} bind:value={notes}></textarea>
  </div>

  <div class="flex flex-wrap items-center gap-4">
    <button
      type="submit"
      class="btn rounded-lg bg-fulcra-teal/20 text-fulcra-teal hover:bg-fulcra-teal/50 hover:text-fulcra-black"
      disabled={saving}>{saving ? 'Saving…' : 'Save to Fulcra'}</button
    >
    {#if message}<p class="text-[13px] text-fulcra-teal" role="status">{message}</p>{/if}
    {#if errorMessage}<p class="text-[13px] text-fulcra-error" role="alert">{errorMessage}</p>{/if}
  </div>

  <p class="text-[12px] leading-[1.6] text-fulcra-gray">
    Saved to <code>/built-on-fulcra/packclaim/trip-list.json</code> and <code>my-claims.json</code> in your own Fulcra
    account{#if savedAt}, last saved {new Date(savedAt).toLocaleString()}{/if}. Your agent reads them there with the
    Packclaim skill.
  </p>
</form>
