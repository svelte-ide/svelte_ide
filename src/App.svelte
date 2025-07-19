<script>
  import { toolManager } from './core/ToolManager.svelte.js'
  import { ideStore } from './stores/ideStore.svelte.js'
  import { ConsoleTool, NotificationsTool } from './core/SystemTools.js'

  import TitleBar from './components/layout/TitleBar.svelte'
  import LeftToolbar from './components/layout/LeftToolbar.svelte'
  import RightToolbar from './components/layout/RightToolbar.svelte'
  import StatusBar from './components/layout/StatusBar.svelte'
  import MainView from './components/layout/MainView.svelte'
  import ContextMenu from './components/layout/ContextMenu.svelte'
  import ToolPanel from './components/layout/ToolPanel.svelte'

  // Initialisation unique à la création du composant
  (async () => {
    window.toolManager = toolManager
    ideStore.setStatusMessage('Chargement des outils système...')
    
    // Enregistrement des outils système
    toolManager.registerTool(new ConsoleTool())
    toolManager.registerTool(new NotificationsTool())
    
    ideStore.setStatusMessage('Chargement des outils externes...')
    await toolManager.loadTools()
    ideStore.setStatusMessage('IDE prêt')
  })()
</script>

<div class="app">
  <TitleBar />

  {#if ideStore.user}
    <div class="main-container">
      <LeftToolbar />
      
      <div class="content-area">
        <div class="panels-wrapper">
          <div class="side-panels left">
            <ToolPanel position="topLeft" />
            <ToolPanel position="bottomLeft" />
          </div>
          
          <MainView />
          
          <div class="side-panels right">
            <ToolPanel position="topRight" />
            <ToolPanel position="bottomRight" />
          </div>
        </div>
        
        <ToolPanel position="bottom" />
      </div>
      
      <RightToolbar />
    </div>
    
    <StatusBar />
  {:else}
    <div class="welcome-container">
      <MainView />
    </div>
  {/if}
</div>

<ContextMenu />

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    overflow: hidden;
    background: #1e1e1e;
    color: #cccccc;
  }

  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #2d2d30;
  }

  .main-container {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .content-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .panels-wrapper {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .side-panels {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .side-panels > :global(.tool-panel) {
    flex: 1;
    min-height: 0;
  }
  
  :global(.tool-panel[style*="grid-area: bottom"]) {
    height: 200px; /* Hauteur par défaut pour la console */
    border-top: 1px solid #3e3e42;
  }

  .welcome-container {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
</style>
