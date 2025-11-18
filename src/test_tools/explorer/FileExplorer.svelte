<script>
  import { ideStore } from '@svelte-ide/stores/ideStore.svelte.js'
  import FileViewer from './FileViewer.svelte'
  import { contextMenuService } from '@svelte-ide/core/ContextMenuService.svelte.js'
  import { openFileInIDE } from './fileService.svelte.js'
  import { explorerPersistence } from './ExplorerPersistenceService.svelte.js'

  let { files = [], toolId, loading = false, loadError = null, reloadFiles = null } = $props()
  let selectedFileName = $state(null)
  let persistenceLoaded = $state(false)

  $effect(() => {
    explorerPersistence.state.selectedItem
    selectedFileName = explorerPersistence.state.selectedItem
  })

  $effect(() => {
    explorerPersistence.state.loaded
    persistenceLoaded = explorerPersistence.state.loaded
  })

  function getIconForFile(fileName) {
    const extension = fileName.split('.').pop()
    switch (extension) {
      case 'js': return 'JS'
      case 'html': return '🌐'
      case 'css': return '🎨'
      case 'json': return '{}'
      case 'md': return '📝'
      default: return '📄'
    }
  }

  async function handleFileClick(file) {
    selectedFileName = file.name
    await explorerPersistence.setSelectedItem(file.name)
    ideStore.addLog(`Fichier ${file.name} sélectionné`, 'info', 'Explorateur')
  }

  async function handleFileDoubleClick(file) {
    selectedFileName = file.name
    try {
      await openFileInIDE(file.name, ideStore, FileViewer, toolId)
      ideStore.addLog(`Fichier ${file.name} ouvert`, 'info', 'Explorateur')
      ideStore.addNotification(
        'Fichier ouvert',
        `Le fichier "${file.name}" a été ouvert dans l'éditeur`,
        'success',
        'Explorateur'
      )
    } catch (error) {
      logger.error('Explorer: ouverture du fichier impossible', error)
      ideStore.addNotification(
        'Erreur d\'ouverture',
        error?.message || 'Impossible d\'ouvrir ce fichier.',
        'error',
        'Explorateur'
      )
    }
  }

  async function handleFolderClick(folder) {
    selectedFileName = folder.name
    await explorerPersistence.setSelectedItem(folder.name)
    ideStore.addLog(`Dossier ${folder.name} sélectionné`, 'info', 'Explorateur')
  }

  function handleContextMenu(e, item) {
    e.preventDefault()
    
    const menuItems = [
      {
        id: 'hello',
        label: 'Hello',
        icon: '👋',
        action: (context) => {
          ideStore.addLog(`Hello action sur ${context.name}`, 'info', 'Menu contextuel')
        }
      },
      {
        id: 'separator1',
        separator: true
      },
      {
        id: 'open',
        label: 'Ouvrir',
        icon: '📄',
        action: async (context) => {
          if (context.type === 'file') {
            await handleFileDoubleClick(context)
          }
        },
        disabled: item.type !== 'file'
      }
    ]

    contextMenuService.show(e.clientX, e.clientY, item, menuItems)
  }

  function handleRefreshClick() {
    if (typeof reloadFiles === 'function') {
      reloadFiles()
    }
  }

  function handleFolderKeydown(e, folder) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleFolderClick(folder)
    }
  }

  function handleFileKeydown(e, file) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleFileDoubleClick(file)
    } else if (e.key === ' ') {
      e.preventDefault()
      handleFileClick(file)
    }
  }
</script>

<div class="file-explorer">
  <div class="toolbar">
    <button class="refresh-btn" title="Actualiser" onclick={handleRefreshClick} disabled={loading}>
      🔄
    </button>
    <button class="new-folder-btn" title="Nouveau dossier">
      📁+
    </button>
    <button class="new-file-btn" title="Nouveau fichier">
      📄+
    </button>
  </div>
  
  <div class="file-tree" role="tree" aria-label="Arborescence de fichiers">
    {#if loadError}
      <div class="empty-state">
        <p>{loadError}</p>
        <p class="hint">Utilisez 🔄 pour réessayer</p>
      </div>
    {:else if loading || !persistenceLoaded}
      <div class="empty-state">
        <p>Chargement de la persistance...</p>
      </div>
    {:else if files.length > 0}
      {#each files as item}
        {#if item.type === 'folder'}
          <button 
            class="folder-item" 
            class:selected={selectedFileName === item.name} 
            data-context-menu
            onclick={() => handleFolderClick(item)}
            oncontextmenu={(e) => handleContextMenu(e, item)}
            onkeydown={(e) => handleFolderKeydown(e, item)}
            type="button"
            role="treeitem"
            aria-selected={selectedFileName === item.name}
          >
            <span class="icon" aria-hidden="true">📁</span>
            <span class="name">{item.name}</span>
          </button>
        {:else}
          <button 
            class="file-item" 
            class:selected={selectedFileName === item.name} 
            data-context-menu
            onclick={() => handleFileClick(item)} 
            ondblclick={() => handleFileDoubleClick(item)}
            oncontextmenu={(e) => handleContextMenu(e, item)}
            onkeydown={(e) => handleFileKeydown(e, item)}
            type="button"
            role="treeitem"
            aria-selected={selectedFileName === item.name}
          >
            <span class="icon" aria-hidden="true">📄</span>
            <span class="name">{item.name}</span>
          </button>
        {/if}
      {/each}
    {:else}
      <div class="empty-state">
        <p>Aucun fichier à afficher</p>
        <p class="hint">Connectez-vous à un projet</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .file-explorer {
    height: 100%;
    display: flex;
    flex-direction: column;
    user-select: none;
  }

  .toolbar {
    display: flex;
    gap: 4px;
    padding: 8px;
    border-bottom: 1px solid #3e3e42;
  }

  .toolbar button {
    background: transparent;
    border: 1px solid #3e3e42;
    color: #cccccc;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  }

  .toolbar button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toolbar button:hover {
    background: #3e3e42;
  }

  .file-tree {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .folder-item, .file-item {
    display: flex;
    align-items: center;
    padding: 4px 12px;
    cursor: pointer;
    font-size: 13px;
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;
    color: #cccccc;
  }

  .folder-item:hover, .file-item:hover {
    background: #3e3e42;
  }

  .folder-item.selected, .file-item.selected {
    background: #094771;
    color: #ffffff;
  }

  .icon {
    margin-right: 8px;
    font-size: 14px;
  }

  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty-state {
    text-align: center;
    padding: 20px;
    color: #858585;
  }

  .folder-item:focus-visible, .file-item:focus-visible {
    outline: 2px solid #007acc;
    outline-offset: 2px;
  }

  .empty-state p {
    margin: 4px 0;
    font-size: 12px;
  }

  .hint {
    font-style: italic;
    opacity: 0.7;
  }
</style>
