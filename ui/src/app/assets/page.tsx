"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import axios from "axios"
import { ImageDetailModal } from "@/components/custom/ImageDetailModal"
import { Loader2, Search, Filter, Clock, Heart, Download, TrashIcon, AlertCircle, Star, CheckSquare } from "lucide-react"
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
    if (!confirm("确定要删除这张图片吗？")) return
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

  const filteredImages = useMemo(() =>
    images.filter(img => {
      // For "images" tab, we just show all images (since we don't have video)
      const matchesTab = activeTab === "favorites" ? img.isFavorite : true
      const matchesSearch = img.task.prompt.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesTab && matchesSearch
    }),
    [images, activeTab, searchQuery]
  )

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

  return (
    <div className="min-h-screen bg-background p-6 md:p-8 pb-[400px]">

      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-30 bg-background/80 backdrop-blur-md py-4 -mx-2 px-2 border-b border-border/50 transition-all">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center bg-muted/30 rounded-full border border-border/50 p-1">
              <Tabs value={activeTab === 'favorites' ? 'all' : activeTab} onValueChange={(v) => setActiveTab(v)}>
                <TabsList className="bg-transparent h-8">
                  <TabsTrigger value="all" className="rounded-full px-4 text-xs data-[state=active]:bg-foreground data-[state=active]:text-background transition-colors">全部</TabsTrigger>
                  <TabsTrigger value="images" className="rounded-full px-4 text-xs data-[state=active]:bg-foreground data-[state=active]:text-background transition-colors">图片</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className={`rounded-full h-10 px-4 flex items-center gap-2 text-xs transition-colors bg-muted/30 border border-border/50 hover:bg-muted ${activeTab === 'favorites' ? 'bg-foreground text-background hover:bg-foreground/90' : 'text-muted-foreground'}`}
              onClick={() => setActiveTab(activeTab === 'favorites' ? 'all' : 'favorites')}
            >
              <Star className={`h-4 w-4 ${activeTab === 'favorites' ? 'fill-background' : ''}`} />
              收藏
            </Button>
          </div>

          <div className="flex items-center bg-muted/30 border border-border/50 rounded-full h-10 overflow-hidden w-full md:w-auto">
            <div 
              className={`flex items-center transition-all duration-300 ease-in-out ${isSearchExpanded || searchQuery ? 'w-48 pl-3' : 'w-20 pl-0 cursor-pointer hover:bg-muted/50'}`}
              onClick={() => {
                if (!isSearchExpanded && !searchQuery) {
                  setIsSearchExpanded(true)
                  setTimeout(() => searchInputRef.current?.focus(), 100)
                }
              }}
            >
              <div className="flex items-center justify-center w-full h-full text-muted-foreground" style={{ display: isSearchExpanded || searchQuery ? 'none' : 'flex' }}>
                <Search className="h-4 w-4 mr-1.5" />
                <span className="text-xs font-medium">搜索</span>
              </div>
              <div className="relative w-full h-full flex items-center" style={{ display: isSearchExpanded || searchQuery ? 'flex' : 'none' }}>
                <Search className="absolute left-0 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="search"
                  placeholder="搜索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => {
                    if (!searchQuery) setIsSearchExpanded(false)
                  }}
                  className="w-full h-full pl-6 pr-3 bg-transparent border-0 ring-0 focus-visible:ring-0 text-xs shadow-none"
                />
              </div>
            </div>

            <div className="w-px h-4 bg-border/50 shrink-0" />

            <Button variant="ghost" size="sm" className="h-full rounded-none px-4 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              模型
            </Button>

            <div className="w-px h-4 bg-border/50 shrink-0" />

            <Button variant="ghost" size="sm" className="h-full rounded-none px-4 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              时间
            </Button>

            <div className="w-px h-4 bg-border/50 shrink-0" />

            <Button variant="ghost" size="sm" className="h-full rounded-none px-4 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground">
              <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
              批量
            </Button>
          </div>
        </div>

        {groupedImages.map((group, groupIndex) => {
          const isLastGroup = groupIndex === lastGroupIndex
          const lastImageIndex = group.images.length - 1

          return (
            <div key={group.date} className="space-y-4">
              <div className="flex items-center gap-3 py-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                <span className="text-sm font-medium text-muted-foreground bg-background px-3 py-1 rounded-full border border-border/50">
                  {group.date}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {group.images.map((img, index) => {
                  const isLastImage = isLastGroup && index === lastImageIndex
                  return (
                    <div
                      key={img.id}
                      ref={isLastImage ? lastImageElementRef : null}
                      className="group relative aspect-square rounded-2xl overflow-hidden bg-muted cursor-zoom-in border border-transparent hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/10 z-0"
                      onClick={() => handleImageClick(img)}
                    >
                      <img
                        src={`/api/image?path=${encodeURIComponent(img.path)}`}
                        alt={img.task.prompt}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />

                      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-start p-3 z-10 pointer-events-none">
                        <div className="flex justify-end gap-2 pointer-events-auto">
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 text-white border-0 backdrop-blur-md hover:scale-110 transition-all duration-150 active:scale-95"
                            onClick={(e) => { e.stopPropagation(); handleDownloadImage(img.path); }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 text-white border-0 backdrop-blur-md hover:scale-110 transition-all duration-150 active:scale-95"
                            onClick={(e) => { e.stopPropagation(); handleFavoriteImage(img); }}
                          >
                            <Heart className={`w-4 h-4 ${img.isFavorite ? "fill-red-500 text-red-500" : ""}`} />
                          </Button>
                          <Popover open={deleteImageConfirmId === img.id} onOpenChange={(open) => setDeleteImageConfirmId(open ? img.id : null)}>
                            <PopoverTrigger
                              render={
                                <button
                                  type="button"
                                  className="h-9 w-9 rounded-full bg-black/40 hover:bg-red-500/80 text-white border-0 backdrop-blur-md hover:scale-110 transition-all duration-150 active:scale-95 flex items-center justify-center"
                                  onClick={(e) => { e.stopPropagation(); setDeleteImageConfirmId(img.id); }}
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              }
                            />
                            <PopoverContent className="w-64 p-4 rounded-2xl shadow-xl border-border/50" align="end" side="top" sideOffset={8} onClick={(e) => e.stopPropagation()}>
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
                                  <Button variant="outline" size="sm" className="h-8 rounded-full px-4 text-xs font-medium" onClick={(e) => { e.stopPropagation(); setDeleteImageConfirmId(null); }}>取消</Button>
                                  <Button variant="default" size="sm" className="h-8 rounded-full px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium" onClick={(e) => { e.stopPropagation(); setDeleteImageConfirmId(null); handleDeleteImage(img.id); }}>确定删除</Button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-4 z-10 pointer-events-none">
                        <div>
                          <p className="text-white text-xs line-clamp-2 font-medium mb-2 opacity-90">
                            {img.task.prompt}
                          </p>
                          <div className="flex items-center justify-between text-white/80">
                            <span className="text-[10px] bg-white/10 px-2 py-1 rounded-full backdrop-blur-sm">
                              {new Date(img.createdAt).toLocaleTimeString()}
                            </span>
                            {img.isFavorite && <Heart className="w-4 h-4 text-red-500 fill-red-500" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {!hasMore && filteredImages.length > 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <div className="w-12 h-1 bg-border rounded-full mb-2" />
            <p className="text-sm">已经到底啦</p>
          </div>
        )}

        {!isLoading && filteredImages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 opacity-50" />
            </div>
            <p>没有找到相关图片</p>
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
