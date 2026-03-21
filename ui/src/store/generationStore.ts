import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface GenerationState {
  prompt: string
  negative_prompt: string
  styles: string[]
  model: string
  width: number
  height: number
  sampler: string
  steps: number
  cfg: number
  seed: number
  batchSize: number
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

  // Action to fill from existing task
  fillFromTask: (task: any) => void
}

export const useGenerationStore = create<GenerationState>()(
  persist(
    (set) => ({
      prompt: "",
      negative_prompt: "",
      styles: ["Lasy", "NAI3起手-"],
      model: "waiillustriousSDXL_v160.safetensors",
      width: 896,
      height: 1152,
      sampler: "Euler",
      steps: 30,
      cfg: 5,
      seed: -1,
      batchSize: 1,
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
      setBottomSpacerHeight: (bottomSpacerHeight) => set({ bottomSpacerHeight }),

      fillFromTask: (task) => {
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
          model: task.model_checkpoint || "",
          width: task.width || 896,
          height: task.height || 1152,
          sampler: task.sampler_name || "Euler",
          steps: task.steps || 30,
          cfg: task.cfg_scale || 5,
          seed: task.seed ?? -1,
          batchSize: task.n_iter || 1
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
