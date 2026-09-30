/// <reference types="vite/client" />

import type { ControlCenterDesktopApi, GoogleTasksDesktopApi, StudioApi } from '@tupiniquim/contracts'

declare global {
  interface Window {
    studio: StudioApi
    controlCenter: ControlCenterDesktopApi
    googleTasks: GoogleTasksDesktopApi
    __TUPINIQUIM_WEB__?: boolean
  }
}

export {}
