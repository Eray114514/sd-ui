"use client"

import { useEffect, useState, useRef } from "react"
import axios from "axios"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2Icon, AlertCircleIcon, CheckCircleIcon, ChevronDownIcon, ChevronUpIcon, CopyIcon, TrashIcon, DownloadIcon, StarIcon, EditIcon, RefreshCwIcon, Maximize2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { useGenerationStore } from "@/store/generationStore"
import { Button } from "@/components/ui/button"
import { ImageDetailModal } from "@/components/custom/ImageDetailModal"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface ErrorDetails {
  message: string
  timestamp: string
  elapsedTime: string
  requestInfo: {
    url: string
    method: string
    payload: {
      steps: number
      width: number
      height: number
      n_iter: number
      model: string
    }
  }
  errorDetails: {
    code: string
    status: string
    responseData: any
    stack: string
  }
}

export function TaskList() {
  const [tasks, setTasks] = useState<any[]>([])
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())
  const { fillFromTask } = useGenerationStore()
  const [progressData, setProgressData] = useState<Record<string, { progress: number, current_image: string | null }>>({})
  const [selectedImage, setSelectedImage] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const initialLoadRef = useRef(true)
  const tasksRef = useRef(tasks)

  const [deleteTaskConfirmId, setDeleteTaskConfirmId] = useState<string | null>(null)
  const [deleteImageConfirmId, setDeleteImageConfirmId] = useState<string | null>(null)

  tasksRef.current = tasks

  // Auto scroll to bottom when tasks change
  useEffect(() => {
    if (bottomRef.current) {
      if (initialLoadRef.current && tasks.length > 0) {
        bottomRef.current.scrollIntoView({ behavior: "auto" })
        initialLoadRef.current = false
      } else if (!initialLoadRef.current) {
        bottomRef.current.scrollIntoView({ behavior: "smooth" })
      }
    }
  }, [tasks.length, Object.keys(progressData).length])

  // Poll for progress when there's a processing task
  useEffect(() => {
    let interval: NodeJS.Timeout

    const fetchProgress = async () => {
      try {
        const res = await axios.get('/api/progress?skip_current_image=false')
        if (res.data) {
          const currentTasks = tasksRef.current
          setProgressData(prev => {
            const updated: Record<string, { progress: number, current_image: string | null }> = {}
            const processingTasks = currentTasks.filter((t: any) => t.status === 'processing')
            for (const task of processingTasks) {
              updated[task.id] = {
                progress: res.data.progress || 0,
                current_image: res.data.current_image || null
              }
            }
            return updated
          })
        }
      } catch (e) {
        // ignore errors during polling
      }
    }

    const hasProcessing = tasks.some((t: any) => t.status === 'processing')
    if (hasProcessing) {
      fetchProgress()
      interval = setInterval(fetchProgress, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [tasks])

  const handleDeleteTask = async (taskId: string) => {
    try {
      await axios.delete('/api/tasks', { data: { id: taskId } })
      setTasks(prev => prev.filter(t => t.id !== taskId))
      toast.success("任务已删除")
    } catch (e) {
      toast.error("删除任务失败")
    }
  }

  const handleDeleteImage = async (imageId: string, taskId: string) => {
    try {
      await axios.delete('/api/assets', { data: { id: imageId } })
      setTasks(prev => prev.map(t => {
        if (t.id === taskId && t.images) {
          return { ...t, images: t.images.filter((img: any) => img.id !== imageId) }
        }
        return t
      }))
      toast.success("图片已删除")
    } catch (e) {
      toast.error("删除图片失败")
    }
  }

  const handleFavoriteImage = async (imageId: string, currentStatus: boolean, taskId: string) => {
    try {
      const newStatus = !currentStatus
      await axios.put('/api/assets', { id: imageId, isFavorite: newStatus })
      setTasks(prev => prev.map(t => {
        if (t.id === taskId && t.images) {
          return {
            ...t, images: t.images.map((img: any) =>
              img.id === imageId ? { ...img, isFavorite: newStatus } : img
            )
          }
        }
        return t
      }))
      toast.success(newStatus ? "已收藏" : "已取消收藏")
    } catch (e) {
      toast.error("操作失败")
    }
  }

  const handleDownloadImage = (path: string) => {
    const link = document.createElement("a")
    link.href = `/api/image?path=${encodeURIComponent(path)}`
    link.download = path.split(/[\\/]/).pop() || "image.png"
    link.click()
  }

  const handleReEdit = (task: any) => {
    fillFromTask(task)
    toast.success("参数已加载到控制面板")
  }

  const handleRegenerate = async (task: any) => {
    try {
      const payload = {
        prompt: task.prompt,
        negative_prompt: task.negative_prompt,
        styles: JSON.parse(task.styles || "[]"),
        override_settings: {
          sd_model_checkpoint: task.model_checkpoint
        },
        width: task.width,
        height: task.height,
        sampler_name: task.sampler_name,
        steps: task.steps,
        cfg_scale: task.cfg_scale,
        seed: -1 // New seed
      }
      await axios.post('/api/generate', payload)
      toast.success("重新生成任务已添加到队列")
    } catch (e) {
      toast.error("重新生成失败")
    }
  }

  const toggleError = (taskId: string) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  const parseError = (errorStr: string): ErrorDetails | null => {
    try {
      const parsed = JSON.parse(errorStr)
      if (parsed.message && parsed.errorDetails) {
        return parsed
      }
    } catch {
      // 不是JSON格式，返回null
    }
    return null
  }

  const copyErrorDetails = (errorDetails: ErrorDetails) => {
    const textToCopy = JSON.stringify(errorDetails, null, 2)
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast.success("错误详情已复制到剪贴板")
    }).catch(() => {
      toast.error("复制失败")
    })
  }

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await axios.get('/api/tasks')
        setTasks(res.data)
      } catch (e) {
        console.error(e)
      }
    }

    fetchTasks()
    const interval = setInterval(fetchTasks, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt)
    toast.success("提示词已复制")
  }

  const handleDeleted = (id: string) => {
     setTasks(prev => prev.map(t => {
       if (t.images) {
         return { ...t, images: t.images.filter((img: any) => img.id !== id) }
       }
       return t
     }))
     
     // Update selectedImage if it's the one being deleted
     setSelectedImage((prev: any) => {
       if (prev && prev.id === id) {
         const taskImages = prev.task?.images || []
         const newImages = taskImages.filter((img: any) => img.id !== id)
         if (newImages.length > 0) {
           const currentIndex = taskImages.findIndex((img: any) => img.id === id)
           const nextIndex = currentIndex >= newImages.length ? newImages.length - 1 : currentIndex
           return { ...newImages[nextIndex], task: { ...prev.task, images: newImages } }
         }
         return null // Close modal if no images left
       }
       return prev
     })
  }

  return (
    <div className="p-4 md:p-8 w-full max-w-4xl mx-auto flex flex-col gap-8 pb-[20px]">
      {tasks.length === 0 && <p className="text-muted-foreground text-center mt-20">暂无生成记录，开始你的创作吧</p>}

      {selectedImage && (
        <ImageDetailModal
          image={selectedImage}
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          onDeleted={handleDeleted}
          relatedImages={selectedImage.task?.images || []}
        />
      )}
      <div className="flex flex-col gap-10">
        {tasks.map((task, index) => (
          <div key={task.id} className="flex flex-col gap-4">
            {/* Task Header */}
            <div className="flex flex-col gap-2">
              <div className="text-sm text-muted-foreground">
                {new Date(task.createdAt).toLocaleString()}
              </div>
              <div className="text-base font-medium flex items-start gap-2">
                <span className="flex-1">{task.prompt}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => handleCopyPrompt(task.prompt)}>
                  <CopyIcon className="w-3.5 h-3.5" />
                </Button>
              </div>
              
              {/* Badges / Params */}
              <div className="flex flex-wrap gap-2 mt-1">
                <Badge variant="secondary" className="bg-primary/5 text-primary hover:bg-primary/10 border-none font-normal">
                  {task.model_checkpoint || '默认模型'}
                </Badge>
                {task.sampler_name && (
                  <Badge variant="secondary" className="bg-muted font-normal text-muted-foreground">
                    {task.sampler_name}
                  </Badge>
                )}
                {task.width && task.height && (
                  <Badge variant="secondary" className="bg-muted font-normal text-muted-foreground">
                    {task.width} x {task.height}
                  </Badge>
                )}
                {task.status === 'pending' && <Badge variant="outline" className="text-muted-foreground border-dashed">等待中</Badge>}
                {task.status === 'processing' && <Badge variant="default" className="bg-blue-500"><Loader2Icon className="w-3 h-3 mr-1 animate-spin" /> 生成中</Badge>}
                {task.status === 'failed' && <Badge variant="destructive"><AlertCircleIcon className="w-3 h-3 mr-1" /> 失败</Badge>}
              </div>
            </div>

            {/* Progress Display */}
            {task.status === 'processing' && (
              <div className="flex flex-col gap-2 mt-2">
                {progressData[task.id]?.current_image && (
                  <div className="relative aspect-square md:aspect-video max-w-sm rounded-xl overflow-hidden bg-muted border border-border/50">
                    <img
                      src={`data:image/png;base64,${progressData[task.id].current_image}`}
                      alt="Preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(5, (progressData[task.id]?.progress || 0) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground w-12 text-right">
                    {((progressData[task.id]?.progress || 0) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* Images Grid */}
            {task.status === 'completed' && task.images && task.images.length > 0 && (
              <div className="columns-2 sm:columns-3 md:columns-4 gap-2">
                {task.images.map((img: any) => (
                  <div 
                    key={img.id} 
                    className="relative group rounded-xl overflow-hidden bg-muted border border-border/50 cursor-pointer break-inside-avoid mb-2 z-0"
                    onClick={() => setSelectedImage({ ...img, task })}
                  >
                    <img
                      src={`/api/image?path=${encodeURIComponent(img.path)}`}
                      alt="Generated"
                      className="w-full h-auto object-contain transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-start p-2 z-10">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/40 text-white border-0 backdrop-blur-md" onClick={() => handleDownloadImage(img.path)}>
                          <DownloadIcon className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/40 text-white border-0 backdrop-blur-md" onClick={() => handleFavoriteImage(img.id, img.isFavorite, task.id)}>
                          <StarIcon className={`w-3.5 h-3.5 ${img.isFavorite ? "fill-yellow-400 text-yellow-400" : ""}`} />
                        </Button>
                        <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full bg-white/20 hover:bg-red-500/80 text-white border-0 backdrop-blur-md" title="删除图片" onClick={(e) => { e.stopPropagation(); handleDeleteImage(img.id, task.id); }}>
                          <TrashIcon className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Task Actions */}
            <div className="flex items-center gap-2 mt-2">
              <Button variant="outline" size="sm" className="h-8 rounded-full text-xs" onClick={() => handleReEdit(task)}>
                <EditIcon className="w-3.5 h-3.5 mr-1.5" /> 重新编辑
              </Button>
              <Button variant="outline" size="sm" className="h-8 rounded-full text-xs" onClick={() => handleRegenerate(task)}>
                <RefreshCwIcon className="w-3.5 h-3.5 mr-1.5" /> 再次生成
              </Button>
              <Popover open={deleteTaskConfirmId === task.id} onOpenChange={(open) => setDeleteTaskConfirmId(open ? task.id : null)}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex items-center h-8 rounded-full text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-3 gap-1.5"
                      onClick={() => setDeleteTaskConfirmId(task.id)}
                    />
                  }
                >
                  <TrashIcon className="w-3.5 h-3.5" /> 删除
                </PopoverTrigger>
                <PopoverContent className="w-64 p-4 rounded-2xl shadow-xl border-border/50" align="start">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-5 h-5 text-orange-500" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <h4 className="text-sm font-semibold text-foreground">确认删除这 1 条生成记录吗？</h4>
                        <p className="text-[11px] text-muted-foreground">删除的历史记录无法找回</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                      <Button variant="outline" size="sm" className="h-8 rounded-full px-4 text-xs font-medium" onClick={() => setDeleteTaskConfirmId(null)}>取消</Button>
                      <Button variant="default" size="sm" className="h-8 rounded-full px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium" onClick={() => { setDeleteTaskConfirmId(null); handleDeleteTask(task.id); }}>确定删除</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Error Display */}
            {task.status === 'failed' && task.error && (
              <div className="mt-2">
                {(() => {
                  const parsedError = parseError(task.error)
                  if (parsedError) {
                    // 新的详细错误格式
                    return (
                      <div className="space-y-2">
                        <div
                          className="text-xs text-red-600 bg-red-500/10 p-2 rounded-md cursor-pointer flex items-start gap-1"
                          onClick={() => toggleError(task.id)}
                        >
                          <AlertCircleIcon className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="flex-1">
                            {parsedError.message}
                          </span>
                          {expandedErrors.has(task.id)
                            ? <ChevronUpIcon className="w-3 h-3 mt-0.5 shrink-0" />
                            : <ChevronDownIcon className="w-3 h-3 mt-0.5 shrink-0" />
                          }
                        </div>
                        {expandedErrors.has(task.id) && (
                          <div className="text-xs bg-muted p-3 rounded-md space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-muted-foreground">详细诊断信息</span>
                              <button
                                onClick={() => copyErrorDetails(parsedError)}
                                className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                              >
                                <CopyIcon className="w-3 h-3" />
                                复制
                              </button>
                            </div>
                            <div className="space-y-1">
                              <div className="flex gap-2">
                                <span className="text-muted-foreground">时间:</span>
                                <span className="font-mono">{parsedError.timestamp}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-muted-foreground">耗时:</span>
                                <span className="font-mono">{parsedError.elapsedTime}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-muted-foreground">错误代码:</span>
                                <span className="font-mono">{parsedError.errorDetails.code}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-muted-foreground">HTTP状态:</span>
                                <span className="font-mono">{parsedError.errorDetails.status}</span>
                              </div>
                            </div>
                            <div className="pt-2 border-t border-border">
                              <div className="text-muted-foreground mb-1">请求参数:</div>
                              <pre className="text-[10px] bg-background p-2 rounded overflow-x-auto">
                                {JSON.stringify(parsedError.requestInfo.payload, null, 2)}
                              </pre>
                            </div>
                            {parsedError.errorDetails.responseData !== 'N/A' && (
                              <div className="pt-2 border-t border-border">
                                <div className="text-muted-foreground mb-1">响应数据:</div>
                                <pre className="text-[10px] bg-background p-2 rounded overflow-x-auto text-red-600">
                                  {typeof parsedError.errorDetails.responseData === 'string'
                                    ? parsedError.errorDetails.responseData
                                    : JSON.stringify(parsedError.errorDetails.responseData, null, 2)}
                                </pre>
                              </div>
                            )}
                            {parsedError.errorDetails.stack !== 'N/A' && (
                              <div className="pt-2 border-t border-border">
                                <div className="text-muted-foreground mb-1">堆栈跟踪:</div>
                                <pre className="text-[10px] bg-background p-2 rounded overflow-x-auto text-red-600">
                                  {parsedError.errorDetails.stack}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  } else {
                    // 旧格式或普通错误消息
                    return (
                      <div
                        className="text-xs text-red-600 bg-red-500/10 p-2 rounded-md cursor-pointer flex items-start gap-1"
                        onClick={() => toggleError(task.id)}
                      >
                        <AlertCircleIcon className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className={expandedErrors.has(task.id) ? "" : "line-clamp-2"}>
                          {task.error}
                        </span>
                        {task.error.length > 50 && (
                          expandedErrors.has(task.id)
                            ? <ChevronUpIcon className="w-3 h-3 mt-0.5 shrink-0 ml-auto" />
                            : <ChevronDownIcon className="w-3 h-3 mt-0.5 shrink-0 ml-auto" />
                        )}
                      </div>
                    )
                  }
                })()}
              </div>
            )}
            
            {/* Task Divider */}
            <div className="h-px bg-border/40 w-full my-4" />
          </div>
        ))}
        {/* Bottom Spacer to dynamically prevent overlap with input box based on input box height */}
        <div ref={bottomRef} />
        <div id="bottom-spacer" className="h-[150px] transition-all duration-300" />
      </div>
    </div>
  )
}
