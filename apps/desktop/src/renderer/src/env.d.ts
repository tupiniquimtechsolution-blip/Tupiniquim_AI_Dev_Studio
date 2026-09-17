/// <reference types="vite/client" />

import type { GoogleTasksDesktopApi, StudioApi } from '@tupiniquim/contracts'

declare global {
  interface Window {
    studio: StudioApi
    googleTasks: GoogleTasksDesktopApi
  }
}

export {}
