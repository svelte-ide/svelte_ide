<script>
  import { ideStore } from '../../stores/ideStore.svelte.js'
  import NotificationButton from './NotificationButton.svelte'

  function handleToolClick(tool) {
    ideStore.toggleRightPanel(tool.id)
    
    // Fermer les notifications si un outil est activé
    if (tool.active && ideStore.notificationsPanelVisible) {
      ideStore.notificationsPanelVisible = false
    }
    
    // IMPORTANT: Vérifier l'état APRÈS le toggle
    if (tool.active) {
      ideStore.setStatusMessage(`${tool.name} activé`)
    } else {
      ideStore.setStatusMessage(`${tool.name} désactivé`)
    }
  }

  // Forcer la réactivité avec accès explicite aux propriétés
  $effect(() => {
    // Accès explicite pour forcer la réactivité
    if (ideStore.rightTools) ideStore.rightTools.length
    if (ideStore.focusedPanel) ideStore.focusedPanel
    if (ideStore.notificationsPanelVisible) ideStore.notificationsPanelVisible
    if (ideStore.rightToolbarItems) ideStore.rightToolbarItems.length
  })
</script>

<div class="right-toolbar">
  <div class="tools-section">
    {#each ideStore.rightTools as tool (tool.id)}
      <button
        class="tool-button"
        class:active={tool.active}
        class:focused={tool.active && ideStore.focusedPanel === 'right'}
        onclick={() => handleToolClick(tool)}
        title={tool.name}
      >
        <i class="icon">{tool.icon}</i>
      </button>
    {/each}
  </div>
  
  <div class="bottom-section">
    <!-- Bouton notifications intégré -->
    <div class="toolbar-item">
      <NotificationButton isActive={ideStore.notificationsPanelVisible} />
    </div>
    
    <!-- Items génériques additionnels -->
    {#each ideStore.rightToolbarItems as item (item.id)}
      <div class="toolbar-item">
        {#if item.component}
          {@const Component = item.component}
          <Component {...item.props} />
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .right-toolbar {
    width: 48px;
    background: #2d2d30;
    border-left: 1px solid #3e3e42;
    display: flex;
    flex-direction: column;
    padding: 0;
  }

  .tools-section {
    display: flex;
    flex-direction: column;
    padding: 8px 0;
  }

  .bottom-section {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    border-top: 1px solid #3e3e42;
    padding: 8px 0;
  }

  .toolbar-item {
    margin: 2px 8px;
  }

  .tool-button {
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
    margin: 2px 8px;
    border-radius: 3px;
  }

  .tool-button:hover {
    background: #3e3e42;
  }

  .tool-button.active {
    background: #094771;
    color: #ffffff;
  }

  .tool-button.focused {
    background: #0e639c;
    color: #ffffff;
  }

  .icon {
    font-size: 16px;
    font-style: normal;
  }
</style>
