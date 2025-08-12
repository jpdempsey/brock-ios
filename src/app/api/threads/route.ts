import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'
import type { ChatThread } from '@/types'

export const runtime = 'edge'

// GET /api/threads - Fetch all threads
export async function GET() {
  try {
    const { data: threads, error } = await supabase
      .from('chat_threads')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse(threads || [])
  } catch (error) {
    return handleAPIError(error)
  }
}

// POST /api/threads - Create a new thread
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { 
      title, 
      topic,
      summary = null
    } = body

    // Validate required fields
    if (!title) {
      return errorResponse('Title is required')
    }

    const threadData: Partial<ChatThread> = {
      title,
      topic,
      summary
    }

    const { data: thread, error } = await supabase
      .from('chat_threads')
      .insert(threadData)
      .select()
      .single()

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse(thread, 'Thread created successfully')
  } catch (error) {
    return handleAPIError(error)
  }
}
