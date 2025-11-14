<script>
  import { ideStore } from '@svelte-ide/stores/ideStore.svelte.js'
  import { contextMenuService } from '@svelte-ide/core/ContextMenuService.svelte.js'
  import { layoutService } from '@svelte-ide/core/LayoutService.svelte.js'
  import { dragDropService } from '@svelte-ide/core/DragDropService.svelte.js'
  import TabScrollContainer from './TabScrollContainer.svelte'
  import Tab from './Tab.svelte'

  let { layoutNode } = $props()
  let tabScrollContainer = $state(null)

  $effect(() => {
    if (tabScrollContainer && tabScrollContainer._scrollToTab && layoutNode.activeTab) {
      tabScrollContainer._scrollToTab(layoutNode.activeTab)
    }
  })

  function selectTab(tabId) {
    ideStore.setActiveTab(tabId)
  }

  async function closeTab(e, tabId) {
    e.stopPropagation()
    await ideStore.closeTab(tabId)
  }

  async function closeOtherTabs(currentTabId) {
    const tabsToClose = layoutNode.tabs.filter(tab => tab.id !== currentTabId && tab.closable)
    for (const tab of tabsToClose) {
      await ideStore.closeTab(tab.id)
    }
  }

  async function closeAllTabs() {
    const closableTabs = layoutNode.tabs.filter(tab => tab.closable)
    for (const tab of closableTabs) {
      await ideStore.closeTab(tab.id)
    }
  }

  function handleTabContextMenu(e, tab) {
    e.preventDefault()
    
    const menuItems = [
      {
        id: 'close-tab',
        label: 'Fermer l\'onglet',
        icon: '✕',
        action: async () => {
          if (tab.closable) {
            await ideStore.closeTab(tab.id)
          }
        },
        disabled: !tab.closable
      },
      {
        id: 'separator1',
        separator: true
      },
      {
        id: 'close-other-tabs',
        label: 'Fermer les autres onglets',
        icon: '📄',
        action: async () => {
          await closeOtherTabs(tab.id)
        },
        disabled: layoutNode.tabs.filter(t => t.id !== tab.id && t.closable).length === 0
      },
      {
        id: 'close-all-tabs',
        label: 'Fermer tous les onglets',
        icon: '🗂️',
        action: async () => {
          await closeAllTabs()
        },
        disabled: layoutNode.tabs.filter(t => t.closable).length === 0
      },
      {
        id: 'separator2',
        separator: true
      },
      {
        id: 'split-right',
        label: 'Diviser à droite',
        icon: '⊞',
        action: () => {
          layoutService.splitHorizontal(layoutNode.id)
        }
      },
      {
        id: 'split-bottom',
        label: 'Diviser en bas',
        icon: '⊟',
        action: () => {
          layoutService.splitVertical(layoutNode.id)
        }
      }
    ]

    contextMenuService.show(e.clientX, e.clientY, tab, menuItems)
  }

  function getTabbarPreviewState() {
    const preview = dragDropService.getDropPreview(layoutNode.id)
    if (!preview || preview.zone !== 'tabbar') {
      return { active: false, invalid: false }
    }

    const dragInfo = dragDropService.getDragInfo()
    const draggedTab = dragInfo.draggedTab
    if (!draggedTab) {
      return { active: true, invalid: false }
    }

    const isInternal = dragInfo.sourceGroup === layoutNode.id
    if (isInternal) {
      return { active: true, invalid: false }
    }

    const hasMatchingTab = layoutNode.tabs.some(tab =>
      tab.id === draggedTab.id || (draggedTab.fileName && tab.fileName === draggedTab.fileName)
    )

    return {
      active: true,
      invalid: hasMatchingTab
    }
  }

  function handleDragStart(e, tab) {
    dragDropService.startDrag(tab, layoutNode.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', '')
    
    e.target.style.cursor = 'grabbing'
    
    const dragImage = document.createElement('div')
    dragImage.textContent = `📄 ${tab.title}`
    dragImage.style.cssText = `
      position: absolute;
      top: -1000px;
      background: #2d2d30;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      pointer-events: none;
    `
    document.body.appendChild(dragImage)
    
    e.dataTransfer.setDragImage(dragImage, 0, 0)
    
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage)
      }
    }, 0)
  }

  function handleTabAreaDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    const dragInfo = dragDropService.getDragInfo()
    if (!dragInfo.draggedTab) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    dragDropService.setDropPreviewZone(layoutNode.id, 'tabbar', rect)
  }

  function handleTabAreaDrop(e) {
    e.preventDefault()
    
    const dragInfo = dragDropService.getDragInfo()
    if (!dragInfo.draggedTab) return

    const sourceGroupId = dragInfo.sourceGroup
    const targetGroupId = layoutNode.id
    const draggedTabId = dragInfo.draggedTab.id

    if (dragInfo.dropPreview?.zone === 'tabbar') {
      layoutService.moveTabBetweenGroups(
        draggedTabId,
        sourceGroupId,
        targetGroupId,
        -1
      )
    }
    
    dragDropService.endDrag()
  }

  function handleTabAreaDragLeave(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const { clientX, clientY } = e
    if (clientX >= rect.left && clientX <= rect.right &&
        clientY >= rect.top && clientY <= rect.bottom) {
      return
    }
    dragDropService.clearDragTarget()
  }

  function handleKeyNavigation(e) {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      return
    }

    const tabs = Array.from(e.currentTarget.querySelectorAll('[role="tab"]'))
    if (tabs.length === 0) return

    const currentElement = document.activeElement
    let currentIndex = tabs.indexOf(currentElement)

    if (currentIndex === -1) {
      const focusedId = layoutService.globalFocusedTab || layoutNode.activeTab
      currentIndex = layoutNode.tabs.findIndex(tab => tab.id === focusedId)
      if (currentIndex === -1) currentIndex = 0
    }

    let nextIndex = currentIndex

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % tabs.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    } else if (e.key === 'Home') {
      nextIndex = 0
    } else if (e.key === 'End') {
      nextIndex = tabs.length - 1
    }

    e.preventDefault()
    const nextTab = tabs[nextIndex]
    nextTab?.focus()
    const nextTabData = layoutNode.tabs[nextIndex]
    if (nextTabData) {
      selectTab(nextTabData.id)
    }
  }
