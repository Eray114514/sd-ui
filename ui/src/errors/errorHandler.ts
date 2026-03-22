import { type ParsedErrorDetails } from '@/types'

export function parseError(errorStr: string): ParsedErrorDetails | null {
  try {
    const parsed = JSON.parse(errorStr)
    if (parsed.message && parsed.errorDetails) {
      return parsed as ParsedErrorDetails
    }
  } catch {
    return null
  }
  return null
}

export function formatErrorForDisplay(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>
    if (err.message && typeof err.message === 'string') {
      return err.message
    }
  }
  return 'Unknown error'
}

export function getHttpErrorMessage(status?: number, defaultMessage?: string): string {
  const messages: Record<number, string> = {
    400: '请求参数错误',
    401: '未授权',
    403: '禁止访问',
    404: '资源不存在',
    500: '服务器内部错误',
    502: 'SD WebUI 服务暂时不可用 (502)。可能原因：1) SD WebUI正在生成其他图片 2) 服务重启中 3) 网络连接中断',
    503: 'SD WebUI 服务繁忙，请稍后重试',
  }

  if (status && messages[status]) {
    return messages[status]
  }

  if (status === 502) {
    return messages[502]
  }
  if (status === 503) {
    return messages[503]
  }

  return defaultMessage || '操作失败'
}

export function getNetworkErrorMessage(code?: string): string | null {
  const messages: Record<string, string> = {
    ECONNREFUSED: '无法连接到 SD WebUI 服务，请检查服务是否已启动',
    ETIMEDOUT: '连接 SD WebUI 超时，可能是生成时间过长或服务无响应',
    ECONNABORTED: '连接 SD WebUI 超时，可能是生成时间过长或服务无响应',
    ECONNRESET: '连接被重置，可能是 SD WebUI 服务重启或网络不稳定',
  }

  return code ? messages[code] || null : null
}
