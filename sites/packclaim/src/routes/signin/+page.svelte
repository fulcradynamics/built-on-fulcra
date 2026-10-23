<script>
  import { user } from '$lib/user';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import LoginDeviceFlow from '$lib/components/LoginDeviceFlow.svelte';

  onMount(async () => {
    await user.init();
  });

  // Once the device flow completes, take the visitor back to their trip list.
  $effect(() => {
    if ($user.authenticated) goto('/#trip');
  });
</script>

<svelte:head>
  <title>Sign in — Packclaim</title>
</svelte:head>

<LoginDeviceFlow />
