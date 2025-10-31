<script>
  import { mainMenuService } from '@/core/MainMenuService.svelte.js'

  let menus = $state([])
  let openMenuId = $state(null)
  let rootElement = null

  $effect(() => {
    menus = mainMenuService.menus
  })

  function toggleMenu(menuId) {
    openMenuId = openMenuId === menuId ? null : menuId
  }

  function closeMenu() {
    openMenuId = null
  }

  function handleItemClick(item) {
    if (item.disabled) {
      return
    }
    if (typeof item.action === 'function') {
      item.action()
    }
    closeMenu()
  }

  $effect(() => {
    if (!openMenuId) {
      return
    }
    if (typeof document === 'undefined') {
      return
    }
    const handlePointerDown = (event) => {
      if (!rootElement) {
        return
      }
      if (!rootElement.contains(event.target)) {
        closeMenu()
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  })
</script>

<div class="main-menu" bind:this={rootElement}>
  <ul class="menu-bar" role="menubar">
    {#each menus as menu (menu.id)}
      <li class="menu-bar-item" class:open={openMenuId === menu.id} role="none">
        <button
          type="button"
          class="menu-trigger"
          onclick={() => toggleMenu(menu.id)}
          aria-haspopup="true"
          aria-expanded={openMenuId === menu.id}
        >
          {menu.label}
        </button>

        {#if openMenuId === menu.id}
          <div class="menu-dropdown" role="menu">
            {#if menu.items.length === 0}
              <div class="menu-empty" role="presentation">Aucune action</div>
            {/if}

            {#each menu.items as item (item.id)}
              {#if item.separator}
                <div class="menu-separator" role="separator"></div>
              {:else}
                <button
                  type="button"
                  class="menu-entry"
                  class:disabled={item.disabled}
                  onclick={() => handleItemClick(item)}
                  role="menuitem"
                >
                  <span class="entry-label">{item.label}</span>
                  {#if item.shortcut}
                    <span class="entry-shortcut">{item.shortcut}</span>
                  {/if}
                </button>
              {/if}
            {/each}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  .main-menu {
    position: relative;
    display: flex;
    align-items: center;
    height: 24px;
  }

  .menu-bar {
    list-style: none;
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    padding: 0;
  }

  .menu-bar-item {
    position: relative;
  }

  .menu-trigger {
    background: transparent;
    border: none;
    color: #cccccc;
    font-size: 13px;
    font-weight: 500;
    padding: 0 10px;
    height: 24px;
    line-height: 24px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .menu-trigger:hover,
  .menu-bar-item.open .menu-trigger {
    background: #3e3e42;
    color: #ffffff;
  }

  .menu-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 180px;
    background: #1f1f21;
    border: 1px solid #3e3e42;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    padding: 4px 0;
    margin-top: 4px;
    z-index: 1200;
  }

  .menu-entry {
    width: 100%;
    background: transparent;
    border: none;
    color: #dddddd;
    font-size: 13px;
    padding: 6px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .menu-entry:hover {
    background: #2f2f33;
    color: #ffffff;
  }

  .menu-entry.disabled {
    opacity: 0.5;
    cursor: default;
  }

  .menu-entry.disabled:hover {
    background: transparent;
    color: #dddddd;
  }

  .entry-shortcut {
    color: #888888;
    font-size: 12px;
    margin-left: 16px;
  }

  .menu-separator {
    height: 1px;
    background: #39393c;
    margin: 4px 0;
  }

  .menu-empty {
    padding: 6px 12px;
    color: #777777;
    font-size: 13px;
  }
</style>
