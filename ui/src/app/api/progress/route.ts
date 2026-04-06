export const dynamic = "force-dynamic"
import { NextResponse } from 'next/server'
import axios from 'axios'
import { SD_WEBUI_BASE_URL } from '@/lib/sdConfig'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const skip_current_image = searchParams.get('skip_current_image') === 'true'

        const response = await axios.get(`${SD_WEBUI_BASE_URL}/sdapi/v1/progress`, {
            params: {
                skip_current_image
            },
            timeout: 5000
        })

        return NextResponse.json(response.data)
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
}
