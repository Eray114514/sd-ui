"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, TrashIcon, SaveIcon, PlusIcon, Database, Palette, HardDrive, Settings2 } from "lucide-react"
import axios from "axios"
import { toast } from "sonner"
import { DirectoryPicker } from "@/components/custom/DirectoryPicker"

export default function SettingsPage() {
    const [imageDir, setImageDir] = useState("")
    const [models, setModels] = useState<{ id: string, name: string }[]>([])
    const [styles, setStyles] = useState<{ id: string, name: string }[]>([])
    const [loras, setLoras] = useState<{ id: string, name: string }[]>([])
    const [activeLoras, setActiveLoras] = useState<string[]>([])
    const [newModel, setNewModel] = useState("")
    const [newStyle, setNewStyle] = useState("")
    const [newLora, setNewLora] = useState("")
    const [showDirPicker, setShowDirPicker] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true)
            const [settingsRes, modelsRes, stylesRes, lorasRes] = await Promise.all([
                axios.get('/api/settings'),
                axios.get('/api/models'),
                axios.get('/api/styles'),
                axios.get('/api/loras')
            ])
            setImageDir(settingsRes.data?.imageDir || "")
            try {
                setActiveLoras(JSON.parse(settingsRes.data?.activeLoras || "[]"))
            } catch {
                setActiveLoras([])
            }
            setModels(modelsRes.data || [])
            setStyles(stylesRes.data || [])
            setLoras(lorasRes.data || [])

            const defaultModel = "waiillustriousSDXL_v160.safetensors"
            const hasDefault = modelsRes.data?.some((m: { name: string }) => m.name === defaultModel)
            if (!hasDefault && modelsRes.data) {
                try {
                    await axios.post('/api/models', { name: defaultModel })
                } catch { console.error("Auto-add default model failed") }
            }
            const defaultStyles = ["Lasy", "NAI3起手-"]
            for (const style of defaultStyles) {
                const hasStyle = stylesRes.data?.some((s: { name: string }) => s.name === style)
                if (!hasStyle) {
                    try {
                        await axios.post('/api/styles', { name: style })
                        setStyles(prev => [...prev, { id: 'temp-' + style, name: style }])
                    } catch { console.error(`Auto-add style ${style} failed`) }
                }
            }
        } catch {
            toast.error("加载设置失败")
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const saveSettings = async () => {
        try {
            await axios.post('/api/settings', {
                imageDir,
                activeLoras: JSON.stringify(activeLoras)
            })
            toast.success("设置已保存")
        } catch {
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
        } catch {
            toast.error("添加模型失败")
        }
    }

    const removeModel = async (id: string) => {
        try {
            await axios.delete('/api/models', { data: { id } })
            fetchData()
            toast.success("模型已删除")
        } catch {
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
        } catch {
            toast.error("添加风格失败")
        }
    }

    const removeStyle = async (id: string) => {
        try {
            await axios.delete('/api/styles', { data: { id } })
            fetchData()
            toast.success("风格已删除")
        } catch {
            toast.error("删除风格失败")
        }
    }

    const addLora = async () => {
        if (!newLora.trim()) return
        try {
            await axios.post('/api/loras', { name: newLora })
            setNewLora("")
            fetchData()
            toast.success("LoRA已添加")
        } catch {
            toast.error("添加LoRA失败")
        }
    }

    const removeLora = async (id: string) => {
        try {
            await axios.delete('/api/loras', { data: { id } })
            // If the deleted LoRA was active, remove it from activeLoras
            const loraObj = loras.find(l => l.id === id)
            if (loraObj && activeLoras.includes(loraObj.name)) {
                const newActive = activeLoras.filter(name => name !== loraObj.name)
                setActiveLoras(newActive)
                await axios.post('/api/settings', { imageDir, activeLoras: JSON.stringify(newActive) })
            }
            fetchData()
            toast.success("LoRA已删除")
        } catch {
            toast.error("删除LoRA失败")
        }
    }

    const toggleActiveLora = async (name: string) => {
        const newActive = activeLoras.includes(name)
            ? activeLoras.filter(n => n !== name)
            : [...activeLoras, name]
        setActiveLoras(newActive)
        try {
            await axios.post('/api/settings', { imageDir, activeLoras: JSON.stringify(newActive) })
        } catch {
            toast.error("保存活动LoRA失败")
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background p-6 md:p-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background p-6 md:p-8 pb-[100px]">
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                        <Settings2 className="w-8 h-8 text-primary" />
                        系统设置
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        配置系统参数、管理模型和风格预设
                    </p>
                </div>

                <div className="grid gap-6">
                    {/* General Settings */}
                    <div className="bg-card border border-border rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                <HardDrive className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg font-semibold">存储设置</h2>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>图片保存目录（服务器端）</Label>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="relative flex-1">
                                        <Input
                                            value={imageDir}
                                            onChange={(e) => setImageDir(e.target.value)}
                                            placeholder="例如：/home/user/ai_images 或 C:\\ai_images"
                                            className="pr-20"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-1 top-1 h-7 rounded-lg text-xs"
                                            onClick={() => setShowDirPicker((v) => !v)}
                                        >
                                            浏览
                                        </Button>
                                    </div>
                                    <Button onClick={saveSettings} className="shrink-0 gap-2 w-full sm:w-auto">
                                        <SaveIcon className="w-4 h-4" />
                                        保存设置
                                    </Button>
                                </div>
                                {showDirPicker && (
                                    <div className="mt-4">
                                        <DirectoryPicker
                                            startPath={imageDir}
                                            onClose={() => setShowDirPicker(false)}
                                            onSelect={(path) => {
                                                setImageDir(path)
                                                setShowDirPicker(false)
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Model Management */}
                    <div className="bg-card border border-border rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                <Database className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg font-semibold">模型管理</h2>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>添加新模型（safetensors 文件名）</Label>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Input
                                        value={newModel}
                                        onChange={(e) => setNewModel(e.target.value)}
                                        placeholder="例如：waiillustriousSDXL_v160.safetensors"
                                        className="flex-1"
                                    />
                                    <Button onClick={addModel} variant="secondary" className="shrink-0 gap-2 w-full sm:w-auto">
                                        <PlusIcon className="w-4 h-4" />
                                        添加模型
                                    </Button>
                                </div>
                            </div>
                            <div className="mt-6">
                                <Label className="text-muted-foreground mb-3 block">已添加的模型</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {models.map(m => (
                                        <div key={m.id} className="flex justify-between items-center bg-secondary px-3 py-2.5 rounded-xl group">
                                            <span className="text-sm font-medium truncate pr-2">{m.name}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeModel(m.id)}
                                                className="h-7 w-7 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-opacity shrink-0"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Style Management */}
                    <div className="bg-card border border-border rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                <Palette className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg font-semibold">风格预设管理</h2>
                        </div>
                        <p className="text-xs text-muted-foreground mb-6">
                            注意：仅输入来自 WebUI styles.csv 的现有风格名称
                        </p>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>添加新风格</Label>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Input
                                        value={newStyle}
                                        onChange={(e) => setNewStyle(e.target.value)}
                                        placeholder="例如：Lasy 或 NAI3起手-"
                                        className="flex-1"
                                    />
                                    <Button onClick={addStyle} variant="secondary" className="shrink-0 gap-2 w-full sm:w-auto">
                                        <PlusIcon className="w-4 h-4" />
                                        添加风格
                                    </Button>
                                </div>
                            </div>
                            <div className="mt-6">
                                <Label className="text-muted-foreground mb-3 block">已添加的风格</Label>
                                <div className="flex flex-wrap gap-2">
                                    {styles.map(s => (
                                        <div key={s.id} className="flex items-center gap-1.5 bg-secondary pl-3 pr-1 py-1.5 rounded-lg group">
                                            <span className="text-sm font-medium">{s.name}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-opacity"
                                                onClick={() => removeStyle(s.id)}
                                            >
                                                <TrashIcon className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* LoRA Management */}
                    <div className="bg-card border border-border rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                <Database className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg font-semibold">LoRA 管理</h2>
                        </div>
                        <p className="text-xs text-muted-foreground mb-6">
                            添加 LoRA 标签并在下方选择启用。启用的 LoRA 将自动添加到每次生成的提示词中。
                        </p>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>添加新 LoRA（格式：&lt;lora:name:weight&gt;）</Label>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Input
                                        value={newLora}
                                        onChange={(e) => setNewLora(e.target.value)}
                                        placeholder="例如：<lora:cute_style:0.8>"
                                        className="flex-1"
                                    />
                                    <Button onClick={addLora} variant="secondary" className="shrink-0 gap-2 w-full sm:w-auto">
                                        <PlusIcon className="w-4 h-4" />
                                        添加 LoRA
                                    </Button>
                                </div>
                            </div>
                            <div className="mt-6">
                                <Label className="text-muted-foreground mb-3 block">已添加的 LoRA（点击切换启用状态）</Label>
                                <div className="flex flex-wrap gap-2">
                                    {loras.map(l => {
                                        const isActive = activeLoras.includes(l.name)
                                        return (
                                            <div
                                                key={l.id}
                                                className={`flex items-center gap-1.5 border pl-3 pr-1 py-1.5 rounded-lg group transition-colors cursor-pointer select-none ${isActive ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-secondary border-transparent hover:bg-secondary/80'}`}
                                                onClick={() => toggleActiveLora(l.name)}
                                            >
                                                <span className="text-sm font-medium">{l.name}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-opacity"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        removeLora(l.id)
                                                    }}
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
