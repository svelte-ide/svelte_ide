<script>
  import { ideStore } from '../../stores/ideStore.svelte.js'
  import NotificationPanel from './NotificationPanel.svelte'

  let { width = 250 } = $props()
  let isResizing = $state(false)
  let startX = $state(0)
  let startWidth = $state(width)

  function startResize(e) {
    isResizing = true
    startX = e.clientX
    startWidth = width
    
    // Empêcher la sélection de texte pendant le redimensionnement
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ew-resize'
    
    document.addEventListener('mousemove', handleResize)
    document.addEventListener('mouseup', stopResize)
  }

  function handleResize(e) {
    if (!isResizing) return
    const newWidth = startWidth - (e.clientX - startX)
    if (newWidth >= 32) {
      width = newWidth
    }
  }

  function stopResize() {
    isResizing = false
    
    // Restaurer la sélection de texte normale
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', stopResize)
  }

  let activeTool = $state(null)

  // Mise à jour réactive avec $effect - accès explicite aux propriétés pour forcer la réactivité
  $effect(() => {
    const tools = ideStore.rightTools
    const newActiveTool = tools.find(tool => tool.active) || null
    activeTool = newActiveTool
    // Accès explicite pour maintenir la réactivité
    if (ideStore.rightPanelVisible) ideStore.rightPanelVisible
  })
</script>

{#if ideStore.rightPanelVisible && (activeTool || ideStore.notificationsPanelVisible)}
  <div 
    class="right-panel" 
    style="width: {width}px"
    tabindex="-1"
    onfocus={() => ideStore.setFocusedPanel('right')}
    onblur={() => ideStore.clearFocusedPanel()}
    onclick={() => ideStore.setFocusedPanel('right')}
  >
    <div class="resize-handle" role="separator" onmousedown={startResize}></div>
    
    <div class="panel-content">
      {#if ideStore.notificationsPanelVisible}
        <NotificationPanel />
      {:else if activeTool}
        {#if activeTool.component}
          {@const Component = activeTool.component}
          <Component {...activeTool.componentProps} />
        {:else}
          <div class="placeholder">
            <p>Contenu de {activeTool.name}</p>
            <p>Composant à implémenter</p>
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .right-panel {
    background: #252526;
    border-left: 1px solid #3e3e42;
    display: flex;
    flex-direction: column;
    position: relative;
    outline: none;
  }

  .panel-content {
    flex: 1;
    overflow: auto;
    padding: 0;
  }

  .placeholder {
    color: #cccccc;
    text-align: center;
    margin-top: 20px;
    padding: 8px;
  }

  .placeholder p {
    margin: 8px 0;
    font-size: 13px;
  }

  .resize-handle {
    position: absolute;
    top: 0;
    left: -2px;
    bottom: 0;
    width: 4px;
    cursor: ew-resize;
    background: transparent;
  }

  .resize-handle:hover {
    background: #007acc;
  }
</style>
