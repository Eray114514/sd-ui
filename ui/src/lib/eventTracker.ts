import { EventEmitter } from 'events'
import { prisma } from './db'
import axios from 'axios'
import { SD_WEBUI_BASE_URL } from './sdConfig'

class EventTracker extends EventEmitter {
    private isPollingProgress = false;

    constructor() {
        super();
        this.setMaxListeners(100);
    }

    notifyTasksChanged() {
        this.emit('tasks_changed');
        this.checkAndPollProgress();
    }

    private async checkAndPollProgress() {
        if (this.isPollingProgress) return;
        
        try {
            const processingCount = await prisma.task.count({ where: { status: 'processing' } });
            if (processingCount > 0) {
                this.isPollingProgress = true;
                this.pollProgressLoop();
            }
        } catch (error) {
            // ignore
        }
    }

    private async pollProgressLoop() {
        while (this.isPollingProgress) {
            try {
                const processingCount = await prisma.task.count({ where: { status: 'processing' } });
                if (processingCount === 0) {
                    this.isPollingProgress = false;
                    this.emit('progress', { progress: 0, current_image: null });
                    break;
                }

                const response = await axios.get(`${SD_WEBUI_BASE_URL}/sdapi/v1/progress?skip_current_image=true`, { timeout: 2000 });
                this.emit('progress', response.data);
            } catch (error) {
                // Ignore API errors, will retry next tick
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
}

export const eventTracker = (globalThis as any).eventTracker || new EventTracker();
if (process.env.NODE_ENV !== 'production') {
    (globalThis as any).eventTracker = eventTracker;
}
