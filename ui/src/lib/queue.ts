import { prisma } from './db'
import axios, { AxiosError } from 'axios'
import fs from 'fs/promises'
import path from 'path'
import { getDefaultImageDir, normalizeImageDir } from "./paths"
import { SD_WEBUI_BASE_URL } from './sdConfig'
import { SDApiError } from '@/errors'
import { createLogger } from './logger'
import http from 'http'
import https from 'https'

const logger = createLogger('queue')

const MAX_RETRIES = 2

const globalForQueue = globalThis as unknown as {
    isProcessing: boolean
}

const sdApiClient = axios.create({
    httpAgent: new http.Agent({
        keepAlive: false,
        maxSockets: 1,
        timeout: 0,
    }),
    httpsAgent: new https.Agent({
        keepAlive: false,
        maxSockets: 1,
        timeout: 0,
    }),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
})

sdApiClient.interceptors.request.use(
    (config) => {
        logger.debug({ method: config.method?.toUpperCase(), url: config.url }, 'SD API request')
        return config
    },
    (error) => {
        logger.error({ error }, 'SD API request interceptor error')
        return Promise.reject(error)
    }
)

sdApiClient.interceptors.response.use(
    (response) => {
        logger.debug({ url: response.config.url, status: response.status }, 'SD API response')
        return response
    },
    (error) => {
        logger.error({
            url: error.config?.url,
            code: error.code,
            message: error.message,
            status: error.response?.status,
        }, 'SD API response error')
        return Promise.reject(error)
    }
)

export async function processQueue() {
    if (globalForQueue.isProcessing) {
        logger.debug('Queue already processing, skipping')
        return
    }
    globalForQueue.isProcessing = true

    try {
        while (true) {
            const task = await prisma.task.findFirst({
                where: { status: 'pending' },
                orderBy: { createdAt: 'asc' },
            })

            if (!task) {
                logger.debug('No pending tasks, exiting queue processor')
                break
            }

            logger.info({ taskId: task.id }, 'Processing task')
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

                logger.debug({
                    taskId: task.id,
                    steps: payload.steps,
                    width: payload.width,
                    height: payload.height,
                    n_iter: payload.n_iter,
                }, 'Calling SD API with parameters')

                const response = await sdApiClient.post(`${SD_WEBUI_BASE_URL}/sdapi/v1/txt2img`, payload)

                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
                logger.info({ taskId: task.id, elapsed: `${elapsed}s` }, 'SD API call completed')

                const images = response.data.images;
                if (!images || images.length === 0) {
                    throw new SDApiError("No images returned from API", undefined, 'NO_IMAGES');
                }

                logger.debug({ taskId: task.id, imageCount: images.length }, 'Received images')

                const config = await prisma.systemConfig.findUnique({ where: { id: 'default' } })
                const imageDir = normalizeImageDir(config?.imageDir || getDefaultImageDir())

                try {
                    await fs.access(imageDir)
                } catch {
                    await fs.mkdir(imageDir, { recursive: true })
                    logger.debug({ imageDir }, 'Created image directory')
                }

                const savedPaths: string[] = []
                for (let i = 0; i < images.length; i++) {
                    const filename = `${Date.now()}_${task.id}_${i}.png`
                    const filepath = path.join(imageDir, filename)
                    await fs.writeFile(filepath, Buffer.from(images[i], 'base64'))
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

                logger.info({ taskId: task.id, imageCount: savedPaths.length }, 'Task completed')

            } catch (error: unknown) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
                const axiosError = error as AxiosError
                const status = axiosError.response?.status
                const data = axiosError.response?.data
                const url = `${SD_WEBUI_BASE_URL}/sdapi/v1/txt2img`

                const currentRetry = task.retryCount || 0

                if (currentRetry < MAX_RETRIES) {
                    logger.warn({
                        taskId: task.id,
                        retry: currentRetry + 1,
                        maxRetries: MAX_RETRIES,
                    }, 'Task failed, retrying')

                    await prisma.task.update({
                        where: { id: task.id },
                        data: {
                            status: 'pending',
                            retryCount: currentRetry + 1
                        },
                    })
                    continue
                }

                let errorMessage = axiosError.message || "Unknown error"

                if (status === 502) {
                    errorMessage = "SD WebUI 服务暂时不可用 (502)。可能原因：1) SD WebUI正在生成其他图片 2) 服务重启中 3) 网络连接中断。请稍后重试。"
                } else if (status === 503) {
                    errorMessage = "SD WebUI 服务繁忙 (503)，请稍后重试。"
                } else if (axiosError.code === 'ECONNREFUSED') {
                    errorMessage = "无法连接到 SD WebUI 服务，请检查服务是否已启动。"
                } else if (axiosError.code === 'ETIMEDOUT' || axiosError.code === 'ECONNABORTED') {
                    errorMessage = "连接 SD WebUI 超时，可能是生成时间过长或服务无响应。"
                } else if (axiosError.code === 'ECONNRESET') {
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
                        code: axiosError.code || 'N/A',
                        status: status || 'N/A',
                        responseData: data || 'N/A',
                        stack: axiosError.stack || 'N/A'
                    }
                }

                const errorJson = JSON.stringify(detailedError, null, 2)

                logger.error({
                    taskId: task.id,
                    elapsed: `${elapsed}s`,
                    url,
                    status,
                    code: axiosError.code,
                    message: axiosError.message,
                }, 'Task failed')

                await prisma.task.update({
                    where: { id: task.id },
                    data: { status: 'failed', error: errorJson },
                })
            }
        }
    } finally {
        globalForQueue.isProcessing = false
        logger.debug('Queue processor finished')
    }
}
