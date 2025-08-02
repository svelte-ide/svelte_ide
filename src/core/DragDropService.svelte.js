export class DragDropService {
  constructor() {
    // État global du drag & drop
    this.draggedTab = $state(null)
    this.sourceGroup = $state(null)
    this.targetGroup = $state(null)
    this.dragOverTab = $state(null)
    this.isDragging = $derived(() => this.draggedTab !== null)
    this.dropZones = $state([])
    
    // Zones de drop avancées pour créer de nouveaux splits
    this.edgeDropZone = $state(null) // { groupId, edge: 'top'|'bottom'|'left'|'right' }
    this.previewSplit = $state(null) // Prévisualisation du split à créer
  }

  // Démarrer un drag
  startDrag(tab, sourceGroupId) {
    this.draggedTab = tab
    this.sourceGroup = sourceGroupId
    this.targetGroup = null
    this.dragOverTab = null
    this.edgeDropZone = null
    this.previewSplit = null
    document.body.style.userSelect = 'none'
    
    // Calculer les zones de drop possibles
    this._calculateDropZones()
  }

  // Définir la cible de drag over
  setDragTarget(targetGroupId, targetTab = null) {
    this.targetGroup = targetGroupId
    this.dragOverTab = targetTab
    this.edgeDropZone = null
    this.previewSplit = null
  }

  // Définir une zone de drop sur les bords pour créer un split
  setEdgeDropZone(groupId, edge, mouseX, mouseY) {
    this.edgeDropZone = { groupId, edge, mouseX, mouseY }
    this.targetGroup = null
    this.dragOverTab = null
    
    // Créer une prévisualisation du split
    this.previewSplit = {
      groupId,
      direction: (edge === 'left' || edge === 'right') ? 'horizontal' : 'vertical',
      edge
    }
  }

  // Nettoyer le drag target
  clearDragTarget() {
    this.targetGroup = null
    this.dragOverTab = null
    this.edgeDropZone = null
    this.previewSplit = null
  }

  // Terminer le drag
  endDrag() {
    this.draggedTab = null
    this.sourceGroup = null
    this.targetGroup = null
    this.dragOverTab = null
    this.dropZones = []
    this.edgeDropZone = null
    this.previewSplit = null
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }

  // Vérifier si un groupe est une zone de drop valide
  isValidDropZone(groupId) {
    return this.dropZones.includes(groupId)
  }

  // Vérifier si un tab est en cours de drag
  isTabBeingDragged(tabId) {
    return this.draggedTab?.id === tabId
  }

  // Vérifier si un tab est une cible de drag over
  isTabDragTarget(tabId) {
    return this.dragOverTab?.id === tabId
  }

  // Vérifier si un groupe est la cible actuelle
  isGroupDragTarget(groupId) {
    return this.targetGroup === groupId
  }

  // Vérifier si un groupe a une zone de drop sur les bords
  hasEdgeDropZone(groupId) {
    return this.edgeDropZone?.groupId === groupId
  }

  // Obtenir la zone de drop sur les bords
  getEdgeDropZone(groupId) {
    return this.edgeDropZone?.groupId === groupId ? this.edgeDropZone : null
  }

  // Calculer les zones de drop possibles (privé)
  _calculateDropZones() {
    // Pour l'instant, toutes les zones sont valides
    // Plus tard on pourra ajouter des restrictions
    this.dropZones = ['*'] // Wildcard pour "tous les groupes"
  }

  // Obtenir les informations de drag actuel
  getDragInfo() {
    return {
      draggedTab: this.draggedTab,
      sourceGroup: this.sourceGroup,
      targetGroup: this.targetGroup,
      isDragging: this.isDragging,
      edgeDropZone: this.edgeDropZone,
      previewSplit: this.previewSplit
    }
  }

  // Calculer la zone de bord en fonction de la position de la souris
  calculateEdgeZone(rect, mouseX, mouseY) {
    const edgeThreshold = 20 // Réduit de 30px à 20px pour être moins agressif
    const { left, right, top, bottom, width, height } = rect
    
    // Seulement activé si le groupe a déjà des tabs (évite de créer des splits sur groupes vides)
    // Cette vérification sera faite dans le composant appelant
    
    // Vérifier les bords dans l'ordre de priorité
    if (mouseX - left < edgeThreshold) {
      return 'left'
    } else if (right - mouseX < edgeThreshold) {
      return 'right'
    } else if (mouseY - top < edgeThreshold) {
      return 'top'
    } else if (bottom - mouseY < edgeThreshold) {
      return 'bottom'
    }
    
    return null
  }
}

// Instance globale
export const dragDropService = new DragDropService()
