"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Sparkles,
  Settings2,
  Send,
  Wand2,
  Layers,
  Palette,
} from "lucide-react"
import { toast } from "sonner"
import { useGenerationStore } from "@/store/generationStore"
import { cn } from "@/lib/utils"
import { getModels } from "@/services/modelsService"
import { getStyles } from "@/services/stylesService"
import { generate } from "@/services/generateService"
import { RATIO_LIST, UI_CONSTANTS, SLIDER_CONSTRAINTS } from "@/constants"
import type { Model, Style } from "@/types"

export function ControlPanel() {
  const prompt = useGenerationStore(state => state.prompt)
  const setPrompt = useGenerationStore(state => state.setPrompt)
  const selectedStyles = useGenerationStore(state => state.styles)
  const setStyles = useGenerationStore(state => state.setStyles)
  const selectedModel = useGenerationStore(state => state.model)
  const setModel = useGenerationStore(state => state.setModel)
  const width = useGenerationStore(state => state.width)
  const height = useGenerationStore(state => state.height)
  const setDimensions = useGenerationStore(state => state.setDimensions)
  const batchSize = useGenerationStore(state => state.batchSize)
  const setBatchSize = useGenerationStore(state => state.setBatchSize)
  const cfg = useGenerationStore(state => state.cfg)
  const setCfg = useGenerationStore(state => state.setCfg)
  const steps = useGenerationStore(state => state.steps)
  const setSteps = useGenerationStore(state => state.setSteps)

  const [isGenerating, setIsGenerating] = useState(false)
  const [availableModels, setAvailableModels] = useState<Model[]>([])
  const [availableStyles, setAvailableStyles] = useState<Style[]>([])
  const [isExpanded, setIsExpanded] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [textareaHeight, setTextareaHeight] = useState(80)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const inputHeight = textareaHeight
    const controlsHeight = 50
    const minPadding = 20
    useGenerationStore.getState().setBottomSpacerHeight(isExpanded ? inputHeight + controlsHeight + minPadding : UI_CONSTANTS.CONTROL_PANEL.COLLAPSED_HEIGHT)
  }, [isExpanded, textareaHeight])

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      if (document.activeElement === textareaRef.current) {
        setLastScrollY(currentScrollY)
        return
      }

      const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50
      if (isAtBottom) {
        setIsExpanded(true)
        setLastScrollY(currentScrollY)
        return
      }

      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsExpanded(true)
      } else if (currentScrollY < lastScrollY && currentScrollY > 100) {
        setIsExpanded(false)
      }
      setLastScrollY(currentScrollY)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [lastScrollY])

  const selectedRatio = `${width}:${height}`

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [models, styles] = await Promise.all([
          getModels(),
          getStyles()
        ])
        setAvailableModels(models || [])
        setAvailableStyles(styles || [])

        if (!selectedModel && models?.length > 0) {
          setModel(models[0].name)
        }
      } catch (e) {
        console.error("Failed to fetch initial data", e)
      }
    }
    fetchData()
  }, [])

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("请输入提示词")
      return
    }

    setIsGenerating(true)
    try {
      await generate({
        prompt,
        styles: selectedStyles,
        override_settings: {
          sd_model_checkpoint: selectedModel
        },
        width,
        height,
        n_iter: batchSize,
        steps,
        cfg_scale: cfg
      })
      toast.success(`任务已添加到队列 (${batchSize} 张图片)`)
      window.dispatchEvent(new CustomEvent('task-created'))
      setPrompt("")
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "未知错误"
      toast.error(`创建任务失败: ${errorMessage}`)
      console.error("创建任务失败:", e)
    } finally {
      setIsGenerating(false)
    }
  }

  const toggleStyle = (styleName: string) => {
    if (selectedStyles.includes(styleName)) {
      setStyles(selectedStyles.filter(s => s !== styleName))
    } else {
      setStyles([...selectedStyles, styleName])
    }
  }

  const handleRatioSelect = (w: number, h: number) => {
    setDimensions(w, h)
  }

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value)

    const newHeight = Math.min(e.target.scrollHeight, UI_CONSTANTS.CONTROL_PANEL.MAX_TEXTAREA_HEIGHT)
    setTextareaHeight(Math.max(newHeight, UI_CONSTANTS.CONTROL_PANEL.MIN_TEXTAREA_HEIGHT))
  }

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (prompt.trim() && !isGenerating) {
        handleGenerate()
      }
    }
  }

  return (
    <>
      <div className="fixed bottom-0 left-[80px] right-0 z-40 p-4 transition-all duration-300 pointer-events-none flex flex-col items-center">
        <div className="w-full max-w-4xl relative pointer-events-auto flex flex-col items-center">
          {!isExpanded && (
            <div className="absolute -top-10 w-full flex justify-end z-50 pointer-events-none max-w-[600px] mx-auto left-0 right-0">
              <Button
                variant="secondary"
                className="rounded-full shadow-md h-7 px-3 text-[11px] font-medium bg-background border border-border text-muted-foreground hover:text-foreground transition-all hover:scale-105 flex items-center gap-1 pointer-events-auto"
                onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
              >
                回到底部
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 6 5 5 5-5"/><path d="m7 13 5 5 5-5"/></svg>
              </Button>
            </div>
          )}

        <div className={cn(
          "bg-card/90 backdrop-blur-xl border border-border/60 shadow-xl shadow-black/5 dark:shadow-none relative w-full mx-auto transition-all ease-in-out",
          isExpanded ? "max-w-4xl rounded-[32px] p-3" : "max-w-[600px] rounded-[32px] p-2"
        )}
        style={{
          transitionDuration: `${UI_CONSTANTS.CONTROL_PANEL.TRANSITION_DURATION}ms`,
        }}>

          <div className="relative group flex items-center w-full">
            <Textarea
              value={prompt}
              onChange={handleTextareaInput}
              onKeyDown={handleTextareaKeyDown}
              onFocus={() => setIsExpanded(true)}
              placeholder={isExpanded ? "描述你想象中的画面... (例如: 赛博朋克风格的雨夜街道，霓虹灯光)" : "请输入你的创意 (按 Enter 发送，Shift+Enter 换行)"}
              className={cn(
                "border-none focus-visible:ring-0 resize-none bg-transparent text-sm placeholder:text-muted-foreground/60 w-full transition-all",
                isExpanded ? "py-3 px-4 pb-4" : "h-[48px] min-h-[48px] py-3 px-4 pr-14 overflow-hidden whitespace-nowrap cursor-pointer"
              )}
              style={isExpanded ? { height: textareaHeight + 'px', minHeight: '48px', maxHeight: '300px' } : undefined}
              onClick={() => !isExpanded && setIsExpanded(true)}
              ref={textareaRef}
            />

            <div className={cn(
              "absolute right-1 transition-all duration-300 flex items-center justify-center",
              isExpanded ? "opacity-0 pointer-events-none scale-90" : "opacity-100 pointer-events-auto scale-100"
            )}>
              <Button
                size="icon"
                className={cn(
                  "h-10 w-10 rounded-full transition-all z-10",
                  prompt.trim() ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground hover:bg-muted/80",
                  isGenerating && "bg-muted text-muted-foreground cursor-not-allowed"
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  handleGenerate()
                }}
                disabled={isGenerating || !prompt.trim()}
              >
                {isGenerating ? (
                  <Sparkles className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 ml-0.5" />
                )}
              </Button>
            </div>
          </div>

          <div 
            className={cn(
              "grid transition-all duration-300 ease-in-out",
              isExpanded ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 mt-0"
            )}
          >
            <div className="overflow-hidden">
              <div className="h-px bg-border/50 mx-3 mb-3" />
              
              <div className="flex items-center justify-between px-3 pb-1 gap-2 overflow-x-auto no-scrollbar">

            <div className="flex items-center gap-2 shrink-0">
              <Select value={selectedModel} onValueChange={(val) => setModel(val || "")}>
                <SelectTrigger className="h-9 min-w-[160px] max-w-[200px] bg-secondary/50 border-0 rounded-xl text-xs font-medium hover:bg-secondary transition-colors focus:ring-0 shadow-sm">
                  <div className="flex items-center truncate">
                    <Layers className="w-3.5 h-3.5 mr-2 text-primary shrink-0" />
                    <span className="truncate">{selectedModel || "选择模型"}</span>
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {availableModels.map(m => (
                    <SelectItem key={m.id} value={m.name} className="rounded-lg">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 shrink-0">

              <Popover>
                <PopoverTrigger
                  render={(props) => (
                    <Button
                      {...props}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-9 rounded-xl text-xs font-medium border border-transparent hover:bg-secondary",
                        selectedStyles.length > 0 && "text-primary bg-primary/10 border-primary/20",
                        props.className
                      )}
                    >
                      <Palette className="w-3.5 h-3.5 mr-2" />
                      风格 {selectedStyles.length > 0 && `(${selectedStyles.length})`}
                    </Button>
                  )}
                />
                <PopoverContent className="w-80 p-0 overflow-hidden rounded-2xl border-border/50 shadow-xl" align="end" side="top" sideOffset={8}>
                  <div className="p-3 bg-muted/30 border-b border-border/50">
                    <h4 className="font-medium text-sm">艺术风格</h4>
                  </div>
                  <div className="p-2 max-h-[300px] overflow-y-auto grid grid-cols-2 gap-1">
                    {availableStyles.map(style => (
                      <div
                        key={style.id}
                        onClick={() => toggleStyle(style.name)}
                        className={cn(
                          "cursor-pointer px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between group",
                          selectedStyles.includes(style.name)
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span className="truncate">{style.name}</span>
                        {selectedStyles.includes(style.name) && <Wand2 className="w-3 h-3" />}
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger
                  render={(props) => (
                    <Button
                      {...props}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-9 rounded-xl text-xs font-medium hover:bg-secondary",
                        props.className
                      )}
                    >
                      <Settings2 className="w-3.5 h-3.5 mr-2" />
                      高级设置
                    </Button>
                  )}
                />
                <PopoverContent className="w-80 p-4 rounded-2xl border-border/50 shadow-xl" align="end" side="top" sideOffset={8}>
                  <div className="space-y-5">

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground">画幅比例</Label>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground">{width}x{height}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {RATIO_LIST.map(r => (
                          <button
                            key={r.label}
                            onClick={() => handleRatioSelect(r.w, r.h)}
                            className={cn(
                              "flex flex-col items-center justify-center p-1 rounded-xl border transition-all h-14",
                              width === r.w && height === r.h
                                ? "border-primary bg-primary/5 text-primary shadow-[0_0_0_1px_var(--color-primary)]"
                                : "border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                            title={r.label}
                          >
                            <div
                              className={cn(
                                "border-2 border-current rounded-[2px] mb-1 opacity-80",
                                r.label === "1:1" && "w-4 h-4",
                                r.label === "3:4" && "w-3 h-4",
                                r.label === "4:3" && "w-4 h-3",
                                r.label === "9:16" && "w-2.5 h-4",
                                r.label === "16:9" && "w-4 h-2.5",
                              )}
                            />
                            <span className="text-[9px] font-medium leading-none">{r.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground">生成数量</Label>
                        <span className="text-xs font-mono">{batchSize}</span>
                      </div>
                      <Slider
                        value={[batchSize]}
                        min={SLIDER_CONSTRAINTS.batchSize.min}
                        max={SLIDER_CONSTRAINTS.batchSize.max}
                        step={SLIDER_CONSTRAINTS.batchSize.step}
                        onValueChange={(val) => setBatchSize(Array.isArray(val) ? val[0] : val)}
                        className="py-1"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground">迭代步数</Label>
                        <span className="text-xs font-mono">{steps}</span>
                      </div>
                      <Slider
                        value={[steps]}
                        min={SLIDER_CONSTRAINTS.steps.min}
                        max={SLIDER_CONSTRAINTS.steps.max}
                        step={SLIDER_CONSTRAINTS.steps.step}
                        onValueChange={(val) => setSteps(Array.isArray(val) ? val[0] : val)}
                        className="py-1"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground">提示词相关性</Label>
                        <span className="text-xs font-mono">{cfg}</span>
                      </div>
                      <Slider
                        value={[cfg]}
                        min={SLIDER_CONSTRAINTS.cfg.min}
                        max={SLIDER_CONSTRAINTS.cfg.max}
                        step={SLIDER_CONSTRAINTS.cfg.step}
                        onValueChange={(val) => setCfg(Array.isArray(val) ? val[0] : val)}
                        className="py-1"
                      />
                    </div>

                  </div>
                </PopoverContent>
              </Popover>

              <div className="h-4 w-px bg-border/50 mx-1" />

              <Button
                size="sm"
                className={cn(
                  "h-9 px-4 rounded-xl font-semibold shadow-lg transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-primary to-purple-600 text-white hover:shadow-primary/25",
                  isGenerating && "bg-muted text-muted-foreground cursor-not-allowed"
                )}
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                    <Sparkles className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    立即生成
                    <Send className="w-3.5 h-3.5 ml-2" />
                  </>
                )}
              </Button>

            </div>
          </div>
        </div>
      </div>
      </div>
      </div>
      </div>
    </>
  )
}
