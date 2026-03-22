"use client"

import { useCallback, useEffect, useState } from "react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FolderIcon, ArrowUpIcon, RefreshCwIcon, CheckIcon, XIcon } from "lucide-react"

type FsEntry = {
  name: string
  path: string
  type: "dir"
}

type FsResponse = {
  current: string | null
  parent: string | null
  entries: FsEntry[]
}

type DirectoryPickerProps = {
  startPath?: string
  onSelect: (path: string) => void
  onClose: () => void
}

export function DirectoryPicker({ startPath, onSelect, onClose }: DirectoryPickerProps) {
  const [current, setCurrent] = useState<string | null>(null)
  const [parent, setParent] = useState<string | null>(null)
  const [entries, setEntries] = useState<FsEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (target?: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await axios.get<FsResponse>("/api/fs", {
        params: target ? { path: target } : {},
      })
      setCurrent(res.data.current ?? null)
      setParent(res.data.parent ?? null)
      setEntries(res.data.entries ?? [])
    } catch {
      setError("Failed to load directory list.")
      if (target) {
        try {
          const res = await axios.get<FsResponse>("/api/fs")
          setCurrent(res.data.current ?? null)
          setParent(res.data.parent ?? null)
          setEntries(res.data.entries ?? [])
        } catch {
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(startPath || undefined)
  }, [startPath, load])

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground truncate">
          {current || "计算机"}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!parent || loading}
            onClick={() => parent && load(parent)}
            title="上一级"
          >
            <ArrowUpIcon className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={loading}
            onClick={() => load(current || undefined)}
            title="刷新"
          >
            <RefreshCwIcon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onClose} title="关闭">
            <XIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3">
        <ScrollArea className="h-56 pr-2">
          {error && (
            <div className="text-xs text-destructive mb-2">{error}</div>
          )}
          {entries.length === 0 && !loading && (
            <div className="text-xs text-muted-foreground">未找到文件夹。</div>
          )}
          <div className="space-y-1">
            {entries.map((entry) => (
              <Button
                key={entry.path}
                variant="ghost"
                className="w-full justify-start text-xs"
                onClick={() => load(entry.path)}
              >
                <FolderIcon className="w-4 h-4 mr-2 text-muted-foreground" />
                <span className="truncate">{entry.name}</span>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          取消
        </Button>
        <Button
          size="sm"
          disabled={!current}
          onClick={() => current && onSelect(current)}
        >
          <CheckIcon className="w-4 h-4 mr-2" />
          使用此文件夹
        </Button>
      </div>
    </div>
  )
}
