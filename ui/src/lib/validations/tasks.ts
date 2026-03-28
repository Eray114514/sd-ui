import { z } from 'zod'

const deleteTaskSchema = z.object({
    id: z.string().min(1, 'Task ID is required'),
})

export { deleteTaskSchema }
