<script>
  import { onMount } from 'svelte'
  import FileExplorer from './FileExplorer.svelte'
  import { getExplorerItems } from './fileService.svelte.js'

  let { toolId } = $props()
  let files = $state([])
  let loading = $state(true)
  let loadError = $state(null)

  async function refreshFiles() {
    loading = true
    loadError = null
    try {
      files = await getExplorerItems()
    } catch (error) {
      console.error('ExplorerWrapper: impossible de charger les fichiers', error)
      files = []
      loadError = 'Impossible de charger les fichiers.'
    } finally {
      loading = false
    }
  }

  onMount(() => {
    refreshFiles()
  })
</script>

<FileExplorer {files} {toolId} {loading} {loadError} reloadFiles={refreshFiles} />
