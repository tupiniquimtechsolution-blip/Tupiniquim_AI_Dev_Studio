import { contextBridge, ipcRenderer } from 'electron'
import { ipcChannels, type StudioApi, type TerminalDataEvent } from '@tupiniquim/contracts'

const api: StudioApi = {
  system: { info: () => ipcRenderer.invoke(ipcChannels.systemInfo) },
  workspace: {
    pick: () => ipcRenderer.invoke(ipcChannels.workspacePick),
    configure: (input) => ipcRenderer.invoke(ipcChannels.workspaceConfigure, input),
    list: (input) => ipcRenderer.invoke(ipcChannels.workspaceList, input),
    read: (input) => ipcRenderer.invoke(ipcChannels.workspaceRead, input),
    write: (input) => ipcRenderer.invoke(ipcChannels.workspaceWrite, input),
    search: (input) => ipcRenderer.invoke(ipcChannels.workspaceSearch, input)
  },
  git: {
    status: () => ipcRenderer.invoke(ipcChannels.gitStatus),
    diff: (relativePath) => ipcRenderer.invoke(ipcChannels.gitDiff, relativePath)
  },
  terminal: {
    create: (input) => ipcRenderer.invoke(ipcChannels.terminalCreate, input),
    write: (input) => ipcRenderer.invoke(ipcChannels.terminalWrite, input),
    resize: (input) => ipcRenderer.invoke(ipcChannels.terminalResize, input),
    kill: (input) => ipcRenderer.invoke(ipcChannels.terminalKill, input),
    onData: (listener) => {
      const wrapped = (_event: Electron.IpcRendererEvent, data: TerminalDataEvent): void => listener(data)
      ipcRenderer.on(ipcChannels.terminalData, wrapped)
      return () => ipcRenderer.removeListener(ipcChannels.terminalData, wrapped)
    }
  }
}

contextBridge.exposeInMainWorld('studio', api)
