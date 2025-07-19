<script>
  import { ideStore } from '../../stores/ideStore.svelte.js'

  let { isActive = false } = $props()
</script>

<button
  class="notification-button"
  class:active={isActive}
  class:has-unread={ideStore.unreadNotificationsCount > 0}
  onclick={() => ideStore.toggleNotificationsPanel()}
  title="Notifications"
>
  <i class="icon">🔔</i>
  {#if ideStore.unreadNotificationsCount > 0}
    <span class="notification-badge">{ideStore.unreadNotificationsCount}</span>
  {/if}
</button>

<style>
  .notification-button {
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    color: #cccccc;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    border-radius: 3px;
  }

  .notification-button:hover {
    background: #3e3e42;
  }

  .notification-button.active {
    background: #094771;
    color: #ffffff;
  }

  .notification-button.has-unread {
    color: #007acc;
  }

  .icon {
    font-size: 16px;
    font-style: normal;
  }

  .notification-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    background: #f87171;
    color: white;
    font-size: 10px;
    font-weight: bold;
    padding: 1px 4px;
    border-radius: 8px;
    min-width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
</style>
