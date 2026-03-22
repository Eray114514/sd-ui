import axios from 'axios'

const apiClient = axios.create({
  timeout: 0,
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
})

apiClient.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('[API] Request error:', error)
    return Promise.reject(error)
  }
)

apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API] ${response.config.url} - ${response.status}`)
    return response
  },
  (error) => {
    console.error('[API] Response error:', {
      url: error.config?.url,
      code: error.code,
      message: error.message,
      status: error.response?.status,
    })
    return Promise.reject(error)
  }
)

export default apiClient
