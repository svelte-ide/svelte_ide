<script>
import { themeService } from '../../core/themeService.svelte.js'

let { error = null } = $props()
let message = $derived(error?.message || 'Boot error')
</script>

<div
  class="boot-error"
  style:--background={themeService.getColor('background')}
  style:--surface-raised={themeService.getColor('surfaceRaised')}
  style:--text={themeService.getColor('text')}
  style:--border={themeService.getColor('border')}
  style:--text-muted={themeService.getColor('textMuted')}
  style:--danger={themeService.getColor('danger')}
>
  <div class="boot-error-card">
    <h1>Startup error</h1>
    <p class="message">{message}</p>
    <p class="hint">Check VITE_APP_KEY, VITE_AUTH_PROVIDERS, and provider environment variables.</p>
  </div>
</div>

<style>
.boot-error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100%;
  padding: 32px;
  background: var(--background);
  color: var(--text);
}

.boot-error-card {
  max-width: 480px;
  width: 100%;
  padding: 24px;
  border: 1px solid var(--border);
  background: var(--surface-raised);
}

.message {
  margin-top: 12px;
  color: var(--danger);
}

.hint {
  margin-top: 16px;
  color: var(--text-muted);
}
</style>
