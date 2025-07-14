<script>
  import { ideStore } from '../../stores/ideStore.svelte.js'

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
    const newWidth = startWidth + (e.clientX - startX)
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
</script>

{#if ideStore.leftPanelVisible && ideStore.activeLeftTool}
  <div 
    class="left-panel" 
    style="width: {width}px"
    tabindex="-1"
    onfocus={() => ideStore.setFocusedPanel('left')}
    onblur={() => ideStore.clearFocusedPanel()}
    onclick={() => ideStore.setFocusedPanel('left')}
  >
    <div class="panel-content">
      {#if ideStore.activeLeftTool.component}
        {@const Component = ideStore.activeLeftTool.component}
        <Component {...ideStore.activeLeftTool.componentProps} />
      {:else}
        <div class="placeholder">
          <p>Contenu de {ideStore.activeLeftTool.name}</p>
          <p>Composant à implémenter</p>
        </div>
      {/if}
    </div>
    
    <div class="resize-handle" role="separator" onmousedown={startResize}></div>
  </div>
{/if}

<style>
  .left-panel {
    background: #252526;
    border-right: 1px solid #3e3e42;
    display: flex;
    flex-direction: column;
    position: relative;
    outline: none;
  }

  .panel-content {
    flex: 1;
    overflow: auto;
    padding: 8px;
  }

  .placeholder {
    color: #cccccc;
    text-align: center;
    margin-top: 20px;
  }

  .placeholder p {
    margin: 8px 0;
    font-size: 13px;
  }

  .resize-handle {
    position: absolute;
    top: 0;
    right: -2px;
    bottom: 0;
    width: 4px;
    cursor: ew-resize;
    background: transparent;
  }

  .resize-handle:hover {
    background: #007acc;
  }
</style>
