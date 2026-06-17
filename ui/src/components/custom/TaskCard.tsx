"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Loader2Icon,
  AlertCircleIcon,
  CopyIcon,
  DownloadIcon,
  StarIcon,
  TrashIcon,
  EditIcon,
  RefreshCwIcon,
  AlertCircle,
  ChevronUpIcon,
  ChevronDownIcon
} from "lucide-react"
import { toast } from "sonner"
import { useGenerationStore } from "@/store/generationStore"
import { parseError } from "@/errors/errorHandler"
import { copyToClipboard } from "@/lib/utils"
import type { Task, GeneratedImage, ProgressData, ParsedErrorDetails, ImageWithTask } from "@/types"
import { useState, useCallback, memo } from "react"
import { deleteAsset, updateAsset, getAssetDownloadUrl } from "@/services/assetsService"
import { deleteTask } from "@/services/tasksService"
import { generate } from "@/services/generateService"
import { cn } from "@/lib/utils"

interface TaskCardProps {
  task: Task
  progressData?: ProgressData
  selectedImage: ImageWithTask | null
  setSelectedImage: (img: ImageWithTask | null) => void
  onDeleted: (id: string) => void
  onTasksChange: () => void
}

export const TaskCard = memo(function TaskCard({ task, progressData, setSelectedImage, onDeleted, onTasksChange }: TaskCardProps) {
  const fillFromTask = useGenerationStore(state => state.fillFromTask)
  const [deleteTaskConfirmId, setDeleteTaskConfirmId] = useState<string | null>(null)
  const [deleteImageConfirmId, setDeleteImageConfirmId] = useState<string | null>(null)
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const [isPromptHovered, setIsPromptHovered] = useState(false)

  const handleImageLoad = useCallback((id: string) => {
    setLoadedImages(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      await deleteTask(taskId)
      onTasksChange()
      toast.success("任务已删除")
    } catch {
      toast.error("删除任务失败")
    }
  }, [onTasksChange])

  const handleDeleteImage = useCallback(async (imageId: string) => {
    try {
      await deleteAsset(imageId)
      onDeleted(imageId)
      onTasksChange()
      toast.success("图片已删除")
    } catch {
      toast.error("删除图片失败")
    }
  }, [onDeleted, onTasksChange])

  const handleFavoriteImage = useCallback(async (imageId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus
      await updateAsset(imageId, newStatus)
      onTasksChange()
      toast.success(newStatus ? "已收藏" : "已取消收藏")
    } catch {
      toast.error("操作失败")
    }
  }, [onTasksChange])

  const handleDownloadImage = useCallback((path: string) => {
    const link = document.createElement("a")
    link.href = getAssetDownloadUrl(path)
    link.download = path.split(/[\\/]/).pop() || "image.png"
    link.click()
  }, [])

  const handleReEdit = useCallback(() => {
    fillFromTask(task)
    toast.success("参数已加载到控制面板")
  }, [fillFromTask, task])

  const handleRegenerate = useCallback(async () => {
    try {
      const styles = JSON.parse(task.styles || "[]")
      await generate({
        prompt: task.prompt,
        negative_prompt: task.negative_prompt,
        styles,
        override_settings: {
          sd_model_checkpoint: task.model_checkpoint
        },
        width: task.width,
        height: task.height,
        sampler_name: task.sampler_name,
        steps: task.steps,
        cfg_scale: task.cfg_scale,
        seed: -1
      })
      toast.success("重新生成任务已添加到队列")
      window.dispatchEvent(new CustomEvent('task-created'))
    } catch {
      toast.error("重新生成失败")
    }
  }, [task])

  const handleCopyPrompt = useCallback(async () => {
    const success = await copyToClipboard(task.prompt)
    if (success) {
      toast.success("提示词已复制")
    } else {
      toast.error("复制失败")
    }
  }, [task.prompt])

  const toggleError = useCallback((taskId: string) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }, [])

  const copyErrorDetails = useCallback(async (errorDetails: ParsedErrorDetails) => {
    const textToCopy = JSON.stringify(errorDetails, null, 2)
    const success = await copyToClipboard(textToCopy)
    if (success) {
      toast.success("错误详情已复制到剪贴板")
    } else {
      toast.error("复制失败")
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="text-xs text-muted-foreground font-mono">
          {new Date(task.createdAt).toLocaleString()}
        </div>
        <div
          className="text-base font-medium flex items-start gap-2 group/prompt"
          onMouseEnter={() => setIsPromptHovered(true)}
          onMouseLeave={() => setIsPromptHovered(false)}
        >
          <span className="flex-1 leading-relaxed">{task.prompt}</span>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground transition-opacity",
              isPromptHovered ? "opacity-100" : "opacity-0"
            )}
            onClick={handleCopyPrompt}
          >
            <CopyIcon className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/15 border-none font-normal">
            {task.model_checkpoint || '默认模型'}
          </Badge>
          {(task.width && task.height) && (
            <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-lg">
              {task.width} x {task.height}
            </span>
          )}
          {task.sampler_name && (
            <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-lg">
              {task.sampler_name}
            </span>
          )}
          {task.status === 'pending' && <Badge variant="outline" className="text-muted-foreground border-dashed">等待中</Badge>}
          {task.status === 'processing' && <Badge variant="default" className="bg-primary text-primary-foreground"><Loader2Icon className="w-3 h-3 mr-1 animate-spin" /> 生成中</Badge>}
          {task.status === 'failed' && <Badge variant="destructive"><AlertCircleIcon className="w-3 h-3 mr-1" /> 失败</Badge>}
        </div>
      </div>

      {task.status === 'processing' && (
        <div className="flex flex-col gap-2 mt-1">
          {progressData?.current_image && (
            <div className="relative aspect-square md:aspect-video max-w-sm rounded-xl overflow-hidden bg-card border border-border">
              <img
                src={`data:image/png;base64,${progressData.current_image}`}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${Math.max(5, (progressData?.progress || 0) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground w-12 text-right">
              {((progressData?.progress || 0) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {task.status === 'completed' && task.images && task.images.length > 0 && (
        <div className="columns-2 sm:columns-3 md:columns-4 gap-3">
          {task.images.map((img: GeneratedImage) => (
            <div
              key={img.id}
              className="relative group rounded-xl overflow-hidden bg-card border border-border cursor-pointer break-inside-avoid mb-3 z-0"
              onClick={() => setSelectedImage({ ...img, task } as ImageWithTask)}
            >
              {!loadedImages.has(img.id) && (
                <div
                  className="w-full bg-secondary flex items-center justify-center"
                  style={{ aspectRatio: task.width && task.height ? `${task.width}/${task.height}` : '1 / 1' }}
                >
                  <Loader2Icon className="w-5 h-5 text-muted-foreground animate-spin" />
                </div>
              )}
              <img
                src={`/api/image?path=${encodeURIComponent(img.path)}`}
                alt="Generated"
                className={`w-full h-auto block transition-all duration-500 ${loadedImages.has(img.id) ? 'opacity-100 scale-100' : 'opacity-0 scale-95 absolute inset-0'} relative z-0`}
                loading="lazy"
                decoding="async"
                onLoad={() => handleImageLoad(img.id)}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-start p-2 z-20 pointer-events-none">
                <div className="flex justify-end gap-1.5 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/40 text-white border-0 backdrop-blur-md transition-colors duration-150 active:scale-95"
                    onClick={() => handleDownloadImage(img.path)}
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/40 text-white border-0 backdrop-blur-md transition-colors duration-150 active:scale-95"
                    onClick={() => handleFavoriteImage(img.id, img.isFavorite)}
                  >
                    <StarIcon className={`w-3.5 h-3.5 ${img.isFavorite ? "fill-yellow-400 text-yellow-400" : ""}`} />
                  </Button>
                  <Popover open={deleteImageConfirmId === img.id} onOpenChange={(open) => setDeleteImageConfirmId(open ? img.id : null)}>
                    <PopoverTrigger
                      render={
                        <button
                          type="button"
                          className="h-7 w-7 rounded-full bg-white/20 hover:bg-red-500/80 text-white border-0 backdrop-blur-md transition-colors duration-150 active:scale-95 flex items-center justify-center"
                          title="删除图片"
                          onClick={(e) => { e.stopPropagation(); setDeleteImageConfirmId(img.id); }}
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      }
                    />
                    <PopoverContent className="w-60 p-4 rounded-xl shadow-lg border-border" align="end" side="top" sideOffset={8} onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                            <AlertCircle className="w-5 h-5 text-destructive" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <h4 className="text-sm font-medium text-foreground">确认删除图片？</h4>
                            <p className="text-xs text-muted-foreground">删除后无法找回</p>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                          <Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs font-medium" onClick={(e) => { e.stopPropagation(); setDeleteImageConfirmId(null); }}>取消</Button>
                          <Button variant="default" size="sm" className="h-8 rounded-lg px-3 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-medium" onClick={(e) => { e.stopPropagation(); setDeleteImageConfirmId(null); handleDeleteImage(img.id); }}>删除</Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-1">
        <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary" onClick={handleReEdit}>
          <EditIcon className="w-3.5 h-3.5 mr-1.5" /> 重新编辑
        </Button>
        <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary" onClick={handleRegenerate}>
          <RefreshCwIcon className="w-3.5 h-3.5 mr-1.5" /> 再次生成
        </Button>
        <Popover open={deleteTaskConfirmId === task.id} onOpenChange={(open) => setDeleteTaskConfirmId(open ? task.id : null)}>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="inline-flex items-center h-8 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-3 gap-1.5 transition-colors"
                onClick={() => setDeleteTaskConfirmId(task.id)}
              >
                <TrashIcon className="w-3.5 h-3.5" /> 删除
              </button>
            }
          />
          <PopoverContent className="w-60 p-4 rounded-xl shadow-lg border-border" align="start">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="text-sm font-medium text-foreground">确认删除记录？</h4>
                  <p className="text-[11px] text-muted-foreground">删除的历史记录无法找回</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs font-medium" onClick={() => setDeleteTaskConfirmId(null)}>取消</Button>
                <Button variant="default" size="sm" className="h-8 rounded-lg px-3 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-medium" onClick={() => { setDeleteTaskConfirmId(null); handleDeleteTask(task.id); }}>删除</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {task.status === 'failed' && task.error && (
        <div className="mt-1">
          <ErrorDisplay
            error={task.error}
            taskId={task.id}
            expandedErrors={expandedErrors}
            toggleError={toggleError}
            copyErrorDetails={copyErrorDetails}
          />
        </div>
      )}

      <div className="h-px bg-border w-full my-4" />
    </div>
  )
})

interface ErrorDisplayProps {
  error: string
  taskId: string
  expandedErrors: Set<string>
  toggleError: (taskId: string) => void
  copyErrorDetails: (errorDetails: ParsedErrorDetails) => void
}

const ErrorDisplay = memo(function ErrorDisplay({ error, taskId, expandedErrors, toggleError, copyErrorDetails }: ErrorDisplayProps) {
  const parsedError = parseError(error)

  if (parsedError) {
    return (
      <div className="space-y-2">
        <div
          className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg cursor-pointer flex items-start gap-2"
          onClick={() => toggleError(taskId)}
        >
          <AlertCircleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="flex-1 line-clamp-1">
            {parsedError.message}
          </span>
          {expandedErrors.has(taskId)
            ? <ChevronUpIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            : <ChevronDownIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          }
        </div>
        {expandedErrors.has(taskId) && (
          <div className="text-xs bg-card border border-border p-3 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground">详细诊断信息</span>
              <button
                onClick={() => copyErrorDetails(parsedError)}
                className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
              >
                <CopyIcon className="w-3 h-3" />
                复制
              </button>
            </div>
            <div className="space-y-1 font-mono">
              <div className="flex gap-2">
                <span className="text-muted-foreground">时间:</span>
                <span>{parsedError.timestamp}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground">耗时:</span>
                <span>{parsedError.elapsedTime}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground">错误代码:</span>
                <span>{parsedError.errorDetails.code}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground">HTTP状态:</span>
                <span>{parsedError.errorDetails.status}</span>
              </div>
            </div>
            {parsedError.requestInfo.payload && (
              <div className="pt-2 border-t border-border">
                <div className="text-muted-foreground mb-1">请求参数:</div>
                <pre className="text-[10px] bg-background p-2 rounded-lg overflow-x-auto">
                  {JSON.stringify(parsedError.requestInfo.payload, null, 2)}
                </pre>
              </div>
            )}
            {parsedError.errorDetails.responseData !== 'N/A' && (
              <div className="pt-2 border-t border-border">
                <div className="text-muted-foreground mb-1">响应数据:</div>
                <pre className="text-[10px] bg-background p-2 rounded-lg overflow-x-auto text-destructive">
                  {typeof parsedError.errorDetails.responseData === 'string'
                    ? parsedError.errorDetails.responseData
                    : JSON.stringify(parsedError.errorDetails.responseData, null, 2)}
                </pre>
              </div>
            )}
            {parsedError.errorDetails.stack !== 'N/A' && (
              <div className="pt-2 border-t border-border">
                <div className="text-muted-foreground mb-1">堆栈跟踪:</div>
                <pre className="text-[10px] bg-background p-2 rounded-lg overflow-x-auto text-destructive">
                  {parsedError.errorDetails.stack}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    )
  } else {
    return (
      <div
        className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg cursor-pointer flex items-start gap-2"
        onClick={() => toggleError(taskId)}
      >
        <AlertCircleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span className={cn("flex-1", expandedErrors.has(taskId) ? "" : "line-clamp-2")}>
          {error}
        </span>
        {error && error.length > 50 && (
          expandedErrors.has(taskId)
            ? <ChevronUpIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            : <ChevronDownIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        )}
      </div>
    )
  }
})
