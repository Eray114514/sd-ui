import { UI_CONSTANTS } from '@/constants'

export interface PollingConfig {
  interval: number
  enabled?: boolean
}

type PollingCallback = () => void | Promise<void>

class PollingManager {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private isPaused = false
  private config: PollingConfig
  private callback: PollingCallback | null = null
  private visibilityHandler: (() => void) | null = null

  constructor(config: PollingConfig) {
    this.config = config
  }

  start(callback: PollingCallback): void {
    if (this.isRunning) return

    this.callback = callback
    this.isRunning = true
    this.isPaused = false

    this.visibilityHandler = () => {
      if (document.hidden) {
        this.pause()
      } else {
        this.resume()
      }
    }

    document.addEventListener('visibilitychange', this.visibilityHandler)

    if (!document.hidden) {
      this.scheduleNext()
    }
  }

  pause(): void {
    if (this.isPaused || !this.isRunning) return

    this.isPaused = true
    if (this.intervalId) {
      clearTimeout(this.intervalId)
      this.intervalId = null
    }
  }

  resume(): void {
    if (!this.isPaused || !this.isRunning) return

    this.isPaused = false
    this.scheduleNext()
  }

  stop(): void {
    this.isRunning = false
    this.isPaused = false

    if (this.intervalId) {
      clearTimeout(this.intervalId)
      this.intervalId = null
    }

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
      this.visibilityHandler = null
    }

    this.callback = null
  }

  private scheduleNext(): void {
    if (!this.isRunning || this.isPaused || document.hidden) return

    this.intervalId = setTimeout(async () => {
      if (!this.isRunning || this.isPaused || document.hidden) return

      try {
        if (this.callback) {
          await this.callback()
        }
      } finally {
        this.scheduleNext()
      }
    }, this.config.interval)
  }

  updateInterval(interval: number): void {
    this.config.interval = interval
  }

  isActive(): boolean {
    return this.isRunning && !this.isPaused
  }
}

export const tasksPollingManager = new PollingManager({
  interval: UI_CONSTANTS.POLLING.TASKS_INTERVAL,
})

export const progressPollingManager = new PollingManager({
  interval: UI_CONSTANTS.POLLING.PROGRESS_INTERVAL,
})

export function createPollingManager(config: PollingConfig): PollingManager {
  return new PollingManager(config)
}

export { PollingManager }
