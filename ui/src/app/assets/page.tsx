"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import axios from "axios"
import { ImageDetailModal } from "@/components/custom/ImageDetailModal"
import { Loader2, Search, Filter, Heart, Download, TrashIcon, AlertCircle, Star, CheckSquare, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ASSETS_PAGE_SIZE } from "@/lib/constants"
import type { ImageWithTask } from "@/types"

export default function AssetsPage() {
  const [images, setImages] = useState<ImageWithTask[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [selectedImage, setSelectedImage] = useState<ImageWithTask | null>(null)
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(0)
  const [deleteImageConfirmId, setDeleteImageConfirmId] = useState<string | null>(null)
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [selectedModel, setSelectedModel] = useState<string>("")
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const allModels = useMemo(() => {
    const models = new Set<string>()
    images.forEach(img => {
      const model = img.task.model_checkpoint
      if (model) models.add(model)
    })
    return Array.from(models)
  }, [images])

  const observer = useRef<IntersectionObserver | null>(null)

  const fetchImages = async (pageNum?: number) => {
    setIsLoading(true)
    try {
      const url = pageNum !== undefined
        ? `/api/assets?page=${pageNum}`
        : '/api/assets'
      const res = await axios.get(url)
      const newImages = res.data

      if (newImages.length < ASSETS_PAGE_SIZE) {
        setHasMore(false)
      }

      setImages(prev => {
        if (pageNum !== undefined && pageNum > 0) {
          const existingIds = new Set(prev.map(i => i.id))
          const uniqueNew = newImages.filter((i: ImageWithTask) => !existingIds.has(i.id))
          return [...prev, ...uniqueNew]
        }
        return newImages
      })
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchImages()
  }, [])

  const lastImageElementRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading) return
    if (observer.current) observer.current.disconnect()

    if (!node) return

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        const nextPage = page + 1
        setPage(nextPage)
        fetchImages(nextPage)
      }
    })

    observer.current.observe(node)
  }, [isLoading, hasMore, page])


  const handleImageClick = (img: ImageWithTask) => {
    setSelectedImage(img)
  }

  const handleDeleted = (id: string) => {
    setImages(prev => {
      const deletedImage = prev.find(img => img.id === id)
      const taskId = deletedImage?.taskId
      const remainingImages = prev.filter(img => img.id !== id)

      if (taskId && selectedImage?.id === id) {
        setSelectedImage(null)
      } else if (selectedImage?.task?.images) {
        const newTaskImages = selectedImage.task.images.filter(img => img.id !== id)
        setSelectedImage(prev => prev ? { ...prev, task: { ...prev.task, images: newTaskImages } } : null)
      }

      return remainingImages
    })
  }

  const handleDeleteImage = async (id: string) => {
    try {
      await axios.delete('/api/assets', { data: { id } })
      setImages(prev => prev.filter(img => img.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  const handleFavoriteImage = async (img: ImageWithTask) => {
    try {
      const newStatus = !img.isFavorite
      await axios.put('/api/assets', { id: img.id, isFavorite: newStatus })
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, isFavorite: newStatus } : i))
    } catch (e) {
      console.error(e)
    }
  }

  const handleBatchDelete = async () => {
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 张图片吗？`)) return
    try {
      await Promise.all(Array.from(selectedIds).map(id => axios.delete('/api/assets', { data: { id } })))
      setImages(prev => prev.filter(img => !selectedIds.has(img.id)))
      setSelectedIds(new Set())
      setIsBatchMode(false)
    } catch (e) {
      console.error('Batch delete fail:', e)
    }
  }

  const handleBatchFavorite = async () => {
    try {
      const selectedImgs = images.filter(img => selectedIds.has(img.id))
      const allFavorited = selectedImgs.every(img => img.isFavorite)
      const newStatus = !allFavorited

      await Promise.all(Array.from(selectedIds).map(id => axios.put('/api/assets', { id, isFavorite: newStatus })))
      setImages(prev => prev.map(img => selectedIds.has(img.id) ? { ...img, isFavorite: newStatus } : img))
      setSelectedIds(new Set())
      setIsBatchMode(false)
    } catch (e) {
      console.error('Batch favorite fail:', e)
    }
  }

  const handleDownloadImage = (path: string) => {
    const link = document.createElement("a")
    link.href = `/api/image?path=${encodeURIComponent(path)}`
    link.download = path.split(/[\\/]/).pop() || "image.png"
    link.click()
  }

  const relatedImages = useMemo(() =>
    selectedImage ? images.filter(img => img.taskId === selectedImage.taskId) : [],
    [selectedImage, images]
  )

  const filteredImages = useMemo(() => {
    return images.filter(img => {
      const matchesTab = activeTab === "favorites" ? img.isFavorite : true
      const matchesSearch = img.task.prompt.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesModel = selectedModel ? img.task.model_checkpoint === selectedModel : true
      return matchesTab && matchesSearch && matchesModel
    }).sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime()
      const timeB = new Date(b.createdAt).getTime()
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB
    })
  }, [images, activeTab, searchQuery, selectedModel, sortOrder])

  const groupedImages = useMemo(() => {
    const groups: { date: string; images: ImageWithTask[] }[] = []
    for (const img of filteredImages) {
      const dateKey = new Date(img.createdAt).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })
      const existingGroup = groups.find(g => g.date === dateKey)
      if (existingGroup) {
        existingGroup.images.push(img)
      } else {
        groups.push({ date: dateKey, images: [img] })
      }
    }
    return groups
  }, [filteredImages])

  const lastGroupIndex = groupedImages.length - 1

  const handleSearchExpand = () => {
    setIsSearchExpanded(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  const handleSearchCollapse = () => {
    if (!searchQuery) setIsSearchExpanded(false)
  }

  const exitBatchMode = () => {
    setIsBatchMode(false)
    setSelectedIds(new Set())
  }

  const modelTriggerLabel = selectedModel
    ? selectedModel.substring(0, 8) + (selectedModel.length > 8 ? '...' : '')
    : '模型'

  return (
    <div className="min-h-screen bg-background p-6 md:p-8 pb-32">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sticky top-0 z-30 bg-background/95 backdrop-blur-md py-3 -mx-2 px-2 border-b border-border/50 transition-all">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-9">
              <TabsTrigger value="all" className="px-4 text-xs">全部</TabsTrigger>
              <TabsTrigger value="images" className="px-4 text-xs">图片</TabsTrigger>
              <TabsTrigger value="favorites" className="px-4 text-xs">收藏</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Desktop search */}
            <div className="relative hidden md:block w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="搜索提示词..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 pr-3 text-xs"
              />
            </div>

            {/* Mobile search toggle */}
            {isSearchExpanded ? (
              <div className="relative flex-1 md:hidden">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="search"
                  placeholder="搜索提示词..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={handleSearchCollapse}
                  className="h-9 pl-9 pr-8 text-xs"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg"
                  onClick={() => { setSearchQuery(""); setIsSearchExpanded(false); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-9 w-9 rounded-xl"
                onClick={handleSearchExpand}
              >
                <Search className="h-4 w-4" />
              </Button>
            )}

            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-9 rounded-xl text-xs gap-1.5 ${selectedModel ? 'text-primary bg-primary/10 hover:bg-primary/20' : 'text-muted-foreground'}`}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    {modelTriggerLabel}
                  </Button>
                }
              />
              <PopoverContent className="w-56 p-2 rounded-xl border-border" align="end" sideOffset={8}>
                <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedModel("")}
                    className={`justify-start text-xs rounded-lg ${!selectedModel ? 'bg-primary/10 text-primary hover:bg-primary/20' : ''}`}
                  >
                    全部模型
                  </Button>
                  {allModels.map(model => (
                    <Button
                      key={model}
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedModel(model)}
                      className={`justify-start text-xs rounded-lg ${selectedModel === model ? 'bg-primary/10 text-primary hover:bg-primary/20' : ''}`}
                      title={model}
                    >
                      <span className="truncate">{model}</span>
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-xl text-xs gap-1.5 text-muted-foreground"
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            >
              <Filter className={`h-3.5 w-3.5 transition-transform ${sortOrder === 'asc' ? 'rotate-180 text-primary' : ''}`} />
              <span className={sortOrder === 'asc' ? 'text-primary' : ''}>{sortOrder === 'desc' ? '降序' : '升序'}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`h-9 rounded-xl text-xs gap-1.5 ${isBatchMode ? 'text-primary bg-primary/10 hover:bg-primary/20' : 'text-muted-foreground'}`}
              onClick={() => {
                if (isBatchMode) {
                  exitBatchMode()
                } else {
                  setIsBatchMode(true)
                }
              }}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              {isBatchMode ? '完成' : '批量'}
            </Button>
          </div>
        </div>

        {groupedImages.map((group, groupIndex) => {
          const isLastGroup = groupIndex === lastGroupIndex
          const lastImageIndex = group.images.length - 1

          return (
            <div key={group.date} className="space-y-3">
              <div className="flex items-center gap-3 py-2">
                <div className="w-1 h-4 bg-primary rounded-full" />
                <span className="text-xs font-medium text-muted-foreground font-mono tracking-wide">
                  {group.date}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {group.images.map((img, index) => {
                  const isLastImage = isLastGroup && index === lastImageIndex
                  const isSelected = isBatchMode && selectedIds.has(img.id)
                  return (
                    <div
                      key={img.id}
                      ref={isLastImage ? lastImageElementRef : null}
                      className={`group relative aspect-square rounded-xl overflow-hidden bg-muted border cursor-zoom-in transition-colors ${
                        isSelected
                          ? 'border-primary ring-1 ring-primary/20'
                          : 'border-transparent hover:border-primary/30'
                      }`}
                      onClick={(e) => {
                        if (isBatchMode) {
                          e.stopPropagation()
                          const next = new Set(selectedIds)
                          if (next.has(img.id)) next.delete(img.id)
                          else next.add(img.id)
                          setSelectedIds(next)
                        } else {
                          handleImageClick(img)
                        }
                      }}
                    >
                      <img
                        src={`/api/image?path=${encodeURIComponent(img.path)}`}
                        alt={img.task.prompt}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />

                      {isBatchMode && (
                        <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${selectedIds.has(img.id) ? 'bg-primary border-primary text-background' : 'bg-black/40 border-white/50 text-transparent'}`}>
                            <CheckSquare className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      )}

                      {!isBatchMode && (
                        <div className="absolute inset-x-0 top-0 p-2.5 flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm border-0"
                            onClick={(e) => { e.stopPropagation(); handleDownloadImage(img.path); }}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm border-0"
                            onClick={(e) => { e.stopPropagation(); handleFavoriteImage(img); }}
                          >
                            <Heart className={`w-3.5 h-3.5 ${img.isFavorite ? "fill-red-500 text-red-500" : ""}`} />
                          </Button>
                          <Popover open={deleteImageConfirmId === img.id} onOpenChange={(open) => setDeleteImageConfirmId(open ? img.id : null)}>
                            <PopoverTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg bg-black/50 hover:bg-red-500/80 text-white backdrop-blur-sm border-0"
                                  onClick={(e) => { e.stopPropagation(); setDeleteImageConfirmId(img.id); }}
                                >
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </Button>
                              }
                            />
                            <PopoverContent className="w-64 p-4 rounded-xl border-border" align="end" side="top" sideOffset={8} onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-col gap-3">
                                <div className="flex items-start gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                                    <AlertCircle className="w-5 h-5 text-destructive" />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <h4 className="text-sm font-semibold text-foreground">确认删除这张图片吗？</h4>
                                    <p className="text-xs text-muted-foreground">删除的图片无法找回</p>
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-2">
                                  <Button variant="outline" size="sm" className="h-8 rounded-xl px-4 text-xs" onClick={(e) => { e.stopPropagation(); setDeleteImageConfirmId(null); }}>取消</Button>
                                  <Button variant="default" size="sm" className="h-8 rounded-xl px-4 text-xs" onClick={(e) => { e.stopPropagation(); setDeleteImageConfirmId(null); handleDeleteImage(img.id); }}>确定删除</Button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {isBatchMode && (
          <div className="fixed bottom-0 left-0 lg:left-[80px] right-0 z-50 bg-card border-t border-border px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium">
              已选择 <strong className="text-primary">{selectedIds.size}</strong> 张
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="rounded-xl h-8 px-3 text-xs" onClick={handleBatchFavorite} disabled={selectedIds.size === 0}>
                <Star className="w-3.5 h-3.5 mr-1.5" /> 收藏管理
              </Button>
              <Button variant="destructive" size="sm" className="rounded-xl h-8 px-3 text-xs" onClick={handleBatchDelete} disabled={selectedIds.size === 0}>
                <TrashIcon className="w-3.5 h-3.5 mr-1.5" /> 删除
              </Button>
              <div className="w-px h-4 bg-border shrink-0 mx-1" />
              <Button variant="ghost" size="sm" className="rounded-xl h-8 px-3 text-xs text-muted-foreground hover:text-foreground" onClick={exitBatchMode}>
                取消
              </Button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!hasMore && filteredImages.length > 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <div className="w-12 h-px bg-border rounded-full mb-2" />
            <p className="text-xs">已加载全部</p>
          </div>
        )}

        {!isLoading && filteredImages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search className="w-8 h-8 mb-3 opacity-40" />
            <p className="text-sm">未找到图片</p>
          </div>
        )}

        {selectedImage && (
          <ImageDetailModal
            image={selectedImage}
            isOpen={!!selectedImage}
            onClose={() => setSelectedImage(null)}
            onDeleted={handleDeleted}
            relatedImages={relatedImages}
          />
        )}
      </div>
    </div>
  )
}
