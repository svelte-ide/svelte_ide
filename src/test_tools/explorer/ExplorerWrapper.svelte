<script>
  import FileExplorer from './FileExplorer.svelte'
  import { getFileList } from './fileService.svelte.js'

  let { toolId } = $props()

  const folders = [
    { name: 'Documents', type: 'folder' },
    { name: 'Images', type: 'folder' },  
    { name: 'Projets', type: 'folder' }
  ]
  
  const files = [...folders, ...getFileList()]
</script>

<FileExplorer {files} {toolId} />
