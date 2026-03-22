"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useGenerationStore } from "@/store/generationStore"
import { getTasks } from "@/services/tasksService"
import { getProgress } from "@/services/progressService"
import { UI_CONSTANTS } from "@/constants"
import type { Task, ProgressData, ImageWithTask } from "@/types"
import { TaskCard } from "@/components/custom/TaskCard"
import { ImageDetailModal } from "@/components/custom/ImageDetailModal"

export function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([])
  const bottomSpacerHeight = useGenerationStore(state => state.bottomSpacerHeight)
  const [progressData, setProgressData] = useState<Record<string, ProgressData>>({})
  const [selectedImage, setSelectedImage] = useState<ImageWithTask | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const initialLoadRef = useRef(true)
  const tasksRef = useRef<Task[]>([])
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPageVisibleRef = useRef(true)

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

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

  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    const fetchProgress = async () => {
      if (!isPageVisibleRef.current) return
      try {
        const data = await getProgress(false)
        if (data) {
          const currentTasks = tasksRef.current
          const updated: Record<string, ProgressData> = {}
          const processingTasks = currentTasks.filter((t: Task) => t.status === 'processing')
          for (const task of processingTasks) {
            updated[task.id] = {
              progress: data.progress || 0,
              current_image: data.current_image || null
            }
          }
          if (Object.keys(updated).length > 0) {
            setProgressData(prev => ({ ...prev, ...updated }))
          }
        }
      } catch {
        // ignore errors during polling
      }
    }

    const hasProcessing = tasksRef.current.some((t: Task) => t.status === 'processing')
    if (hasProcessing && !progressIntervalRef.current) {
      fetchProgress()
      progressIntervalRef.current = setInterval(fetchProgress, UI_CONSTANTS.POLLING.PROGRESS_INTERVAL)
    } else if (!hasProcessing && progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
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
      if (!isPageVisibleRef.current) return
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
    fetchIntervalRef.current = setInterval(fetchTasks, UI_CONSTANTS.POLLING.TASKS_INTERVAL)
    window.addEventListener('task-created', handleTaskCreated)

    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current)
        fetchIntervalRef.current = null
      }
      window.removeEventListener('task-created', handleTaskCreated)
    }
  }, [])

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
            progressData={progressData[task.id]}
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