import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'
import type { ChatMessage } from '@/types'

export const runtime = 'edge'

interface RouteParams {
  params: { id: string }
}

// GET /api/threads/[id]/messages - Get messages for a thread
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', params.id)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse(messages || [])
  } catch (error) {
    return handleAPIError(error)
  }
}

// POST /api/threads/[id]/messages - Add a message to a thread
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json()
    
    const { 
      sender, 
      content,
      metadata = null
    } = body

    // Validate required fields
    if (!sender || !content) {
      return errorResponse('Sender and content are required')
    }

    if (!['user', 'brock'].includes(sender)) {
      return errorResponse('Sender must be either "user" or "brock"')
    }

    const messageData: Partial<ChatMessage> = {
      thread_id: params.id,
      sender,
      content,
      metadata
    }

    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single()

    if (error) {
      return errorResponse(error.message)
    }

    // Update thread's updated_at timestamp
    await supabase
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', params.id)

    return successResponse(message, 'Message added successfully')
  } catch (error) {
    return handleAPIError(error)
  }
}
