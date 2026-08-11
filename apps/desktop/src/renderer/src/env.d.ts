/// <reference types="vite/client" />

import type { StudioApi } from '@tupiniquim/contracts'

declare global {
  interface Window {
    studio: StudioApi
  }
}

export {}
