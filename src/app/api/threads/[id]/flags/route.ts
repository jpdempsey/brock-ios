import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'

interface RouteParams {
  params: { id: string }
}

// GET /api/threads/[id]/flags - Get thread flags
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { data: thread, error } = await supabase
      .from('chat_threads')
      .select('id, title, flags')
      .eq('id', params.id)
      .single()

    if (error) {
      return errorResponse(error.message)
    }

    if (!thread) {
      return errorResponse('Thread not found', 404)
    }

    return successResponse({
      threadId: thread.id,
      title: thread.title,
      flags: thread.flags || {}
    })

  } catch (error) {
    return handleAPIError(error)
  }
}

// PUT /api/threads/[id]/flags - Update thread flags
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json()
    const { flags, merge = true } = body

    if (!flags || typeof flags !== 'object') {
      return errorResponse('Invalid flags object')
    }

    // Get current thread
    const { data: currentThread, error: fetchError } = await supabase
      .from('chat_threads')
      .select('flags')
      .eq('id', params.id)
      .single()

    if (fetchError) {
      return errorResponse(fetchError.message)
    }

    // Merge or replace flags
    const updatedFlags = merge 
      ? { ...(currentThread.flags || {}), ...flags }
      : flags

    // Update thread flags
    const { data: thread, error } = await supabase
      .from('chat_threads')
      .update({ 
        flags: updatedFlags,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select('id, title, flags')
      .single()

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse({
      message: 'Thread flags updated successfully',
      threadId: thread.id,
      title: thread.title,
      flags: thread.flags
    })

  } catch (error) {
    return handleAPIError(error)
  }
}

// DELETE /api/threads/[id]/flags - Remove specific flags
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { searchParams } = new URL(request.url)
    const flagsToRemove = searchParams.get('flags')?.split(',') || []

    if (flagsToRemove.length === 0) {
      return errorResponse('No flags specified to remove')
    }

    // Get current thread
    const { data: currentThread, error: fetchError } = await supabase
      .from('chat_threads')
      .select('flags')
      .eq('id', params.id)
      .single()

    if (fetchError) {
      return errorResponse(fetchError.message)
    }

    // Remove specified flags
    const updatedFlags = { ...(currentThread.flags || {}) }
    flagsToRemove.forEach(flag => {
      delete updatedFlags[flag]
    })

    // Update thread
    const { data: thread, error } = await supabase
      .from('chat_threads')
      .update({ 
        flags: updatedFlags,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select('id, title, flags')
      .single()

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse({
      message: `Removed flags: ${flagsToRemove.join(', ')}`,
      threadId: thread.id,
      title: thread.title,
      flags: thread.flags
    })

  } catch (error) {
    return handleAPIError(error)
  }
}
