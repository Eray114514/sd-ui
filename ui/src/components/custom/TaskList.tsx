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

export function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([])
  const bottomSpacerHeight = useGenerationStore(state => state.bottomSpacerHeight)
  const [selectedImage, setSelectedImage] = useState<ImageWithTask | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const initialLoadRef = useRef(true)
  const progressDataRef = useRef<Record<string, ProgressData>>({})
  const [progressDataSnapshot, setProgressDataSnapshot] = useState<Record<string, ProgressData>>({})
  const rafIdRef = useRef<number | null>(null)
  const lastUpdateRef = useRef<number>(0)

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
    if (bottomRef.current && tasks.length > 0) {
      const scrollOptions: ScrollIntoViewOptions = initialLoadRef.current
        ? { behavior: "instant", block: "end" }
        : { behavior: "smooth", block: "end" }

      if ('scrollIntoView' in bottomRef.current) {
        bottomRef.current.scrollIntoView(scrollOptions)
      }

      initialLoadRef.current = false
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
        const taskImages = prev.task?.images || []
        const currentIndex = taskImages.findIndex((img) => img.id === id)
        const newImages = taskImages.filter((img) => img.id !== id)
        if (newImages.length > 0) {
          const nextIndex = currentIndex >= newImages.length ? newImages.length - 1 : currentIndex
          return { ...newImages[nextIndex], task: { ...prev.task, images: newImages } }
        }
        return null
      }
      return prev
    })
  }, [])

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const data = await getTasks()
        setTasks(data)
      } catch (e) {
        console.error('Failed to fetch tasks:', e)
      }
    }

    const handleTaskCreated = () => {
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
    <div className="p-4 md:p-8 w-full max-w-4xl mx-auto flex flex-col gap-8 pb-[20px]">
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
        <div ref={bottomRef} />
        <div id="bottom-spacer" style={{ height: `${bottomSpacerHeight}px` }} />
      </div>
    </div>
  )
}
