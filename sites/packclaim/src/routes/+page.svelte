<script>
  import { user } from '$lib/user';
  import { onMount } from 'svelte';
  import CopyPrompt from '$lib/components/CopyPrompt.svelte';
  import TripList from '$lib/components/TripList.svelte';
  import appLogo from '$lib/assets/packclaim-logo.svg';
  import fulcraLogo from '$lib/assets/app-icon_152.png';

  const SOURCE_URL = 'https://github.com/fulcradynamics/built-on-fulcra/tree/main/sites/packclaim';
  const agentPrompt =
    "Load the skill at https://packclaim.my.fulcra.ai/skill.md and use it to help me with this: Lets each family member's agent claim shared trip items, so nothing gets packed twice or left behind.";
  const forkPrompt =
    'Fork https://github.com/fulcradynamics/built-on-fulcra/tree/main/sites/packclaim with the build-and-deploy-a-web-app skill (npx skills add fulcradynamics/agent-skills --skill build-and-deploy-a-web-app) and put my own agent behind it.';

  const steps = [
    ['One list per trip', 'Chargers, the first aid kit, sunscreen, snacks: the shared gear goes on one list.'],
    ['Your agent suggests', 'It looks at what you usually bring and suggests what to claim, explaining why.'],
    ['Asks before claiming', 'Nothing is claimed for you until you say yes, and never for a relative.'],
    ['Flags doubles and gaps', "It compares your claims with lists relatives share and points out items claimed twice or by nobody."],
    ['Reminds you the night before', 'Your claimed items, the evening before departure.']
  ];

  onMount(async () => {
    await user.init();
  });
</script>

<svelte:head>
  <title>Packclaim — split the shared trip gear</title>
  <meta
    name="description"
    content="Lets each family member's agent claim shared trip items, so nothing gets packed twice or left behind."
  />
</svelte:head>

<div class="relative -m-3 flex min-h-screen flex-col bg-fulcra-black text-fulcra-white">
  <header class="flex flex-wrap items-center justify-between gap-4 px-7 py-5">
    <div class="flex items-center gap-3">
      <img src={appLogo} alt="Packclaim" class="h-[30px]" />
      <span class="text-[11px] uppercase tracking-[0.06em] text-fulcra-gray">powered by</span>
      <img src={fulcraLogo} alt="Fulcra" class="h-[22px] w-[22px] rounded-md" />
    </div>
    <nav class="flex items-center gap-5 text-[13px]">
      <a href="/skill.md" class="text-fulcra-gray hover:text-fulcra-white">Skill</a>
      <a href="/fork.md" class="text-fulcra-gray hover:text-fulcra-white">Fork</a>
      {#if $user.authenticated}
        <button type="button" class="text-fulcra-gray hover:text-fulcra-white" onclick={user.logout}>Sign out</button>
      {:else}
        <a href="/signin" class="text-fulcra-teal hover:text-fulcra-white">Sign in</a>
      {/if}
    </nav>
  </header>

  <main class="mx-auto flex w-full max-w-[860px] flex-col gap-14 px-6 pt-8 pb-20">
    <section class="flex flex-col gap-4">
      <h1 class="text-[40px] font-medium leading-[1.1] tracking-[-0.02em]">
        Your family's agents split the shared trip gear, so nothing is packed twice
      </h1>
      <p class="text-[17px] leading-[1.6] text-[#d6d6da]">
        One shared list per trip for chargers, the first aid kit, sunscreen and snacks. Your own agent suggests what
        you usually bring, flags items claimed twice or by nobody, asks before claiming, and reminds you the night
        before.
      </p>
      <p class="text-[14px] text-fulcra-gray">
        For families and relatives travelling together. This site runs no AI: your own agent does the thinking, with
        the Packclaim skill.
      </p>
    </section>

    <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each steps as [title, body], i}
        <div class="rounded-lg border border-fulcra-black-25 bg-[#1b1b23] p-4">
          <p class="mb-1 font-mono text-[11px] text-fulcra-teal">{i + 1}</p>
          <h3 class="mb-1 text-[15px] font-medium">{title}</h3>
          <p class="text-[13.5px] leading-[1.55] text-fulcra-gray">{body}</p>
        </div>
      {/each}
    </section>

    <section id="agent" class="flex flex-col gap-3">
      <h2 class="text-[22px] font-medium">Use this with your agent</h2>
      <p class="text-[14.5px] text-fulcra-gray">
        Paste this into your agent. It loads the <a href="/skill.md" class="text-fulcra-teal underline">Packclaim skill</a>,
        which tells it how to help you claim items, spot doubles and gaps, and which files in your Fulcra account it
        may read and write after asking you.
      </p>
      <CopyPrompt text={agentPrompt} />
    </section>

    <section id="trip" class="flex flex-col gap-3">
      <h2 class="text-[22px] font-medium">Your shared trip list</h2>
      {#if $user.authenticated}
        <TripList />
      {:else}
        <div class="rounded-lg border border-fulcra-black-25 bg-[#1b1b23] p-5">
          <p class="mb-4 text-[14.5px] leading-[1.6] text-[#d6d6da]">
            Sign in with Fulcra to save a trip list and the items you are bringing. The trip list and the items you
            claim land in your own Fulcra account, where your agent reads them and can share them read-only with
            relatives' agents.
          </p>
          <a
            href="/signin"
            class="btn rounded-lg bg-fulcra-teal/20 text-fulcra-teal hover:bg-fulcra-teal/50 hover:text-fulcra-black"
            >Sign in with Fulcra</a
          >
        </div>
      {/if}
    </section>

    <section id="fork" class="flex flex-col gap-3">
      <h2 class="text-[22px] font-medium">Make it yours</h2>
      <p class="text-[14.5px] text-fulcra-gray">
        Packclaim is open source: <a href={SOURCE_URL} class="text-fulcra-teal underline">view the source</a>. Rename it,
        change the default shared items or the list fields, and edit the skill. Paste this into your agent to fork it
        and deploy your own copy, or read the <a href="/fork.md" class="text-fulcra-teal underline">fork steps</a>.
      </p>
      <CopyPrompt text={forkPrompt} />
    </section>
  </main>

  <footer class="px-7 pb-8 text-[12.5px] text-fulcra-gray">
    Built on <a href="https://fulcradynamics.com" class="underline hover:text-fulcra-white">Fulcra</a>.
    <a href="https://fulcra.ai/legal/privacy-policy" class="ml-3 underline hover:text-fulcra-white">Privacy</a>
  </footer>
</div>
