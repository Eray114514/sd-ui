import { DEFAULT_GENERATION_PARAMS, RATIOS, type Ratio } from '@/types/generation'

export const ASSETS_PAGE_SIZE = 20

export const GRID_COLUMNS = {
  mobile: 2,
  sm: 3,
  md: 4,
  lg: 5,
  xl: 6,
} as const

export const DEFAULT_GRID_COLUMNS = 5

export const DEFAULT_STYLES = ["Lasy", "NAI3起手-"]

export const DEFAULT_MODEL = "waiillustriousSDXL_v160.safetensors"

export const GENERATION_DEFAULTS = {
  ...DEFAULT_GENERATION_PARAMS,
  styles: DEFAULT_STYLES,
  model: DEFAULT_MODEL,
}

export const UI_CONSTANTS = {
  CONTROL_PANEL: {
    MIN_TEXTAREA_HEIGHT: 88,
    MAX_TEXTAREA_HEIGHT: 280,
    COLLAPSED_HEIGHT: 56,
    TRANSITION_DURATION: 300,
  },
  ANIMATION: {
    SLIDE_DOWN_DURATION: 350,
    SCALE_DURATION: 200,
    TRANSITION_DURATION: 300,
  },
  POLLING: {
    TASKS_INTERVAL: 3000,
    PROGRESS_INTERVAL: 1000,
  },
  CACHE: {
    MODELS_TTL: 5 * 60 * 1000,
    STYLES_TTL: 5 * 60 * 1000,
  },
  PROGRESS: {
    RAF_THROTTLE: 100,
  },
} as const

export const SLIDER_CONSTRAINTS = {
  batchSize: { min: 1, max: 8, step: 1 },
  steps: { min: 10, max: 50, step: 1 },
  cfg: { min: 1, max: 15, step: 0.5 },
} as const

export const RATIO_LIST: Ratio[] = RATIOS

export { RATIOS }
