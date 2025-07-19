import { ideStore } from '../stores/ideStore.svelte.js'

class ToolVisibilityManager {

  // updateAllToolsVisibility(activeTabId) {
  //   // Mettre à jour la visibilité de tous les outils
  //   // Chaque outil décide s'il doit être visible via updateVisibility()
  //   [...ideStore.leftTools, ...ideStore.rightTools].forEach(tool => {
  //     if (typeof tool.updateVisibility === 'function') {
  //       tool.updateVisibility(activeTabId)
  //     }
  //   })
  //
  //   // Synchroniser l'état active avec shouldBeVisible pour tous les outils
  //   this.syncToolVisibility()
  // }
  //
  // syncToolVisibility() {
  //   // Synchroniser simplement shouldBeVisible → active pour tous les outils
  //   const allTools = [...ideStore.leftTools, ...ideStore.rightTools]
  //
  //   allTools.forEach(tool => {
  //     // Si l'outil veut être visible mais n'est pas actif → l'activer
  //     if (tool.shouldBeVisible && !tool.active) {
  //       tool.active = true // Ne pas appeler activate() pour éviter la boucle
  //       if (tool.position === 'left') {
  //         ideStore.activeLeftTool = tool
  //       } else if (tool.position === 'right') {
  //         ideStore.activeRightTool = tool
  //       }
  //     }
  //     // Si l'outil ne veut pas être visible mais est actif → le désactiver
  //     else if (!tool.shouldBeVisible && tool.active) {
  //       tool.active = false // Ne pas appeler deactivate() pour éviter la boucle
  //       if (tool.position === 'left' && ideStore.activeLeftTool === tool) {
  //         ideStore.activeLeftTool = null
  //       } else if (tool.position === 'right' && ideStore.activeRightTool === tool) {
  //         ideStore.activeRightTool = null
  //       }
  //     }
  //   })
  //
  //   // Mettre à jour la visibilité des panneaux
  //   ideStore.leftPanelVisible = ideStore.leftTools.some(t => t.active)
  //   ideStore.rightPanelVisible = ideStore.rightTools.some(t => t.active)
  // }
}

export const toolVisibilityManager = new ToolVisibilityManager()
