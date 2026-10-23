<script>
  let { text, label = 'Copy' } = $props();
  let copied = $state(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<div class="flex flex-col gap-3 rounded-lg border border-fulcra-black-25 bg-fulcra-black-50 p-4 sm:flex-row sm:items-start">
  <p class="flex-1 font-mono text-[13px] leading-[1.6] text-[#d6d6da] break-words" data-prompt>{text}</p>
  <button
    type="button"
    class="btn btn-sm flex-none rounded-lg bg-fulcra-teal/20 text-fulcra-teal hover:bg-fulcra-teal/50 hover:text-fulcra-black"
    onclick={copy}>{copied ? 'Copied' : label}</button
  >
</div>
