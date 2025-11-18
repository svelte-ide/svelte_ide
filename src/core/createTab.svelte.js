import { Tab } from './Tab.svelte.js'
import { SCROLL_MODES } from './ScrollModes.svelte.js'

export function createTab({
  id,
  title,
  component,
  closable = true,
  icon = null,
  scrollMode = SCROLL_MODES.ide,
  descriptor = null,
  metadata = {}
}) {
  const tab = new Tab(id, title, component, closable, icon, scrollMode)
  if (descriptor) {
    tab.setDescriptor(descriptor)
  }
  if (metadata && typeof metadata === 'object') {
    Object.assign(tab, metadata)
  }
  return tab
}