</script>

<div 
  class="tab-area"
  class:drag-over={dragDropService.hasDropPreview(layoutNode.id) && dragDropService.getDropPreview(layoutNode.id)?.zone === 'tabbar'}
  class:tabbar-preview={getTabbarPreviewState().active}
  class:tabbar-preview-invalid={getTabbarPreviewState().invalid}
  ondragover={handleTabAreaDragOver}
  ondrop={handleTabAreaDrop}
  ondragleave={handleTabAreaDragLeave}
  role="tablist"
  aria-label="Barre des onglets"
  tabindex="0"
  onkeydown={handleKeyNavigation}
>
  <TabScrollContainer bind:this={tabScrollContainer}>
    {#each layoutNode.tabs as tab (tab.id)}
      <Tab 
        {tab}
        isActive={tab.id === layoutService.globalFocusedTab}
        groupId={layoutNode.id}
        {layoutNode}
        onSelect={selectTab}
        onClose={closeTab}
        onContextMenu={handleTabContextMenu}
        onDragStart={handleDragStart}
      />
    {/each}
  </TabScrollContainer>
</div>

<style>
  .tab-area {
    display: flex;
    background: #2d2d30;
    border-bottom: 1px solid #3e3e42;
    overflow: hidden;
    position: relative;
    min-height: 28px;
  }

  .tab-area.drag-over {
    box-shadow: inset 0 0 0 2px #007acc;
  }

  .tab-area.tabbar-preview::before {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(0, 122, 204, 0.12);
    border: 2px solid rgba(0, 122, 204, 0.4);
    border-radius: 2px;
    pointer-events: none;
    z-index: 0;
  }

  .tab-area.tabbar-preview-invalid::before {
    background: rgba(255, 68, 68, 0.12);
    border-color: rgba(255, 68, 68, 0.5);
  }
</style>
