import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Task } from '@/types'
import type { GenerationParams } from '@/types/generation'
import { GENERATION_DEFAULTS } from '@/constants'

export interface GenerationState extends GenerationParams {
  prompt: string
  negative_prompt: string
  styles: string[]
  model: string
  bottomSpacerHeight: number

  setPrompt: (p: string) => void
  setNegativePrompt: (p: string) => void
  setStyles: (s: string[]) => void
  setModel: (m: string) => void
  setDimensions: (w: number, h: number) => void
  setSampler: (s: string) => void
  setSteps: (s: number) => void
  setCfg: (c: number) => void
  setSeed: (s: number) => void
  setBatchSize: (b: number) => void
  setBottomSpacerHeight: (h: number) => void

  fillFromTask: (task: Task) => void
}

export const useGenerationStore = create<GenerationState>()(
  persist(
    (set) => ({
      prompt: "",
      negative_prompt: "",
      styles: GENERATION_DEFAULTS.styles,
      model: GENERATION_DEFAULTS.model,
      width: GENERATION_DEFAULTS.width,
      height: GENERATION_DEFAULTS.height,
      sampler: GENERATION_DEFAULTS.sampler,
      steps: GENERATION_DEFAULTS.steps,
      cfg: GENERATION_DEFAULTS.cfg,
      seed: GENERATION_DEFAULTS.seed,
      batchSize: GENERATION_DEFAULTS.batchSize,
      bottomSpacerHeight: 165,

      setPrompt: (prompt) => set({ prompt }),
      setNegativePrompt: (negative_prompt) => set({ negative_prompt }),
      setStyles: (styles) => set({ styles }),
      setModel: (model) => set({ model }),
      setDimensions: (width, height) => set({ width, height }),
      setSampler: (sampler) => set({ sampler }),
      setSteps: (steps) => set({ steps }),
      setCfg: (cfg) => set({ cfg }),
      setSeed: (seed) => set({ seed }),
      setBatchSize: (batchSize) => set({ batchSize }),
      setBottomSpacerHeight: (bottomSpacerHeight: number) => set({ bottomSpacerHeight }),

      fillFromTask: (task: Task) => {
        let styles: string[] = []
        try {
          styles = JSON.parse(task.styles || "[]")
        } catch {
          styles = []
        }

        set({
          prompt: task.prompt || "",
          negative_prompt: task.negative_prompt || "",
          styles,
          model: task.model_checkpoint || GENERATION_DEFAULTS.model,
          width: task.width || GENERATION_DEFAULTS.width,
          height: task.height || GENERATION_DEFAULTS.height,
          sampler: task.sampler_name || GENERATION_DEFAULTS.sampler,
          steps: task.steps || GENERATION_DEFAULTS.steps,
          cfg: task.cfg_scale || GENERATION_DEFAULTS.cfg,
          seed: task.seed ?? GENERATION_DEFAULTS.seed,
          batchSize: task.n_iter || GENERATION_DEFAULTS.batchSize
        })
      }
    }),
    {
      name: 'sd-ui-generation-storage',
      partialize: (state) => ({
        styles: state.styles,
        model: state.model,
        width: state.width,
        height: state.height,
        sampler: state.sampler,
        steps: state.steps,
        cfg: state.cfg,
        batchSize: state.batchSize,
      }),
    }
  )
)
