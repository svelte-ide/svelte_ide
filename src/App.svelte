<script>
  import { toolManager } from './core/ToolManager.svelte.js'
  import { toolVisibilityManager } from './core/ToolVisibilityManager.svelte.js'
  import { ideStore } from './stores/ideStore.svelte.js'
  
  import TitleBar from './components/layout/TitleBar.svelte'
  import LeftToolbar from './components/layout/LeftToolbar.svelte'
  import RightToolbar from './components/layout/RightToolbar.svelte'
  import StatusBar from './components/layout/StatusBar.svelte'
  import LeftPanel from './components/layout/LeftPanel.svelte'
  import RightPanel from './components/layout/RightPanel.svelte'
  import MainView from './components/layout/MainView.svelte'
  import ConsolePanel from './components/layout/ConsolePanel.svelte'
  import ContextMenu from './components/layout/ContextMenu.svelte'

  let lastActiveTab = null

  $effect(async () => {
    window.toolManager = toolManager
    ideStore.setStatusMessage('Chargement des outils...')
    await toolManager.loadTools()
    ideStore.setStatusMessage('IDE prêt')
  })

  // Gérer la visibilité automatique des outils selon l'onglet actif
  $effect(() => {
    const activeTab = ideStore.activeTab
    
    if (activeTab !== lastActiveTab) {
      lastActiveTab = activeTab
      //toolVisibilityManager.updateAllToolsVisibility(activeTab)
    }
  })
</script>

<div class="app">
  <!-- Section A: Barre de titre -->
  <TitleBar />
  
  {#if ideStore.user}
    <div class="main-container">
      <!-- Section B: Barre d'outils latérale gauche -->
      <LeftToolbar />
      
      <div class="content-area">
        <div class="editor-area">
          <!-- Section E: Panneau latéral gauche -->
          <LeftPanel />
          
          <!-- Section G: Zone de visualisation principale -->
          <MainView />
          
          <!-- Section H: Panneau latéral droit -->
          <RightPanel />
        </div>
        
        <!-- Section F: Console (pleine largeur) -->
        <ConsolePanel />
      </div>
      
      <!-- Section D: Barre d'outils latérale droite -->
      <RightToolbar />
    </div>
    
    <!-- Section C: Barre d'état -->
    <StatusBar />
  {:else}
    <!-- Welcome Screen en plein écran quand non connecté -->
    <div class="welcome-container">
      <MainView />
    </div>
  {/if}
</div>

<!-- Menu contextuel global -->
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
    min-width: 0;
  }

  .content-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .editor-area {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-width: 0;
  }

  .welcome-container {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
</style>
