export interface GenerationParams {
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
}

export interface Ratio {
  label: string
  w: number
  h: number
}

export const RATIOS: Ratio[] = [
  { label: "1:1", w: 1024, h: 1024 },
  { label: "3:4", w: 896, h: 1152 },
  { label: "4:3", w: 1152, h: 896 },
  { label: "9:16", w: 768, h: 1344 },
  { label: "16:9", w: 1344, h: 768 },
]

export const DEFAULT_GENERATION_PARAMS: Omit<GenerationParams, 'prompt' | 'negative_prompt' | 'styles' | 'model'> = {
  width: 896,
  height: 1152,
  sampler: "Euler",
  steps: 30,
  cfg: 5,
  seed: -1,
  batchSize: 1,
}
