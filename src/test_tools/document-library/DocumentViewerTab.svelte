<!-- @component
JSON Document Viewer with folding, search, and syntax highlighting.
-->
<script>
  import JsonValue from './JsonValue.svelte';
  import { getActiveBackendResponse, getActiveDocument } from './stores/documentViewerStore.svelte.js';

  let { id, toolId } = $props()

  let document = $derived(getActiveDocument())
  let backendResponse = $derived(getActiveBackendResponse())
  
  let json = $state(null)
  let searchQuery = $state('')
  let expandedKeys = $state({})
  let searchMatches = $state([])
  let currentMatchIndex = $state(0)

  $effect(() => {
    if (backendResponse) {
      json = backendResponse
      expandedKeys = {}
      currentMatchIndex = 0
      searchQuery = ''
    } else {
      json = null
    }
  })

  $effect(() => {
    if (searchQuery && json) {
      searchMatches = searchInJson(json, searchQuery)
    } else {
      searchMatches = []
      currentMatchIndex = 0
    }
  })

  function searchInJson(obj, query) {
    const matches = []
    const lowerQuery = query.toLowerCase()

    function traverse(current, currentPath) {
      if (typeof current === 'string') {
        if (current.toLowerCase().includes(lowerQuery)) {
          matches.push(currentPath)
        }
      } else if (typeof current === 'object' && current !== null) {
        if (!Array.isArray(current)) {
          for (const key in current) {
            const newPath = currentPath ? `${currentPath}.${key}` : key
            if (key.toLowerCase().includes(lowerQuery)) {
              matches.push(newPath)
            }
            traverse(current[key], newPath)
          }
        }
      }
    }

    traverse(obj, '')
    return [...new Set(matches)]
  }

  function toggleExpand(key) {
    expandedKeys[key] = !expandedKeys[key]
    expandedKeys = { ...expandedKeys }
  }

  function expandAll() {
    if (json) {
      expandedKeys = collectAllKeys(json, '')
    }
  }

  function collapseAll() {
    expandedKeys = {}
  }

  function collectAllKeys(obj, prefix) {
    const keys = {}
    const currentPrefix = prefix || ''
    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
      for (const key in obj) {
        const path = currentPrefix ? `${currentPrefix}.${key}` : key
        keys[path] = true
        const nested = collectAllKeys(obj[key], path)
        Object.assign(keys, nested)
      }
    } else if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const path = `${currentPrefix}[${i}]`
        keys[path] = true
        const nested = collectAllKeys(obj[i], path)
        Object.assign(keys, nested)
      }
    }
    return keys
  }

  function nextMatch() {
    if (searchMatches.length > 0) {
      currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length
      const matchPath = searchMatches[currentMatchIndex]
      expandedKeys[matchPath] = true
      expandedKeys = { ...expandedKeys }
    }
  }

  function prevMatch() {
    if (searchMatches.length > 0) {
      currentMatchIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length
      const matchPath = searchMatches[currentMatchIndex]
      expandedKeys[matchPath] = true
      expandedKeys = { ...expandedKeys }
    }
  }

  function getValueClass(value) {
    if (value === null) return 'null'
    if (typeof value === 'boolean') return 'boolean'
    if (typeof value === 'number') return 'number'
    if (typeof value === 'string') return 'string'
    return ''
  }

  function getValueDisplay(value) {
    if (value === null) return 'null'
    if (typeof value === 'boolean') return String(value)
    if (typeof value === 'number') return String(value)
    if (typeof value === 'string') return `"${value}"`
    return ''
  }



</script>

