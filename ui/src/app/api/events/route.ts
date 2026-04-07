export const dynamic = "force-dynamic"
import { NextResponse } from 'next/server'
import { eventTracker } from '@/lib/eventTracker'

export async function GET(req: Request) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
        start(controller) {
            const sendEvent = (event: string, data: any) => {
                try {
                    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
                } catch (e) {
                    // Stream closed
                }
            }

            // Immediately tell client to sync tasks upon connection
            // This is crucial for handling sleep/restore seamlessly
            sendEvent('sync', { time: Date.now() })

            const onTasksChanged = () => sendEvent('tasks_changed', { time: Date.now() })
            const onProgress = (data: any) => sendEvent('progress', data)

            eventTracker.on('tasks_changed', onTasksChanged)
            eventTracker.on('progress', onProgress)
            
            // Trigger a check in case we connected while a task is processing
            eventTracker.notifyTasksChanged()

            // Keep connection alive and avoid proxy timeouts
            const keepAlive = setInterval(() => {
                sendEvent('ping', { time: Date.now() })
            }, 15000)

            req.signal.addEventListener('abort', () => {
                clearInterval(keepAlive)
                eventTracker.off('tasks_changed', onTasksChanged)
                eventTracker.off('progress', onProgress)
            })
        }
    })

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        }
    })
}
