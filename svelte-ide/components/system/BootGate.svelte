<script>
import { themeService } from '../../core/themeService.svelte.js';
import { getAuthStore } from '../../stores/authStore.svelte.js';
import { bootStore } from '../../stores/bootStore.svelte.js';
import BootErrorScreen from './BootErrorScreen.svelte';
import LoginScreen from './LoginScreen.svelte';

let { children } = $props()

const authStore = getAuthStore()

$effect(() => {
  void bootStore.start()
})

$effect(() => {
  authStore.isAuthenticated
  authStore.initialized
  bootStore.sync()
})
</script>

<div
  class="boot-gate-theme"
  style:--background={themeService.getColor('background')}
  style:--surface={themeService.getColor('surface')}
  style:--surface-alt={themeService.getColor('surfaceAlt')}
  style:--surface-raised={themeService.getColor('surfaceRaised')}
  style:--surface-hover={themeService.getColor('surfaceHover')}
  style:--text={themeService.getColor('text')}
  style:--text-muted={themeService.getColor('textMuted')}
  style:--text-on-primary={themeService.getColor('textOnPrimary')}
  style:--border={themeService.getColor('border')}
  style:--border-strong={themeService.getColor('borderStrong')}
  style:--primary={themeService.getColor('primary')}
  style:--danger={themeService.getColor('danger')}
  style:--shadow={themeService.getShadow('md')}
  style:--shadow-menu={themeService.getShadow('menu')}
>
  {#if bootStore.state === 'error'}
    <BootErrorScreen error={bootStore.error} />
  {:else if bootStore.state === 'authenticated'}
    {@render children?.()}
  {:else}
    <LoginScreen />
  {/if}
</div>

<style>
.boot-gate-theme {
  width: 100%;
  height: 100vh;
}
</style>
