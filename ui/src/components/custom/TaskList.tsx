"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useGenerationStore } from "@/store/generationStore"
import { getTasks, clearTasksCache } from "@/services/tasksService"
import { getProgress } from "@/services/progressService"
import { UI_CONSTANTS } from "@/constants"
import { tasksPollingManager, progressPollingManager } from "@/lib/pollingManager"
import type { Task, ProgressData, ImageWithTask } from "@/types"
import { TaskCard } from "@/components/custom/TaskCard"
import { ImageDetailModal } from "@/components/custom/ImageDetailModal"

interface TaskListProps {
  initialTasks: Task[]
}

const LOCAL_STORAGE_KEY = 'tasks_cache'

export function TaskList({ initialTasks }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  
  useEffect(() => {
    try {
      const storedData = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (storedData) {
        const { tasks, timestamp } = JSON.parse(storedData)
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          setTasks(tasks)
        }
      }
    } catch (error) {
      console.error('Error reading from localStorage:', error)
    }
  }, [])
  const bottomSpacerHeight = useGenerationStore(state => state.bottomSpacerHeight)
  const [selectedImage, setSelectedImage] = useState<ImageWithTask | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const initialLoadRef = useRef(true)
  const shouldScrollRef = useRef(false)
  const progressDataRef = useRef<Record<string, ProgressData>>({})
  const [progressDataSnapshot, setProgressDataSnapshot] = useState<Record<string, ProgressData>>({})
  const rafIdRef = useRef<number | null>(null)
  const lastUpdateRef = useRef<number>(0)
  const isScrolledToBottomRef = useRef(true)

  const updateProgressSnapshot = useCallback(() => {
    const now = Date.now()
    if (now - lastUpdateRef.current >= UI_CONSTANTS.PROGRESS.RAF_THROTTLE) {
      lastUpdateRef.current = now
      setProgressDataSnapshot({ ...progressDataRef.current })
    }
  }, [])

  const scheduleProgressUpdate = useCallback(() => {
    if (rafIdRef.current !== null) return
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      updateProgressSnapshot()
    })
  }, [updateProgressSnapshot])

  useEffect(() => {
    if (tasks.length > 0) {
      if (initialLoadRef.current) {
        // 初始加载：立即滚动到底部，并多次重试以应对图片加载带来的高度变化
        initialLoadRef.current = false
        let attempts = 0
        const interval = setInterval(() => {
          window.scrollTo(0, document.documentElement.scrollHeight)
          attempts++
          if (attempts >= 10) clearInterval(interval) // 重试 1 秒
        }, 100)
        return () => clearInterval(interval)
      } else if (shouldScrollRef.current && bottomRef.current) {
        // 仅在用户手动创建任务时自动下滚，轮询刷新不触发
        bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
        shouldScrollRef.current = false
      }
    }
  }, [tasks.length])

  // 监听滚动状态以及高度变化，始终将页面保持在底部（如果已经在底部）
  useEffect(() => {
    const handleScroll = () => {
      const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100
      isScrolledToBottomRef.current = isAtBottom
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // 初始化检查一次
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const scrollToBottomIfNeeded = () => {
      if (isScrolledToBottomRef.current) {
        window.scrollTo(0, document.documentElement.scrollHeight)
      }
    }

    const observer = new ResizeObserver(scrollToBottomIfNeeded)
    observer.observe(document.documentElement)
    window.addEventListener('resize', scrollToBottomIfNeeded)
    
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', scrollToBottomIfNeeded)
    }
  }, [])

  const handleTasksChange = useCallback(() => {
    getTasks().then(setTasks).catch(console.error)
  }, [])

  const handleDeleted = useCallback((id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.images) {
        return { ...t, images: t.images.filter((img) => img.id !== id) }
      }
      return t
    }))

    setSelectedImage((prev: ImageWithTask | null) => {
      if (prev && prev.id === id) {
        return null
      }
      if (prev && prev.task?.images) {
        const newImages = prev.task.images.filter((img) => img.id !== id)
        return { ...prev, task: { ...prev.task, images: newImages } }
      }
      return prev
    })
  }, [])

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        // 轮询时清除缓存，确保获取最新数据
        clearTasksCache()
        const data = await getTasks()
        setTasks(data)
      } catch (e) {
        console.error('Failed to fetch tasks:', e)
      }
    }

    const handleTaskCreated = () => {
      shouldScrollRef.current = true // 用户创建任务时标记需要自动下滚
      fetchTasks()
    }

    tasksPollingManager.start(handleTaskCreated)
    window.addEventListener('task-created', handleTaskCreated)

    return () => {
      tasksPollingManager.stop()
      window.removeEventListener('task-created', handleTaskCreated)
    }
  }, [])

  useEffect(() => {
    const fetchProgress = async () => {
      const hasProcessing = tasks.some((t: Task) => t.status === 'processing')
      if (!hasProcessing) {
        progressPollingManager.stop()
        return
      }

      try {
        const data = await getProgress(false)
        if (data) {
          const updated: Record<string, ProgressData> = {}
          const processingTasks = tasks.filter((t: Task) => t.status === 'processing')
          for (const task of processingTasks) {
            updated[task.id] = {
              progress: data.progress || 0,
              current_image: data.current_image || null
            }
          }
          if (Object.keys(updated).length > 0) {
            Object.assign(progressDataRef.current, updated)
            scheduleProgressUpdate()
          }
        }
      } catch {
        // ignore errors during polling
      }
    }

    progressPollingManager.start(fetchProgress)

    return () => {
      progressPollingManager.stop()
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [tasks, scheduleProgressUpdate])

  return (
    <>
      <div className="w-full px-4 pt-6 pb-[20px] flex flex-col items-center">
      <div className="w-full max-w-4xl flex flex-col gap-8">
        {tasks.length === 0 && <p className="text-muted-foreground text-center mt-20">暂无生成记录，开始你的创作吧</p>}

        {selectedImage && (
          <ImageDetailModal
            image={selectedImage}
            isOpen={!!selectedImage}
            onClose={() => setSelectedImage(null)}
            onDeleted={handleDeleted}
            relatedImages={(selectedImage.task?.images || []) as ImageWithTask[]}
          />
        )}
        <div className="flex flex-col gap-10">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              progressData={progressDataSnapshot[task.id]}
              selectedImage={selectedImage}
              setSelectedImage={setSelectedImage}
              onDeleted={handleDeleted}
              onTasksChange={handleTasksChange}
            />
          ))}
          <div id="bottom-spacer" style={{ height: `${bottomSpacerHeight}px` }} />
          <div ref={bottomRef} className="h-px w-full" />
        </div>
      </div>
    </div>
    </>
  )
}
