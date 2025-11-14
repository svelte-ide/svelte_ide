<script>
  import { ideStore } from '@svelte-ide/stores/ideStore.svelte.js'
  import { layoutService } from '@svelte-ide/core/LayoutService.svelte.js'
  import { dragDropService } from '@svelte-ide/core/DragDropService.svelte.js'

  let { 
    tab, 
    isActive = false,
    groupId,
    layoutNode,
    onSelect,
    onClose,
    onContextMenu,
    onDragStart
  } = $props()

  function handleClick() {
    onSelect?.(tab.id)
  }

  function handleClose(e) {
    e.stopPropagation()
    onClose?.(e, tab.id)
  }

  function handleContextMenu(e) {
    e.preventDefault()
    onContextMenu?.(e, tab)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  function handleDragStart(e) {
    onDragStart?.(e, tab)
  }

  function handleDragOver(e, targetTab) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    const dragInfo = dragDropService.getDragInfo()
    if (!dragInfo.draggedTab || dragInfo.draggedTab.id === targetTab.id) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const dropAfter = e.clientX > rect.left + rect.width / 2
    dragDropService.setDragTarget(groupId, targetTab, dropAfter ? 'after' : 'before')
  }

  function handleDragLeave(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const { clientX, clientY } = e
    
    if (clientX < rect.left || clientX > rect.right || 
        clientY < rect.top || clientY > rect.bottom) {
      dragDropService.clearDragTarget({ preservePreview: true })
    }
  }

  function handleDrop(e, targetTab) {
    e.preventDefault()
    
    const dragInfo = dragDropService.getDragInfo()
    if (!dragInfo.draggedTab) return

    const sourceGroupId = dragInfo.sourceGroup
    const targetGroupId = groupId
    const draggedTabId = dragInfo.draggedTab.id

    if (sourceGroupId === targetGroupId) {
      const tabs = [...layoutNode.tabs]
      const draggedIndex = tabs.findIndex(t => t.id === draggedTabId)
      const targetIndex = tabs.findIndex(t => t.id === targetTab.id)
      
      if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
        dragDropService.endDrag()
        return
      }

      const rect = e.currentTarget.getBoundingClientRect()
      const dropAfter = e.clientX > rect.left + rect.width / 2

      const [draggedTab] = tabs.splice(draggedIndex, 1)
      let insertIndex = targetIndex

      if (draggedIndex < targetIndex) {
        insertIndex -= 1
      }

      if (dropAfter) {
        insertIndex += 1
      }

      insertIndex = Math.max(0, Math.min(insertIndex, tabs.length))
      tabs.splice(insertIndex, 0, draggedTab)
      
      layoutService.reorderTabsInGroup(targetGroupId, tabs)
    } else {
      layoutService.moveTabBetweenGroups(
        draggedTabId,
        sourceGroupId,
        targetGroupId,
        targetTab.index || -1
      )
    }
    
    dragDropService.endDrag()
  }

  function handleDragEnd() {
    dragDropService.endDrag()
  }
</script>

<div 
  class="tab"
  class:active={isActive}
  class:dragging={dragDropService.isTabBeingDragged(tab.id)}
  class:drag-over={dragDropService.isTabDragTarget(tab.id)}
  class:reorder-before={dragDropService.getTabTargetPosition(tab.id) === 'before'}
  class:reorder-after={dragDropService.getTabTargetPosition(tab.id) === 'after'}
  data-context-menu
  data-tab-id={tab.id}
  onclick={handleClick}
  onkeydown={handleKeyDown}
  oncontextmenu={handleContextMenu}
  ondragstart={handleDragStart}
  ondragover={(e) => handleDragOver(e, tab)}
  ondragleave={handleDragLeave}
  ondrop={(e) => handleDrop(e, tab)}
  ondragend={handleDragEnd}
  draggable="true"
  role="tab"
  id={`tab-${tab.id}`}
  aria-selected={isActive}
  aria-controls={`panel-${groupId}`}
  tabindex={isActive ? 0 : -1}
>
  <span class="tab-title">
    {#if tab.icon}
      <span class="tab-icon" aria-hidden="true">{tab.icon}</span>
    {/if}
    {tab.title}
    {#if ideStore.isTabModified(tab.id)}
      <span class="modified-indicator" aria-hidden="true">●</span>
    {/if}
  </span>
  {#if tab.closable}
    <button 
      class="close-tab-btn"
      onclick={handleClose}
      type="button"
      aria-label={`Fermer ${tab.title}`}
    >
      ×
    </button>
  {/if}
</div>

<style>
  .tab {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px;
    background: #2d2d30;
    color: #cccccc;
    border-right: 1px solid #3e3e42;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    min-width: 0;
    flex-shrink: 0;
    transition: background-color 0.15s ease, color 0.15s ease, margin 0.12s ease;
    position: relative;
    z-index: 1;
    font-size: 12px;
    line-height: 1.2;
  }

  .tab:hover {
    background: #383838;
    color: #ffffff;
  }

  .tab.active {
    background: #1e1e1e;
    color: #ffffff;
    border-bottom: 2px solid #007acc;
  }

  .tab.dragging {
    opacity: 0.5;
    cursor: grabbing;
  }

  .tab.drag-over {
    background: #094771;
    border-left: 2px solid #007acc;
  }

  .tab.reorder-before {
    margin-left: 14px;
  }

  .tab.reorder-after {
    margin-right: 14px;
  }

  .tab-title {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
  }

  .tab-icon {
    flex-shrink: 0;
    font-size: 12px;
    line-height: 1;
  }

  .modified-indicator {
    color: #f48771;
    font-weight: bold;
    flex-shrink: 0;
    font-size: 11px;
  }

  .close-tab-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    background: none;
    border: none;
    color: #858585;
    cursor: pointer;
    border-radius: 2px;
    margin-left: 6px;
    flex-shrink: 0;
    font-size: 12px;
    line-height: 1;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .close-tab-btn:hover {
    background: #e81123;
    color: white;
  }
</style>
