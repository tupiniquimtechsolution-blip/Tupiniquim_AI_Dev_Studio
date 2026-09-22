import './index'
import { contextBridge, ipcRenderer } from 'electron'
import { googleTasksIpcChannels, type GoogleTasksDesktopApi } from '@tupiniquim/contracts'

const googleTasks: GoogleTasksDesktopApi = {
  status: () => ipcRenderer.invoke(googleTasksIpcChannels.status),
  connect: () => ipcRenderer.invoke(googleTasksIpcChannels.connect),
  disconnect: () => ipcRenderer.invoke(googleTasksIpcChannels.disconnect),
  listTaskLists: (input) => ipcRenderer.invoke(googleTasksIpcChannels.taskLists, input),
  createTaskList: (input) => ipcRenderer.invoke(googleTasksIpcChannels.createTaskList, input),
  listTasks: (input) => ipcRenderer.invoke(googleTasksIpcChannels.tasks, input),
  createTask: (input) => ipcRenderer.invoke(googleTasksIpcChannels.createTask, input),
  updateTask: (input) => ipcRenderer.invoke(googleTasksIpcChannels.updateTask, input),
  completeTask: (input) => ipcRenderer.invoke(googleTasksIpcChannels.completeTask, input),
  deleteTask: (input) => ipcRenderer.invoke(googleTasksIpcChannels.deleteTask, input)
}

contextBridge.exposeInMainWorld('googleTasks', googleTasks)
