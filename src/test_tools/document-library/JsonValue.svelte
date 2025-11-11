<!-- @component
Recursive JSON value renderer for DocumentViewer
-->
<script>
  import JsonValue from './JsonValue.svelte'

  let { value, path, level = 0, expandedKeys, searchMatches, toggleExpand } = $props()

  function getValueClass(val) {
    if (val === null) return 'null'
    if (typeof val === 'boolean') return 'boolean'
    if (typeof val === 'number') return 'number'
    if (typeof val === 'string') return 'string'
    return ''
  }

  function getValueDisplay(val) {
    if (val === null) return 'null'
    if (typeof val === 'boolean') return String(val)
    if (typeof val === 'number') return String(val)
    if (typeof val === 'string') return `"${val}"`
    return ''
  }
</script>

{#if typeof value !== 'object' || value === null}
  <span class="value {getValueClass(value)}">{getValueDisplay(value)}</span>
{:else}
  {@const isExpanded = expandedKeys[path]}
  {@const isMatch = searchMatches.includes(path)}
  <div class="json-item" class:match={isMatch} style="margin-left: {level * 20}px">
    {#if Array.isArray(value)}
      <button type="button" class="toggle-btn" onclick={() => toggleExpand(path)} title={isExpanded ? 'Réduire' : 'Développer'}>
        {isExpanded ? '▼' : '▶'}
      </button>
      <span class="bracket">[</span>
      {#if isExpanded}
        <div class="array-items">
          {#each value as item, i}
            {@const itemPath = `${path}[${i}]`}
            <div class="array-item">
              <JsonValue value={item} path={itemPath} level={level + 1} {expandedKeys} {searchMatches} {toggleExpand} />
            </div>
          {/each}
        </div>
      {:else}
        <span class="collapsed"> ... </span>
      {/if}
      <span class="bracket">]</span>
    {:else}
      <button type="button" class="toggle-btn" onclick={() => toggleExpand(path)} title={isExpanded ? 'Réduire' : 'Développer'}>
        {isExpanded ? '▼' : '▶'}
      </button>
      <span class="bracket">{'{'}</span>
      {#if isExpanded}
        <div class="nested-props">
          {#each Object.entries(value) as [key, val]}
            {@const propPath = path ? `${path}.${key}` : key}
            <div class="nested-item">
              <button
                type="button"
                class="key-btn"
                onclick={() => toggleExpand(propPath)}
                title={expandedKeys[propPath] ? 'Réduire' : 'Développer'}
              >
                {key}:
              </button>
              <JsonValue value={val} path={propPath} level={level + 1} {expandedKeys} {searchMatches} {toggleExpand} />
            </div>
          {/each}
        </div>
      {:else}
        <span class="collapsed"> ... </span>
      {/if}
      <span class="bracket">{'}'}</span>
    {/if}
  </div>
{/if}

<style>
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

  .value {
    display: inline-flex;
    gap: 2px;
  }

  .string {
    color: #ce9178;
  }

  .number {
    color: #b5cea8;
  }

  .boolean {
    color: #569cd6;
  }

  .null {
    color: #858585;
  }

  .bracket {
    color: #cccccc;
  }

  .collapsed {
    color: #858585;
    font-style: italic;
  }

  .array-items {
    margin: 4px 0;
  }

  .array-item {
    margin-bottom: 4px;
    padding: 4px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }

  .nested-props {
    margin: 4px 0;
  }

  .nested-item {
    margin-bottom: 4px;
    padding: 4px;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
  }
</style>