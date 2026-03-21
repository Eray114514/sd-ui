import { prisma } from './db'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { getDefaultImageDir, normalizeImageDir } from "./paths"
import { SD_WEBUI_BASE_URL } from './sdConfig'
import http from 'http'
import https from 'https'

const globalForQueue = globalThis as unknown as {
    isProcessing: boolean
}

// 创建自定义 axios 实例，确保不会超时
const sdApiClient = axios.create({
    // 完全不设置 timeout，让请求永远等待
    httpAgent: new http.Agent({
        keepAlive: false,
        maxSockets: 1,
        timeout: 0, // 连接超时设为0（无限制）
    }),
    httpsAgent: new https.Agent({
        keepAlive: false,
        maxSockets: 1,
        timeout: 0,
    }),
    // 增加最大响应体大小
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
})

// 添加请求拦截器记录日志
sdApiClient.interceptors.request.use(
    (config) => {
        console.log(`[SD API] 开始请求: ${config.method?.toUpperCase()} ${config.url}`)
        return config
    },
    (error) => {
        console.error('[SD API] 请求拦截器错误:', error)
        return Promise.reject(error)
    }
)

// 添加响应拦截器记录日志
sdApiClient.interceptors.response.use(
    (response) => {
        console.log(`[SD API] 请求完成: ${response.config.url} - 状态: ${response.status}`)
        return response
    },
    (error) => {
        console.error('[SD API] 响应错误:', {
            url: error.config?.url,
            code: error.code,
            message: error.message,
            response: error.response?.status,
        })
        return Promise.reject(error)
    }
)

export async function processQueue() {
    if (globalForQueue.isProcessing) return
    globalForQueue.isProcessing = true

    try {
        while (true) {
            const task = await prisma.task.findFirst({
                where: { status: 'pending' },
                orderBy: { createdAt: 'asc' },
            })

            if (!task) {
                break // No more tasks
            }

            console.log(`[Queue] 开始处理任务: ${task.id}`)
            const startTime = Date.now()

            await prisma.task.update({
                where: { id: task.id },
                data: { status: 'processing' },
            })

            try {
                const payload = {
                    prompt: task.prompt,
                    negative_prompt: task.negative_prompt || "",
                    styles: JSON.parse(task.styles),
                    sampler_name: task.sampler_name,
                    scheduler: task.scheduler,
                    steps: task.steps,
                    cfg_scale: task.cfg_scale,
                    width: task.width,
                    height: task.height,
                    n_iter: task.n_iter,
                    batch_size: task.batch_size,
                    seed: task.seed,
                    override_settings: {
                        sd_model_checkpoint: task.model_checkpoint
                    }
                }

                console.log(`[Queue] 调用 SD API，参数: steps=${payload.steps}, width=${payload.width}, height=${payload.height}, n_iter=${payload.n_iter}`)

                const response = await sdApiClient.post(`${SD_WEBUI_BASE_URL}/sdapi/v1/txt2img`, payload)

                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
                console.log(`[Queue] SD API 调用完成，耗时: ${elapsed} 秒`)

                const images = response.data.images;
                if (!images || images.length === 0) {
                    throw new Error("No images returned from API");
                }

                console.log(`[Queue] 收到 ${images.length} 张图片`)

                const config = await prisma.systemConfig.findUnique({ where: { id: 'default' } })
                const imageDir = normalizeImageDir(config?.imageDir || getDefaultImageDir())

                if (!fs.existsSync(imageDir)) {
                    fs.mkdirSync(imageDir, { recursive: true })
                }

                const savedPaths: string[] = []
                for (let i = 0; i < images.length; i++) {
                    const filename = `${Date.now()}_${task.id}_${i}.png`
                    const filepath = path.join(imageDir, filename)
                    fs.writeFileSync(filepath, Buffer.from(images[i], 'base64'))
                    savedPaths.push(filepath)
                }

                await prisma.$transaction(async (tx) => {
                    for (const p of savedPaths) {
                        await tx.generatedImage.create({
                            data: {
                                path: p,
                                taskId: task.id
                            }
                        })
                    }
                    await tx.task.update({
                        where: { id: task.id },
                        data: { status: 'completed' },
                    })
                })

                console.log(`[Queue] 任务完成: ${task.id}`)

            } catch (error: any) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
                const status = error?.response?.status
                const data = error?.response?.data
                const url = `${SD_WEBUI_BASE_URL}/sdapi/v1/txt2img`

                let errorMessage = error.message || "Unknown error"

                if (status === 502) {
                    errorMessage = "SD WebUI 服务暂时不可用 (502)。可能原因：1) SD WebUI正在生成其他图片 2) 服务重启中 3) 网络连接中断。请稍后重试。"
                } else if (status === 503) {
                    errorMessage = "SD WebUI 服务繁忙 (503)，请稍后重试。"
                } else if (error.code === 'ECONNREFUSED') {
                    errorMessage = "无法连接到 SD WebUI 服务，请检查服务是否已启动。"
                } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
                    errorMessage = "连接 SD WebUI 超时，可能是生成时间过长或服务无响应。"
                } else if (error.code === 'ECONNRESET') {
                    errorMessage = "连接被重置，可能是 SD WebUI 服务重启或网络不稳定。"
                }

                const detailedError = {
                    message: errorMessage,
                    timestamp: new Date().toISOString(),
                    elapsedTime: `${elapsed}秒`,
                    requestInfo: {
                        url: url,
                        method: 'POST',
                    },
                    errorDetails: {
                        code: error.code || 'N/A',
                        status: status || 'N/A',
                        responseData: data || 'N/A',
                        stack: error.stack || 'N/A'
                    }
                }

                const errorJson = JSON.stringify(detailedError, null, 2)

                console.error(`[Queue] 任务失败: ${task.id}, 耗时: ${elapsed} 秒`, {
                    url,
                    status,
                    code: error.code,
                    message: error?.message,
                    data,
                    stack: error.stack
                })

                await prisma.task.update({
                    where: { id: task.id },
                    data: { status: 'failed', error: errorJson },
                })
            }
        }
    } finally {
        globalForQueue.isProcessing = false
    }
}
