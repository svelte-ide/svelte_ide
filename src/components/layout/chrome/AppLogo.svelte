<script>
  let {
    size = 24,
    class: className = '',
    branding = null
  } = $props()

  let componentProps = { size }

  $effect(() => {
    componentProps = {
      size,
      ...(branding?.logoProps ?? {})
    }
  })

  const heightStyle = $derived(`${size}px`)
  const hasCustomComponent = $derived(Boolean(branding?.logoComponent))
  const customText = $derived(branding?.logoText ?? null)
  const textFontSize = $derived(`${Math.round(size * 0.75)}px`)
</script>

<div class={`app-logo ${className}`.trim()} style:height={heightStyle} style:min-width={heightStyle}>
  {#if hasCustomComponent}
    <svelte:component this={branding.logoComponent} {...componentProps} />
  {:else}
    <span class="app-logo__text" style:font-size={textFontSize}>
      {customText ?? '❱SIDE❰'}
    </span>
  {/if}
</div>

<style>
  .app-logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .app-logo__text {
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    white-space: nowrap;
  }
</style>
