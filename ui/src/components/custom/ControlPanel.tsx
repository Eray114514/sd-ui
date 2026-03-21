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
  SelectTrigger,
  SelectValue
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
  Maximize,
  ChevronUp
} from "lucide-react"
import axios from "axios"
import { toast } from "sonner"

// 创建无超时限制的 axios 实例用于生成请求
const generateApi = axios.create({
  timeout: 0, // 无超时限制
})
import { useGenerationStore } from "@/store/generationStore"
import { cn } from "@/lib/utils"

export function ControlPanel() {
  const {
    prompt, setPrompt,
    styles: selectedStyles, setStyles: setSelectedStyles,
    model: selectedModel, setModel: setSelectedModel,
    width, height, setDimensions,
    batchSize, setBatchSize,
    cfg, setCfg,
    steps, setSteps
  } = useGenerationStore()

  const [isGenerating, setIsGenerating] = useState(false)
  const [availableModels, setAvailableModels] = useState<{ id: string, name: string }[]>([])
  const [availableStyles, setAvailableStyles] = useState<{ id: string, name: string }[]>([])
  const [isExpanded, setIsExpanded] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isExpanded && textareaRef.current) {
      textareaRef.current.style.height = '48px'
      textareaRef.current.style.overflow = 'hidden'
    }
  }, [isExpanded])

  // 监听输入框展开/折叠状态，动态调整底部间距
  useEffect(() => {
    const spacer = document.getElementById('bottom-spacer')
    if (spacer) {
      if (isExpanded) {
        // 展开时：输入框高度 + 控制栏高度(约50px) + 最小安全距离(20px)
        const currentHeight = textareaRef.current?.style.height
        const inputHeight = currentHeight ? parseInt(currentHeight) : 80
        const controlsHeight = 50 // 控制栏高度
        const minPadding = 20 // 最小安全距离
        spacer.style.height = (inputHeight + controlsHeight + minPadding) + 'px'
      } else {
        // 折叠时：只需要覆盖输入框高度(48px) + 底部padding(16px) = 64px，取整65px
        spacer.style.height = '65px'
      }
    }
  }, [isExpanded])

  // Scroll detection to collapse/expand
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // If the user is actively typing (textarea has focus), do not auto-collapse
      if (document.activeElement === textareaRef.current) {
        setLastScrollY(currentScrollY)
        return
      }

      // If the user is at the very bottom of the page, keep expanded
      const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50
      if (isAtBottom) {
        setIsExpanded(true)
        setLastScrollY(currentScrollY)
        return
      }

      // Logic:
      // Scroll Down (Page Down) -> Expand
      // Scroll Up (Page Up) -> Collapse
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

  // Computed ratio string for UI
  const selectedRatio = `${width}:${height}`

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [modelsRes, stylesRes] = await Promise.all([
          axios.get('/api/models'),
          axios.get('/api/styles')
        ])
        setAvailableModels(modelsRes.data || [])
        setAvailableStyles(stylesRes.data || [])

        if (!selectedModel && modelsRes.data?.length > 0) {
          setSelectedModel(modelsRes.data[0].name)
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
      const payload = {
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
      }

      await generateApi.post('/api/generate', payload)
      toast.success(`任务已添加到队列 (${batchSize} 张图片)`)
      window.dispatchEvent(new CustomEvent('task-created'))
      setPrompt("")
    } catch (e: any) {
      const errorMessage = e?.response?.data?.error || e?.message || "未知错误"
      const statusCode = e?.response?.status

      let displayMessage = "创建任务失败"
      if (statusCode === 500) {
        displayMessage = `创建任务失败: 服务器内部错误 (${errorMessage})`
      } else if (statusCode === 400) {
        displayMessage = `创建任务失败: 请求参数错误 (${errorMessage})`
      } else if (errorMessage) {
        displayMessage = `创建任务失败: ${errorMessage}`
      }

      toast.error(displayMessage)
      console.error("创建任务失败:", {
        error: e,
        response: e?.response?.data,
        status: statusCode
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const toggleStyle = (styleName: string) => {
    if (selectedStyles.includes(styleName)) {
      setSelectedStyles(selectedStyles.filter(s => s !== styleName))
    } else {
      setSelectedStyles([...selectedStyles, styleName])
    }
  }

  const handleRatioSelect = (w: number, h: number) => {
    setDimensions(w, h)
  }

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const newHeight = Math.min(textareaRef.current.scrollHeight, 300)
      textareaRef.current.style.height = newHeight + 'px'

      const spacer = document.getElementById('bottom-spacer')
      if (spacer) {
        spacer.style.height = (newHeight + 120) + 'px'
      }
    }
  }

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (prompt.trim() && !isGenerating) {
        handleGenerate()
      }
    }
  }

  const ratios = [
    { label: "1:1", w: 1024, h: 1024, icon: "Square" },
    { label: "3:4", w: 896, h: 1152, icon: "Portrait" },
    { label: "4:3", w: 1152, h: 896, icon: "Landscape" },
    { label: "9:16", w: 768, h: 1344, icon: "Mobile" },
    { label: "16:9", w: 1344, h: 768, icon: "Wide" },
  ]

  return (
    <>
      <div className="fixed bottom-0 left-[80px] right-0 z-40 p-4 transition-all duration-300 pointer-events-none flex flex-col items-center">
        <div className="w-full max-w-4xl relative pointer-events-auto flex flex-col items-center">
          {/* Scroll to Bottom Button */}
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

          {/* Floating Panel Container */}
        <div className={cn(
          "bg-card/90 backdrop-blur-xl border border-border/60 rounded-2xl shadow-xl shadow-black/5 dark:shadow-none p-1 overflow-hidden relative w-full",
          !isExpanded && "rounded-full max-w-[600px] flex items-center pr-1"
        )}
        style={{
          transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}>

          {/* Main Input Area */}
          <div className="relative group flex items-center flex-1 w-full">
            <Textarea
              value={prompt}
              onChange={handleTextareaInput}
              onKeyDown={handleTextareaKeyDown}
              onFocus={() => setIsExpanded(true)}
              placeholder={isExpanded ? "描述你想象中的画面... (例如: 赛博朋克风格的雨夜街道，霓虹灯光)" : "请输入你的创意 (按 Enter 发送，Shift+Enter 换行)"}
              className={cn(
                "border-none focus-visible:ring-0 resize-none bg-transparent text-sm p-4 placeholder:text-muted-foreground/60",
                isExpanded ? "min-h-[80px] max-h-[300px] pr-32" : "h-[48px] min-h-[48px] py-3 px-4 overflow-hidden whitespace-nowrap cursor-pointer flex-1 w-full"
              )}
              onClick={() => !isExpanded && setIsExpanded(true)}
              ref={textareaRef}
            />
            
            {/* Collapsed Generate Button */}
            {!isExpanded && (
              <div className="pr-1 pl-1 shrink-0 flex items-center h-full">
                <Button
                  size="icon"
                  className={cn(
                    "h-9 w-9 rounded-full transition-all z-10",
                    prompt.trim() ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground hover:bg-muted/80",
                    isGenerating && "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerate();
                  }}
                  disabled={isGenerating || !prompt.trim()}
                >
                  {isGenerating ? (
                    <Sparkles className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Divider */}
          {isExpanded && (
            <div
              className="h-px bg-border/50 mx-2 my-1"
              style={{ transition: 'opacity 300ms ease, transform 300ms ease' }}
            />
          )}

          {/* Controls Bar */}
          {isExpanded && (
            <div
              className="flex items-center justify-between px-2 py-2 gap-2 overflow-x-auto no-scrollbar"
              style={{
                animation: 'slideDown 350ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
              }}
            >

            {/* Left: Model Selector */}
            <div className="flex items-center gap-2 shrink-0">
              <Select value={selectedModel} onValueChange={(val) => setSelectedModel(val || "")}>
                <SelectTrigger className="h-9 min-w-[160px] max-w-[200px] bg-secondary/50 border-0 rounded-lg text-xs font-medium hover:bg-secondary transition-colors focus:ring-0 shadow-sm">
                  <div className="flex items-center truncate">
                    <Layers className="w-3.5 h-3.5 mr-2 text-primary shrink-0" />
                    <span className="truncate">{selectedModel || "选择模型"}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(m => (
                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Right: Settings Toggles & Generate Button */}
            <div className="flex items-center gap-2 shrink-0">

              {/* Style Selector Popover */}
              <Popover>
                <PopoverTrigger
                  render={(props) => (
                    <Button
                      {...props}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-9 rounded-lg text-xs font-medium border border-transparent hover:bg-secondary",
                        selectedStyles.length > 0 && "text-primary bg-primary/10 border-primary/20",
                        props.className
                      )}
                    >
                      <Palette className="w-3.5 h-3.5 mr-2" />
                      风格 {selectedStyles.length > 0 && `(${selectedStyles.length})`}
                    </Button>
                  )}
                />
                {/* ... PopoverContent ... */}
                <PopoverContent className="w-80 p-0 overflow-hidden rounded-xl border-border/50 shadow-xl" align="end" side="top" sideOffset={8}>
                  <div className="p-3 bg-muted/30 border-b border-border/50">
                    <h4 className="font-medium text-sm">艺术风格</h4>
                  </div>
                  <div className="p-2 max-h-[300px] overflow-y-auto grid grid-cols-2 gap-1">
                    {availableStyles.map(style => (
                      <div
                        key={style.id}
                        onClick={() => toggleStyle(style.name)}
                        className={cn(
                          "cursor-pointer px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between group",
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

              {/* Advanced Settings Popover */}
              <Popover>
                <PopoverTrigger
                  render={(props) => (
                    <Button
                      {...props}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-9 rounded-lg text-xs font-medium hover:bg-secondary",
                        props.className
                      )}
                    >
                      <Settings2 className="w-3.5 h-3.5 mr-2" />
                      高级设置
                    </Button>
                  )}
                />
                {/* ... PopoverContent ... */}
                <PopoverContent className="w-80 p-4 rounded-xl border-border/50 shadow-xl" align="end" side="top" sideOffset={8}>
                  <div className="space-y-5">

                    {/* Aspect Ratio */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground">画幅比例</Label>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{width}x{height}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {ratios.map(r => (
                          <button
                            key={r.label}
                            onClick={() => handleRatioSelect(r.w, r.h)}
                            className={cn(
                              "flex flex-col items-center justify-center p-1 rounded-lg border transition-all h-14",
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

                    {/* Batch Size */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground">生成数量</Label>
                        <span className="text-xs font-mono">{batchSize}</span>
                      </div>
                      <Slider
                        value={[batchSize]}
                        min={1} max={8} step={1}
                        onValueChange={(val) => setBatchSize(Array.isArray(val) ? val[0] : val)}
                        className="py-1"
                      />
                    </div>

                    {/* Steps */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground">迭代步数</Label>
                        <span className="text-xs font-mono">{steps}</span>
                      </div>
                      <Slider
                        value={[steps]}
                        min={10} max={50} step={1}
                        onValueChange={(val) => setSteps(Array.isArray(val) ? val[0] : val)}
                        className="py-1"
                      />
                    </div>

                    {/* CFG */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground">提示词相关性</Label>
                        <span className="text-xs font-mono">{cfg}</span>
                      </div>
                      <Slider
                        value={[cfg]}
                        min={1} max={15} step={0.5}
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
                  "h-9 px-4 rounded-lg font-semibold shadow-lg transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-primary to-purple-600 text-white hover:shadow-primary/25",
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
          )}
        </div>
      </div>
      </div>
    </>
  )
}

