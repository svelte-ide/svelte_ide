const fileContents = $state({})
const fileOriginalContents = $state({})

function hasValue(map, key) {
  return Object.prototype.hasOwnProperty.call(map, key)
}

export const explorerStore = {
  getFileContent(fileName) {
    if (!fileName) {
      return null
    }
    return hasValue(fileContents, fileName) ? fileContents[fileName] : null
  },

  setFileContent(fileName, content) {
    if (!fileName) {
      return
    }
    fileContents[fileName] = content
  },

  getFileOriginalContent(fileName) {
    if (!fileName) {
      return null
    }
    return hasValue(fileOriginalContents, fileName) ? fileOriginalContents[fileName] : null
  },

  setFileOriginalContent(fileName, content) {
    if (!fileName) {
      return
    }
    fileOriginalContents[fileName] = content
  },

  clearFileState(fileName) {
    if (!fileName) {
      return
    }
    delete fileContents[fileName]
    delete fileOriginalContents[fileName]
  }
}
