"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useGenerationStore } from "@/store/generationStore"
import { getTasks } from "@/services/tasksService"
import { getProgress } from "@/services/progressService"
import { UI_CONSTANTS } from "@/constants"
import { tasksPollingManager, progressPollingManager } from "@/lib/pollingManager"
import type { Task, ProgressData, ImageWithTask } from "@/types"
import { TaskCard } from "@/components/custom/TaskCard"
import { ImageDetailModal } from "@/components/custom/ImageDetailModal"
import { Loader2 } from "lucide-react"

export function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([])
  const bottomSpacerHeight = useGenerationStore(state => state.bottomSpacerHeight)
  const [selectedImage, setSelectedImage] = useState<ImageWithTask | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const initialLoadRef = useRef(true)
  const shouldScrollRef = useRef(false)
  const progressDataRef = useRef<Record<string, ProgressData>>({})
  const [progressDataSnapshot, setProgressDataSnapshot] = useState<Record<string, ProgressData>>({})
  const rafIdRef = useRef<number | null>(null)
  const lastUpdateRef = useRef<number>(0)
  const [isInitialLoaded, setIsInitialLoaded] = useState(false)

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
        // 初始加载：滚动到绝对底部
        requestAnimationFrame(() => {
          window.scrollTo(0, document.documentElement.scrollHeight)
          setTimeout(() => setIsInitialLoaded(true), 50)
        })
        initialLoadRef.current = false
      } else if (shouldScrollRef.current && bottomRef.current) {
        // 仅在用户手动创建任务时自动下滚，轮询刷新不触发
        bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
        shouldScrollRef.current = false
      }
    } else if (tasks.length === 0 && !initialLoadRef.current) {
      queueMicrotask(() => setIsInitialLoaded(true))
    }
  }, [tasks.length])

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
        const data = await getTasks()
        setTasks(data)
        if (data.length === 0) setIsInitialLoaded(true)
      } catch (e) {
        console.error('Failed to fetch tasks:', e)
        setIsInitialLoaded(true)
      }
    }

    const handleTaskCreated = () => {
      shouldScrollRef.current = true // 用户创建任务时标记需要自动下滚
      fetchTasks()
    }

    fetchTasks()

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
      {!isInitialLoaded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background h-[100dvh]">
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">正在加载生成记录...</p>
          </div>
        </div>
      )}
      <div className={`w-full px-4 pt-6 pb-[20px] flex flex-col items-center transition-opacity duration-300 ${isInitialLoaded ? 'opacity-100' : 'opacity-0'}`}>
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
