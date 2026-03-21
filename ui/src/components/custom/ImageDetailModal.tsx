"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DownloadIcon, StarIcon, TrashIcon, RefreshCwIcon, EditIcon, AlertCircle } from "lucide-react"
import { useGenerationStore } from "@/store/generationStore"
import axios from "axios"
import { toast } from "sonner"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface GeneratedImage {
  id: string
  path: string
  isFavorite: boolean
  taskId: string
  task: any
  createdAt: string
}

interface ImageDetailModalProps {
  image: GeneratedImage | null
  isOpen: boolean
  onClose: () => void
  onDeleted: (id: string) => void
  relatedImages: GeneratedImage[]
}

export function ImageDetailModal({ image, isOpen, onClose, onDeleted, relatedImages }: ImageDetailModalProps) {
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(image)
  const fillFromTask = useGenerationStore(state => state.fillFromTask)

  useEffect(() => {
    if (image && !image.task) {
        // If image object is incomplete (missing task), try to find it in relatedImages
        const found = relatedImages.find(img => img.id === image.id);
        if (found && found.task) {
            setCurrentImage(found);
            return;
        }
    }
    setCurrentImage(image)
  }, [image, relatedImages])

  if (!currentImage || !currentImage.task) return null

  const getBasename = (p: string) => {
    const normalized = p.replace(/\\/g, "/")
    const parts = normalized.split("/")
    return parts[parts.length - 1] || "image.png"
  }

  const handleDownload = () => {
    const link = document.createElement("a")
    link.href = `/api/image?path=${encodeURIComponent(currentImage.path)}`
    link.download = getBasename(currentImage.path)
    link.click()
  }

  const handleFavorite = async () => {
    try {
      const newStatus = !currentImage.isFavorite
      await axios.put('/api/assets', { id: currentImage.id, isFavorite: newStatus })
      setCurrentImage({ ...currentImage, isFavorite: newStatus })
      toast.success(newStatus ? "已添加到收藏" : "已从收藏移除")
    } catch (e) {
      toast.error("更新收藏状态失败")
    }
  }

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const handleDelete = async () => {
    const imageIdToDelete = currentImage.id
    try {
      await axios.delete('/api/assets', { data: { id: imageIdToDelete } })
      toast.success("图片已删除")

      const currentIndex = relatedImages.findIndex(img => img.id === imageIdToDelete)
      const remainingImages = relatedImages.filter(img => img.id !== imageIdToDelete)
      if (remainingImages.length > 0) {
        const nextIndex = currentIndex >= remainingImages.length ? remainingImages.length - 1 : currentIndex
        const nextImage = remainingImages[nextIndex]
        onDeleted(imageIdToDelete)
        setCurrentImage({ ...nextImage, task: nextImage.task || currentImage.task })
      } else {
        onDeleted(imageIdToDelete)
        onClose()
      }
      setIsDeleteDialogOpen(false)
    } catch (e) {
      toast.error("删除图片失败")
    }
  }

  const handleReEdit = () => {
    fillFromTask(currentImage.task)
    toast.success("参数已加载到控制面板")
    onClose()
  }

  const handleRegenerate = async () => {
    try {
      const task = currentImage.task
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
      onClose()
    } catch (e) {
      toast.error("重新生成失败")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[90vw] lg:max-w-[1200px] h-[90vh] sm:h-[85vh] p-0 flex flex-col md:flex-row overflow-hidden bg-background border-border">
        <VisuallyHidden>
            <DialogTitle>Image Details</DialogTitle>
        </VisuallyHidden>
        
        {/* Left: Preview */}
        <div className="w-full md:w-[70%] h-[50%] md:h-full bg-black/90 relative flex items-center justify-center backdrop-blur-md">
          <img
            src={`/api/image?path=${encodeURIComponent(currentImage.path)}`}
            alt="预览"
            className="max-w-full max-h-full object-contain"
          />
        </div>

        {/* Right: Details */}
        <div className="w-full md:w-[30%] h-[50%] md:h-full flex flex-col border-t md:border-t-0 md:border-l border-border bg-background overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-border flex justify-between items-center bg-background/95 backdrop-blur z-10 sticky top-0 shrink-0">
            <div className="text-sm text-muted-foreground font-medium">
              {new Date(currentImage.createdAt).toLocaleString()}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" className="hover:bg-muted rounded-full" onClick={handleDownload} title="下载原图">
                <DownloadIcon className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="hover:bg-muted rounded-full" onClick={handleFavorite} title={currentImage.isFavorite ? "取消收藏" : "收藏"}>
                <StarIcon className={`w-4 h-4 ${currentImage.isFavorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
              </Button>
              <Popover open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
                      title="删除图片"
                      onClick={() => setIsDeleteDialogOpen(true)}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  }
                />
                <PopoverContent className="w-64 p-4 rounded-2xl shadow-xl border-border/50" align="end">
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
                      <Button variant="outline" size="sm" className="h-8 rounded-full px-4 text-xs font-medium" onClick={() => setIsDeleteDialogOpen(false)}>取消</Button>
                      <Button variant="default" size="sm" className="h-8 rounded-full px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium" onClick={handleDelete}>确定删除</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <div className="w-px h-6 bg-border mx-1 self-center" />
              <Button variant="ghost" size="icon" className="hover:bg-muted rounded-full" onClick={onClose} title="关闭">
                <span className="sr-only">Close</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0 p-4">
            {/* Batch Thumbnails */}
            {relatedImages.length > 1 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-2">批次图片</h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {relatedImages.map(img => (
                    <div 
                      key={img.id} 
                      className={`relative w-16 h-16 rounded-md overflow-hidden cursor-pointer border-2 ${img.id === currentImage.id ? 'border-primary' : 'border-transparent'}`}
                      onClick={() => setCurrentImage({ ...img, task: img.task || currentImage.task })}
                    >
                      <img 
                        src={`/api/image?path=${encodeURIComponent(img.path)}`} 
                        className="w-full h-full object-cover" 
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-1">提示词</h3>
                <div className="bg-muted p-3 rounded-md text-sm text-muted-foreground whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                  {currentImage.task.prompt}
                </div>
              </div>

              {currentImage.task.negative_prompt && (
                <div>
                  <h3 className="text-sm font-medium mb-1">反向提示词</h3>
                  <div className="bg-muted p-3 rounded-md text-sm text-muted-foreground whitespace-pre-wrap break-words max-h-20 overflow-y-auto">
                    {currentImage.task.negative_prompt}
                  </div>
                </div>
              )}

              {/* Parameters */}
              <div>
                <h3 className="text-sm font-medium mb-2">生成参数</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">模型: {currentImage.task.model_checkpoint || "默认"}</Badge>
                  <Badge variant="outline">尺寸: {currentImage.task.width}x{currentImage.task.height}</Badge>
                  <Badge variant="outline">步数: {currentImage.task.steps}</Badge>
                  <Badge variant="outline">CFG: {currentImage.task.cfg_scale}</Badge>
                  <Badge variant="outline">采样器: {currentImage.task.sampler_name}</Badge>
                  <Badge variant="outline">种子: {currentImage.task.seed}</Badge>
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-border grid grid-cols-2 gap-3 shrink-0">
            <Button variant="outline" onClick={handleReEdit}>
              <EditIcon className="w-4 h-4 mr-2" />
              重新编辑
            </Button>
            <Button onClick={handleRegenerate}>
              <RefreshCwIcon className="w-4 h-4 mr-2" />
              重新生成
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
