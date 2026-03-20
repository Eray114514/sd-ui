import { NextResponse } from 'next/server'
import axios from 'axios'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const skip_current_image = searchParams.get('skip_current_image') === 'true'
        
        // Match the hardcoded IP from queue.ts
        const base_url = "http://192.168.2.200:7860"
        
        const response = await axios.get(`${base_url}/sdapi/v1/progress`, {
            params: {
                skip_current_image
            },
            timeout: 5000
        })

        return NextResponse.json(response.data)
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
