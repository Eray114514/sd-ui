import pino from 'pino'
import { env } from './env'

const isDevelopment = env.NODE_ENV === 'development'

const transport = isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
        },
    }
    : undefined

export const logger = pino({
    level: env.LOG_LEVEL,
    transport,
    base: {
        env: env.NODE_ENV,
    },
})

export const createLogger = (context: string) => logger.child({ context })

export type Logger = typeof logger
