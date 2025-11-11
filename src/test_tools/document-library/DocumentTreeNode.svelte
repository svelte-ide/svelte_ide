<script>
  let {
    node,
    depth = 0,
    expandedFolders,
    dragOverFolderId,
    draggedNodeId,
    draggedNodeType,
    ROOT_ID,
    getSortedChildren,
    openDocument,
    toggleFolder,
    openContextMenu,
    handleNodeDragStart,
    handleNodeDragEnd,
    handleFolderDragOver,
    handleFolderDragLeave,
    handleFolderDrop,
    sendToBackend,
    deleteDocument,
    getFileIcon,
    UploadIcon,
    Trash2Icon,
    FolderIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    isRoot = false
  } = $props()

  const isFolder = $derived(node?.nodeType === 'folder')
  const isExpanded = $derived(isFolder ? !!expandedFolders[node?.id] : false)
  const childNodes = $derived(isFolder ? getSortedChildren(node) : [])
  const indent = $derived(Math.max(0, depth) * 14)
  const folderDraggable = $derived(isFolder && node?.id !== ROOT_ID)
  const nodeDraggable = $derived(node?.nodeType === 'document' || folderDraggable)
</script>
<li
  class="tree-item"
  class:folder={isFolder}
  class:document={!isFolder}
  class:drag-over={isFolder && dragOverFolderId === node.id}
  class:root={isRoot}
  class:dragging-document={draggedNodeType === 'document' && draggedNodeId === node.id}
  class:dragging-folder={draggedNodeType === 'folder' && draggedNodeId === node.id}
  role="treeitem"
  aria-expanded={isFolder ? isExpanded : undefined}
  aria-selected="false"
  aria-level={depth + 1}
>
  <div class="tree-node" ondragover={isFolder ? (event) => handleFolderDragOver(event, node.id) : undefined} ondragleave={isFolder ? (event) => handleFolderDragLeave(event, node.id) : undefined} ondrop={isFolder ? (event) => handleFolderDrop(event, node.id) : undefined}>
    <div
      class="item-content"
      style={`padding-left: ${indent}px`}
      onclick={() => (node.nodeType === 'document' ? openDocument(node.id) : undefined)}
      ondblclick={() => (isFolder ? toggleFolder(node.id) : undefined)}
      onkeydown={(event) => {
        if (event.key === 'Enter') {
          node.nodeType === 'document' ? openDocument(node.id) : toggleFolder(node.id)
        }
      }}
      tabindex="0"
      role="button"
      oncontextmenu={(event) => openContextMenu(event, node)}
      draggable={nodeDraggable}
      ondragstart={nodeDraggable ? (event) => handleNodeDragStart(event, node) : undefined}
      ondragend={nodeDraggable ? handleNodeDragEnd : undefined}
    >
      {#if isFolder}
        <button
          type="button"
          class="twisty"
          onclick={(event) => {
            event.stopPropagation()
            toggleFolder(node.id)
          }}
          aria-label={isExpanded ? 'Réduire' : 'Développer'}
        >
          {@html (isExpanded ? ChevronDownIcon : ChevronRightIcon)({ size: 12 }).svg}
        </button>
        <span class="item-icon folder-icon">{@html FolderIcon({ size: 14 }).svg}</span>
      {:else}
        <span class="twisty placeholder"></span>
        <span class="item-icon">{@html getFileIcon(node.name, node.type)({ size: 14 }).svg}</span>
      {/if}

      <span class="item-label">{node.name}</span>

      {#if node.nodeType === 'document'}
        <button type="button" class="item-action" onclick={(event) => { event.stopPropagation(); sendToBackend(node.id) }} title="Envoyer au backend" aria-label={`Envoyer ${node.name} au backend`}>
          {@html UploadIcon({ size: 12 }).svg}
        </button>
        <button type="button" class="item-action" onclick={(event) => { event.stopPropagation(); deleteDocument(node.id) }} title="Supprimer" aria-label={`Supprimer ${node.name}`}>
          {@html Trash2Icon({ size: 12 }).svg}
        </button>
      {/if}
    </div>

    {#if isFolder && isExpanded && childNodes.length > 0}
      <ul class="tree-children" role="group">
        {#each childNodes as child (child.id)}
          <svelte:self
            node={child}
            depth={depth + 1}
            {expandedFolders}
            {dragOverFolderId}
            {draggedNodeId}
            {draggedNodeType}
            {ROOT_ID}
            {getSortedChildren}
            {openDocument}
            {toggleFolder}
            {openContextMenu}
            {handleNodeDragStart}
            {handleNodeDragEnd}
            {handleFolderDragOver}
            {handleFolderDragLeave}
            {handleFolderDrop}
            {sendToBackend}
            {deleteDocument}
            {getFileIcon}
            {UploadIcon}
            {Trash2Icon}
            {FolderIcon}
            {ChevronDownIcon}
            {ChevronRightIcon}
            isRoot={false}
          />
        {/each}
      </ul>
    {/if}
  </div>
</li>