<div class="viewer-root" data-tab-id={id} data-tool-id={toolId}>
  <div class="toolbar">
    {#if document}
      <div class="document-info">
        <span class="document-name">{document.name}</span>
      </div>
    {/if}
    <div class="search-box">
      <input
        type="text"
        placeholder="Rechercher..."
        bind:value={searchQuery}
        class="search-input"
      />
      {#if searchMatches.length > 0}
        <span class="match-count">{currentMatchIndex + 1}/{searchMatches.length}</span>
        <button type="button" onclick={prevMatch} title="Précédent" class="nav-btn">↑</button>
        <button type="button" onclick={nextMatch} title="Suivant" class="nav-btn">↓</button>
      {/if}
    </div>
    <div class="actions">
      <button type="button" onclick={expandAll} title="Tout développer" class="action-btn">
        ⊕
      </button>
      <button type="button" onclick={collapseAll} title="Tout réduire" class="action-btn">
        ⊖
      </button>
    </div>
  </div>

  <div class="content">
    {#if json}
      <div class="json-viewer">
        {#each Object.entries(json) as [key, value] (key)}
          {@const path = key}
          {@const isCompound = typeof value === 'object' && value !== null}
          {@const isExpanded = expandedKeys[path]}
          {@const isMatch = searchMatches.includes(path)}

          <div class="json-item" class:match={isMatch}>
            {#if isCompound}
              <button
                type="button"
                class="toggle-btn"
                onclick={() => toggleExpand(path)}
                title={isExpanded ? 'Réduire' : 'Développer'}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            {:else}
              <span class="toggle-btn placeholder"></span>
            {/if}
            {#if isCompound}
              <button
                type="button"
                class="key-btn"
                onclick={() => toggleExpand(path)}
                title={isExpanded ? 'Réduire' : 'Développer'}
              >
                {key}:
              </button>
            {:else}
              <span class="key">{key}:</span>
            {/if}
            <JsonValue {value} {path} level={1} {expandedKeys} {searchMatches} {toggleExpand} />
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty">Aucun document à afficher</div>
    {/if}
  </div>
</div>

<style>
  .viewer-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1e1e1e;
    color: #cccccc;
    font-family: 'Fira Code', 'Courier New', monospace;
    font-size: 12px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    background: #252526;
    border-bottom: 1px solid #3e3e42;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .document-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    background: rgba(14, 99, 156, 0.2);
    border-radius: 3px;
    flex-shrink: 0;
  }

  .document-name {
    font-size: 12px;
    color: #0e639c;
    font-weight: 600;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 200px;
  }

  .search-input {
    flex: 1;
    max-width: 300px;
    padding: 4px 8px;
    background: #3e3e42;
    border: 1px solid #555555;
    border-radius: 3px;
    color: #cccccc;
    font-size: 12px;
    font-family: inherit;
  }

  .search-input:focus {
    outline: none;
    border-color: #007acc;
  }

  .match-count {
    font-size: 11px;
    color: #858585;
    white-space: nowrap;
  }

  .nav-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    background: #3e3e42;
    border: 1px solid #555555;
    color: #cccccc;
    cursor: pointer;
    border-radius: 3px;
    font-size: 11px;
  }

  .nav-btn:hover {
    background: #454545;
  }

  .actions {
    display: flex;
    gap: 6px;
  }

  .action-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    background: #3e3e42;
    border: 1px solid #555555;
    color: #cccccc;
    cursor: pointer;
    border-radius: 3px;
    font-size: 14px;
  }

  .action-btn:hover {
    background: #454545;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    overflow-x: auto;
    min-height: 0;
  }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #858585;
  }

  .json-viewer {
    padding: 12px;
  }

  .json-item {
    margin-bottom: 4px;
    padding: 2px 4px;
    border-radius: 3px;
  }

  .json-item.match {
    background: rgba(255, 255, 0, 0.1);
    border-left: 3px solid #ffd700;
  }

  .toggle-btn {
    width: 18px;
    height: 18px;
    padding: 0;
    margin-right: 4px;
    background: none;
    border: none;
    color: #858585;
    cursor: pointer;
    font-size: 11px;
  }

  .toggle-btn:hover {
    color: #cccccc;
  }

  .toggle-btn.placeholder {
    display: inline-block;
    width: 18px;
    margin-right: 4px;
  }

  .key {
    color: #9cdcfe;
    font-weight: 600;
  }

  .key:hover {
    color: #4fc3f7;
  }

  .key-btn {
    background: none;
    border: none;
    color: #9cdcfe;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    font-size: inherit;
    font-family: inherit;
  }

  .key-btn:hover {
    color: #4fc3f7;
  }
</style>
