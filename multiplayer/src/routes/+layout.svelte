<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

<svelte:head>
  <!-- SVG favicon with playing card icon -->
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236366f1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M19 5v14a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2z'/><path d='M8 6h.01'/><path d='M16 18h.01'/><path d='M12 12h.01'/></svg>" />
</svelte:head>

{@render children()}
