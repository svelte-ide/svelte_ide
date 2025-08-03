import { eventBus } from '@/core/EventBusService.svelte.js'
import { ideStore } from '@/stores/ideStore.svelte.js'
import FileViewer from './FileViewer.svelte'

class Explorer2RestorationService {
  constructor() {
    this.init()
  }

  init() {
    // ✅ L'outil Explorer2 s'enregistre pour les fichiers "V2:"
    eventBus.subscribe('tab:restore-request', (restoreEvent) => {
      const { descriptor } = restoreEvent
      
      // Explorer2 gère les fichiers qui commencent par "V2:"
      if (descriptor.type === 'file-editor' && descriptor.resourceId.startsWith('V2:')) {
        this.handleRestore(restoreEvent)
      }
    })
  }

  async handleRestore(restoreEvent) {
    const { descriptor, resolve, reject } = restoreEvent
    
    try {
      restoreEvent.handled = true
      
      // Extraire le vrai nom du fichier (enlever "V2:")
      const realFileName = descriptor.resourceId.replace('V2: ', '')
      const content = this._getFileContent(realFileName)
      
      const restoredTab = ideStore.openFile({
        fileName: descriptor.resourceId, // Garder "V2:" dans le titre
        content: content,
        component: FileViewer,
        icon: descriptor.icon || '📄',
        toolId: descriptor.toolId
      })
      
      resolve(restoredTab)
      
    } catch (error) {
      reject(error)
    }
  }

  _getFileContent(fileName) {
    // Même source de données mais avec contenu V2
    const mockFiles = [
      { name: 'demo1.txt', content: 'Contenu V2 du fichier demo1.txt\nLigne 2 V2\nLigne 3 V2' },
      { name: 'demo2.md', content: '# Fichier Markdown V2\n\nCeci est un **fichier markdown V2**.' },
      { name: 'demo3.js', content: 'console.log("Hello from demo3.js V2");\nfunction testV2() {\n  return "test V2";\n}' }
    ]
    
    const fileData = mockFiles.find(file => file.name === fileName)
    return fileData ? fileData.content : 'Contenu par défaut V2'
  }
}

export const explorer2RestorationService = new Explorer2RestorationService()
