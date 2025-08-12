import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'

export const runtime = 'edge'

interface RouteParams {
  params: { id: string }
}

// GET /api/threads/[id] - Get specific thread
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { data: thread, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      return errorResponse(error.message)
    }

    if (!thread) {
      return errorResponse('Thread not found', 404)
    }

    return successResponse(thread)
  } catch (error) {
    return handleAPIError(error)
  }
}

// PUT /api/threads/[id] - Update specific thread
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json()
    
    // Always update the updated_at timestamp
    const updateData = {
      ...body,
      updated_at: new Date().toISOString()
    }
    
    const { data: thread, error } = await supabase
      .from('chat_threads')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return errorResponse(error.message)
    }

    if (!thread) {
      return errorResponse('Thread not found', 404)
    }

    return successResponse(thread, 'Thread updated successfully')
  } catch (error) {
    return handleAPIError(error)
  }
}

// DELETE /api/threads/[id] - Delete specific thread
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await supabase
      .from('chat_threads')
      .delete()
      .eq('id', params.id)

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse(null, 'Thread deleted successfully')
  } catch (error) {
    return handleAPIError(error)
  }
}
