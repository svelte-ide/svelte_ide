<script>
  import FileExplorer from './FileExplorer.svelte'
  import { ideStore } from '../../stores/ideStore.svelte.js'

  let { toolId } = $props()
  let files = $state([])

  $effect(() => {
    const tool = ideStore.leftTools.find(t => t.id === toolId)
    if (tool && tool.files) {
      files = tool.files
    }
  })
</script>

<div class="explorer-wrapper">
  <div class="explorer-header">
    <h3>🔍 Explorateur V2</h3>
  </div>
  <FileExplorer {files} {toolId} />
</div>

<style>
  .explorer-wrapper {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .explorer-header {
    padding: 8px 12px;
    border-bottom: 1px solid #3e3e42;
    background: #2d2d30;
  }

  .explorer-header h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: #cccccc;
  }
</style>
