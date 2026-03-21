"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Menu, TrashIcon } from "lucide-react"
import axios from "axios"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DirectoryPicker } from "@/components/custom/DirectoryPicker"

export function SettingsDialog() {
    const [imageDir, setImageDir] = useState("")
    const [models, setModels] = useState<{ id: string, name: string }[]>([])
    const [styles, setStyles] = useState<{ id: string, name: string }[]>([])
    const [newModel, setNewModel] = useState("")
    const [newStyle, setNewStyle] = useState("")
    const [open, setOpen] = useState(false)
    const [showDirPicker, setShowDirPicker] = useState(false)

    const fetchData = async () => {
        try {
            const [settingsRes, modelsRes, stylesRes] = await Promise.all([
                axios.get('/api/settings'),
                axios.get('/api/models'),
                axios.get('/api/styles')
            ])
            setImageDir(settingsRes.data?.imageDir || "")
            setModels(modelsRes.data || [])
            setStyles(stylesRes.data || [])

            // Ensure default model exists
            const defaultModel = "waiillustriousSDXL_v160.safetensors"
            const hasDefault = modelsRes.data?.some((m: any) => m.name === defaultModel)
            if (!hasDefault && modelsRes.data) {
                // Auto-add default model if missing
                try {
                    await axios.post('/api/models', { name: defaultModel })
                    // Don't modify state directly here to avoid potential race/dup, let next fetch handle it or simple optimistic
                } catch (e) { console.error("Auto-add default model failed") }
            }
            // Ensure default styles exist
            const defaultStyles = ["Lasy", "NAI3起手-"]
            for (const style of defaultStyles) {
                const hasStyle = stylesRes.data?.some((s: any) => s.name === style)
                if (!hasStyle) {
                    try {
                        await axios.post('/api/styles', { name: style })
                        setStyles(prev => [...prev, { id: 'temp-' + style, name: style }])
                    } catch (e) { console.error(`Auto-add style ${style} failed`) }
                }
            }
        } catch (e) {
            console.error("Failed to load settings", e)
        }
    }

    useEffect(() => {
        if (open) {
            fetchData()
        } else {
            setShowDirPicker(false)
        }
    }, [open])

    const saveSettings = async () => {
        try {
            await axios.post('/api/settings', { imageDir })
            toast.success("设置已保存")
        } catch (e) {
            toast.error("保存设置失败")
        }
    }

    const addModel = async () => {
        if (!newModel.trim()) return
        try {
            await axios.post('/api/models', { name: newModel })
            setNewModel("")
            fetchData()
            toast.success("模型已添加")
        } catch (e) {
            toast.error("添加模型失败")
        }
    }

    const removeModel = async (id: string) => {
        try {
            await axios.delete('/api/models', { data: { id } })
            fetchData()
            toast.success("模型已删除")
        } catch (e) {
            toast.error("删除模型失败")
        }
    }

    const addStyle = async () => {
        if (!newStyle.trim()) return
        try {
            await axios.post('/api/styles', { name: newStyle })
            setNewStyle("")
            fetchData()
            toast.success("风格已添加")
        } catch (e) {
            toast.error("添加风格失败")
        }
    }

    const removeStyle = async (id: string) => {
        try {
            await axios.delete('/api/styles', { data: { id } })
            fetchData()
            toast.success("风格已删除")
        } catch (e) {
            toast.error("删除风格失败")
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    <button className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors p-2" title="系统设置" type="button">
                        <Menu className="w-6 h-6" />
                    </button>
                }
            />
            <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>系统设置</DialogTitle>
                </DialogHeader>

                <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-6 pb-6">
                        <div className="space-y-2">
                            <Label>图片保存目录（服务器端）</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={imageDir}
                                    onChange={(e) => setImageDir(e.target.value)}
                                    placeholder="例如：/home/user/ai_images 或 C:\\ai_images"
                                />
                                <Button variant="outline" onClick={() => setShowDirPicker((v) => !v)}>
                                    浏览
                                </Button>
                                <Button onClick={saveSettings}>保存</Button>
                            </div>
                            {showDirPicker && (
                                <DirectoryPicker
                                    startPath={imageDir}
                                    onClose={() => setShowDirPicker(false)}
                                    onSelect={(path) => {
                                        setImageDir(path)
                                        setShowDirPicker(false)
                                    }}
                                />
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>模型管理（safetensors 文件名）</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={newModel}
                                    onChange={(e) => setNewModel(e.target.value)}
                                    placeholder="例如：waiillustriousSDXL_v160.safetensors"
                                />
                                <Button onClick={addModel}>添加</Button>
                            </div>
                            <div className="mt-2 space-y-2">
                                {models.map(m => (
                                    <div key={m.id} className="flex justify-between items-center bg-muted p-2 rounded-md">
                                        <span className="text-sm">{m.name}</span>
                                        <Button variant="ghost" size="icon" onClick={() => removeModel(m.id)}>
                                            <TrashIcon className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>风格 / 预设管理</Label>
                            <p className="text-xs text-muted-foreground mb-2">
                                注意：仅输入来自 WebUI styles.csv 的现有风格名称
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    value={newStyle}
                                    onChange={(e) => setNewStyle(e.target.value)}
                                    placeholder="例如：Lasy 或 NAI3起手-"
                                />
                                <Button onClick={addStyle}>添加</Button>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {styles.map(s => (
                                    <div key={s.id} className="flex items-center gap-1 bg-muted px-3 py-1 rounded-full text-sm">
                                        {s.name}
                                        <Button variant="ghost" size="icon" className="h-4 w-4 ml-1" onClick={() => removeStyle(s.id)}>
                                            <TrashIcon className="w-3 h-3 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
