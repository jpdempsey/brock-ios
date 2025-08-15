import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'

// GET /api/threads/general-checkin - Find or create the general check-in thread
export async function GET() {
  try {
    // Look for existing general check-in thread
    const { data: existingThread } = await supabase
      .from('chat_threads')
      .select('*')
      .contains('flags', { is_general_checkin: true })
      .single()

    if (existingThread) {
      return successResponse({
        message: 'Found existing general check-in thread',
        thread: existingThread,
        created: false
      })
    }

    // No general check-in thread found
    return successResponse({
      message: 'No general check-in thread found',
      thread: null,
      created: false
    })

  } catch (error) {
    return handleAPIError(error)
  }
}

// POST /api/threads/general-checkin - Create or update the general check-in thread
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      title = 'Daily Check-ins',
      topic = 'Daily accountability and progress check-ins',
      summary = 'Thread for proactive daily check-ins from Brock',
      forceCreate = false
    } = body

    // Check if general check-in thread already exists (unless forcing creation)
    if (!forceCreate) {
      const { data: existingThread } = await supabase
        .from('chat_threads')
        .select('*')
        .contains('flags', { is_general_checkin: true })
        .single()

      if (existingThread) {
        return successResponse({
          message: 'General check-in thread already exists',
          thread: existingThread,
          created: false
        })
      }
    }

    // Remove general check-in flag from any existing threads (only one should exist)
    const { data: existingThreads } = await supabase
      .from('chat_threads')
      .select('id, flags')
      .contains('flags', { is_general_checkin: true })

    if (existingThreads && existingThreads.length > 0) {
      for (const thread of existingThreads) {
        const updatedFlags = { ...thread.flags }
        delete updatedFlags.is_general_checkin
        
        await supabase
          .from('chat_threads')
          .update({ flags: updatedFlags })
          .eq('id', thread.id)
      }
    }

    // Create new general check-in thread
    const { data: newThread, error } = await supabase
      .from('chat_threads')
      .insert({
        title,
        topic,
        summary,
        flags: { is_general_checkin: true }
      })
      .select('*')
      .single()

    if (error) {
      return errorResponse(`Failed to create general check-in thread: ${error.message}`)
    }

    return successResponse({
      message: 'General check-in thread created successfully',
      thread: newThread,
      created: true
    })

  } catch (error) {
    return handleAPIError(error)
  }
}

// PUT /api/threads/general-checkin - Update which thread is the general check-in thread
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { threadId } = body

    if (!threadId) {
      return errorResponse('Thread ID is required')
    }

    // Verify the thread exists
    const { data: targetThread, error: fetchError } = await supabase
      .from('chat_threads')
      .select('id, title')
      .eq('id', threadId)
      .single()

    if (fetchError || !targetThread) {
      return errorResponse('Thread not found', 404)
    }

    // Remove general check-in flag from all threads
    const { data: allThreads } = await supabase
      .from('chat_threads')
      .select('id, flags')
      .contains('flags', { is_general_checkin: true })

    if (allThreads && allThreads.length > 0) {
      for (const thread of allThreads) {
        const updatedFlags = { ...thread.flags }
        delete updatedFlags.is_general_checkin
        
        await supabase
          .from('chat_threads')
          .update({ 
            flags: updatedFlags,
            updated_at: new Date().toISOString()
          })
          .eq('id', thread.id)
      }
    }

    // Add general check-in flag to the target thread
    const { data: currentThread } = await supabase
      .from('chat_threads')
      .select('flags')
      .eq('id', threadId)
      .single()

    const updatedFlags = { ...(currentThread?.flags || {}), is_general_checkin: true }

    const { data: updatedThread, error: updateError } = await supabase
      .from('chat_threads')
      .update({ 
        flags: updatedFlags,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId)
      .select('*')
      .single()

    if (updateError) {
      return errorResponse(`Failed to update thread: ${updateError.message}`)
    }

    return successResponse({
      message: `Thread "${targetThread.title}" is now the general check-in thread`,
      thread: updatedThread
    })

  } catch (error) {
    return handleAPIError(error)
  }
}
