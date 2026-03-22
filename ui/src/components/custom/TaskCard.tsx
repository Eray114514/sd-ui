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
  AlertCircle
} from "lucide-react"
import { toast } from "sonner"
import { useGenerationStore } from "@/store/generationStore"
import { parseError } from "@/errors/errorHandler"
import type { Task, GeneratedImage, ProgressData, ParsedErrorDetails, ImageWithTask } from "@/types"
import { useState, useCallback } from "react"
import { deleteAsset, updateAsset, getAssetDownloadUrl } from "@/services/assetsService"
import { deleteTask } from "@/services/tasksService"
import { generate } from "@/services/generateService"

interface TaskCardProps {
  task: Task
  progressData?: ProgressData
  selectedImage: ImageWithTask | null
  setSelectedImage: (img: ImageWithTask | null) => void
  onDeleted: (id: string) => void
  onTasksChange: () => void
}

export function TaskCard({ task, progressData, selectedImage, setSelectedImage, onDeleted, onTasksChange }: TaskCardProps) {
  const fillFromTask = useGenerationStore(state => state.fillFromTask)
  const [deleteTaskConfirmId, setDeleteTaskConfirmId] = useState<string | null>(null)
  const [deleteImageConfirmId, setDeleteImageConfirmId] = useState<string | null>(null)
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())

  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      await deleteTask(taskId)
      onTasksChange()
      toast.success("任务已删除")
    } catch {
      toast.error("删除任务失败")
    }
  }, [onTasksChange])

  const handleDeleteImage = useCallback(async (imageId: string, taskId: string) => {
    try {
      await deleteAsset(imageId)
      onDeleted(imageId)
      toast.success("图片已删除")
    } catch {
      toast.error("删除图片失败")
    }
  }, [onDeleted])

  const handleFavoriteImage = useCallback(async (imageId: string, currentStatus: boolean, taskId: string) => {
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

  const handleCopyPrompt = useCallback(() => {
    navigator.clipboard.writeText(task.prompt)
    toast.success("提示词已复制")
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

  const copyErrorDetails = useCallback((errorDetails: ParsedErrorDetails) => {
    const textToCopy = JSON.stringify(errorDetails, null, 2)
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast.success("错误详情已复制到剪贴板")
    }).catch(() => {
      toast.error("复制失败")
    })
  }, [])

  return (
    <div className="flex flex-col gap-4" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 400px' }}>
      <div className="flex flex-col gap-2">
        <div className="text-sm text-muted-foreground">
          {new Date(task.createdAt).toLocaleString()}
        </div>
        <div className="text-base font-medium flex items-start gap-2">
          <span className="flex-1">{task.prompt}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground" onClick={handleCopyPrompt}>
            <CopyIcon className="w-3.5 h-3.5" />
          </Button>
        </div>

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

      {task.status === 'processing' && (
        <div className="flex flex-col gap-2 mt-2">
          {progressData?.current_image && (
            <div className="relative aspect-square md:aspect-video max-w-sm rounded-xl overflow-hidden bg-muted border border-border/50">
              <img
                src={`data:image/png;base64,${progressData.current_image}`}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${Math.max(5, (progressData?.progress || 0) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground w-12 text-right">
              {((progressData?.progress || 0) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {task.status === 'completed' && task.images && task.images.length > 0 && (
        <div className="columns-2 sm:columns-3 md:columns-4 gap-2">
          {task.images.map((img: GeneratedImage) => (
            <div
              key={img.id}
              className="relative group rounded-xl overflow-hidden bg-muted border border-border/50 cursor-pointer break-inside-avoid mb-2 z-0"
              onClick={() => setSelectedImage({ ...img, task } as ImageWithTask)}
            >
              <img
                src={`/api/image?path=${encodeURIComponent(img.path)}`}
                alt="Generated"
                className="w-full h-auto object-contain transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-start p-2 z-10">
                <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/40 text-white border-0 backdrop-blur-md hover:scale-110 transition-all duration-150 active:scale-95"
                    onClick={() => handleDownloadImage(img.path)}
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/40 text-white border-0 backdrop-blur-md hover:scale-110 transition-all duration-150 active:scale-95"
                    onClick={() => handleFavoriteImage(img.id, img.isFavorite, task.id)}
                  >
                    <StarIcon className={`w-3.5 h-3.5 ${img.isFavorite ? "fill-yellow-400 text-yellow-400" : ""}`} />
                  </Button>
                  <Popover open={deleteImageConfirmId === img.id} onOpenChange={(open) => setDeleteImageConfirmId(open ? img.id : null)}>
                    <PopoverTrigger
                      render={
                        <button
                          type="button"
                          className="h-8 w-8 rounded-full bg-white/20 hover:bg-red-500/80 text-white border-0 backdrop-blur-md hover:scale-110 transition-all duration-150 active:scale-95 flex items-center justify-center"
                          title="删除图片"
                          onClick={() => setDeleteImageConfirmId(img.id)}
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      }
                    />
                    <PopoverContent className="w-64 p-4 rounded-2xl shadow-xl border-border/50" align="end" side="top" sideOffset={8}>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center shrink-0">
                            <AlertCircle className="w-5 h-5 text-orange-500" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <h4 className="text-sm font-semibold text-foreground">确认删除这张图片吗？</h4>
                            <p className="text-xs text-muted-foreground">删除的图片无法找回</p>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                          <Button variant="outline" size="sm" className="h-8 rounded-full px-4 text-xs font-medium" onClick={() => setDeleteImageConfirmId(null)}>取消</Button>
                          <Button variant="default" size="sm" className="h-8 rounded-full px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium" onClick={() => { setDeleteImageConfirmId(null); handleDeleteImage(img.id, task.id); }}>确定删除</Button>
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

      <div className="flex items-center gap-2 mt-2">
        <Button variant="outline" size="sm" className="h-8 rounded-full text-xs" onClick={handleReEdit}>
          <EditIcon className="w-3.5 h-3.5 mr-1.5" /> 重新编辑
        </Button>
        <Button variant="outline" size="sm" className="h-8 rounded-full text-xs" onClick={handleRegenerate}>
          <RefreshCwIcon className="w-3.5 h-3.5 mr-1.5" /> 再次生成
        </Button>
        <Popover open={deleteTaskConfirmId === task.id} onOpenChange={(open) => setDeleteTaskConfirmId(open ? task.id : null)}>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="inline-flex items-center h-8 rounded-full text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-3 gap-1.5"
                onClick={() => setDeleteTaskConfirmId(task.id)}
              >
                <TrashIcon className="w-3.5 h-3.5" /> 删除
              </button>
            }
          />
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

      {task.status === 'failed' && task.error && (
        <div className="mt-2">
          <ErrorDisplay
            error={task.error}
            taskId={task.id}
            expandedErrors={expandedErrors}
            toggleError={toggleError}
            copyErrorDetails={copyErrorDetails}
          />
        </div>
      )}

      <div className="h-px bg-border/40 w-full my-4" />
    </div>
  )
}

interface ErrorDisplayProps {
  error: string
  taskId: string
  expandedErrors: Set<string>
  toggleError: (taskId: string) => void
  copyErrorDetails: (errorDetails: ParsedErrorDetails) => void
}

function ErrorDisplay({ error, taskId, expandedErrors, toggleError, copyErrorDetails }: ErrorDisplayProps) {
  const parsedError = parseError(error)

  if (parsedError) {
    return (
      <div className="space-y-2">
        <div
          className="text-xs text-red-600 bg-red-500/10 p-2 rounded-md cursor-pointer flex items-start gap-1"
          onClick={() => toggleError(taskId)}
        >
          <AlertCircleIcon className="w-3 h-3 mt-0.5 shrink-0" />
          <span className="flex-1">
            {parsedError.message}
          </span>
          {expandedErrors.has(taskId)
            ? <ChevronUpIcon className="w-3 h-3 mt-0.5 shrink-0" />
            : <ChevronDownIcon className="w-3 h-3 mt-0.5 shrink-0" />
          }
        </div>
        {expandedErrors.has(taskId) && (
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
            {parsedError.requestInfo.payload && (
              <div className="pt-2 border-t border-border">
                <div className="text-muted-foreground mb-1">请求参数:</div>
                <pre className="text-[10px] bg-background p-2 rounded overflow-x-auto">
                  {JSON.stringify(parsedError.requestInfo.payload, null, 2)}
                </pre>
              </div>
            )}
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
    return (
      <div
        className="text-xs text-red-600 bg-red-500/10 p-2 rounded-md cursor-pointer flex items-start gap-1"
        onClick={() => toggleError(taskId)}
      >
        <AlertCircleIcon className="w-3 h-3 mt-0.5 shrink-0" />
        <span className={expandedErrors.has(taskId) ? "" : "line-clamp-2"}>
          {error}
        </span>
        {error && error.length > 50 && (
          expandedErrors.has(taskId)
            ? <ChevronUpIcon className="w-3 h-3 mt-0.5 shrink-0 ml-auto" />
            : <ChevronDownIcon className="w-3 h-3 mt-0.5 shrink-0 ml-auto" />
        )}
      </div>
    )
  }
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m18 15-6-6-6 6"/>
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6"/>
    </svg>
  )
}