"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TrashIcon, SaveIcon, PlusIcon, Database, Palette, HardDrive, Settings2 } from "lucide-react"
import axios from "axios"
import { toast } from "sonner"
import { DirectoryPicker } from "@/components/custom/DirectoryPicker"

export default function SettingsPage() {
    const [imageDir, setImageDir] = useState("")
    const [models, setModels] = useState<{ id: string, name: string }[]>([])
    const [styles, setStyles] = useState<{ id: string, name: string }[]>([])
    const [newModel, setNewModel] = useState("")
    const [newStyle, setNewStyle] = useState("")
    const [showDirPicker, setShowDirPicker] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true)
            const [settingsRes, modelsRes, stylesRes] = await Promise.all([
                axios.get('/api/settings'),
                axios.get('/api/models'),
                axios.get('/api/styles')
            ])
            setImageDir(settingsRes.data?.imageDir || "")
            setModels(modelsRes.data || [])
            setStyles(stylesRes.data || [])

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
            await axios.post('/api/settings', { imageDir })
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

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background p-6 md:p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background p-6 md:p-8 pb-32">
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500 flex items-center gap-3">
                        <Settings2 className="w-8 h-8 text-primary" />
                        系统设置
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        配置系统参数、管理模型和风格预设
                    </p>
                </div>

                <div className="grid gap-6">
                    {/* General Settings */}
                    <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                                <HardDrive className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-semibold">存储设置</h2>
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
                                            className="pr-20 rounded-xl bg-secondary/30 border-border/50"
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
                                    <Button onClick={saveSettings} className="rounded-xl shrink-0 gap-2 w-full sm:w-auto">
                                        <SaveIcon className="w-4 h-4" />
                                        保存设置
                                    </Button>
                                </div>
                                {showDirPicker && (
                                    <div className="mt-4 p-4 border border-border/50 rounded-2xl bg-secondary/20">
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
                    <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500">
                                <Database className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-semibold">模型管理</h2>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>添加新模型（safetensors 文件名）</Label>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Input
                                        value={newModel}
                                        onChange={(e) => setNewModel(e.target.value)}
                                        placeholder="例如：waiillustriousSDXL_v160.safetensors"
                                        className="flex-1 rounded-xl bg-secondary/30 border-border/50"
                                    />
                                    <Button onClick={addModel} variant="secondary" className="rounded-xl shrink-0 gap-2 w-full sm:w-auto hover:bg-primary hover:text-primary-foreground transition-colors">
                                        <PlusIcon className="w-4 h-4" />
                                        添加模型
                                    </Button>
                                </div>
                            </div>
                            <div className="mt-6">
                                <Label className="text-muted-foreground mb-3 block">已添加的模型</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {models.map(m => (
                                        <div key={m.id} className="flex justify-between items-center bg-secondary/40 border border-border/50 p-3 rounded-2xl group hover:bg-secondary/60 transition-colors">
                                            <span className="text-sm font-medium truncate pr-2">{m.name}</span>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => removeModel(m.id)}
                                                className="h-8 w-8 rounded-full text-muted-foreground opacity-50 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
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
                    <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-pink-500/10 rounded-xl text-pink-500">
                                <Palette className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-semibold">风格预设管理</h2>
                        </div>
                        <p className="text-sm text-muted-foreground mb-6">
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
                                        className="flex-1 rounded-xl bg-secondary/30 border-border/50"
                                    />
                                    <Button onClick={addStyle} variant="secondary" className="rounded-xl shrink-0 gap-2 w-full sm:w-auto hover:bg-primary hover:text-primary-foreground transition-colors">
                                        <PlusIcon className="w-4 h-4" />
                                        添加风格
                                    </Button>
                                </div>
                            </div>
                            <div className="mt-6">
                                <Label className="text-muted-foreground mb-3 block">已添加的风格</Label>
                                <div className="flex flex-wrap gap-2">
                                    {styles.map(s => (
                                        <div key={s.id} className="flex items-center gap-2 bg-secondary/40 border border-border/50 pl-3 pr-1.5 py-1.5 rounded-full group hover:bg-secondary/60 transition-colors">
                                            <span className="text-sm font-medium">{s.name}</span>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-6 w-6 rounded-full text-muted-foreground opacity-50 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all" 
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

                </div>
            </div>
        </div>
    )
}