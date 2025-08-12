import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'

export const runtime = 'edge'

interface RouteParams {
  params: { id: string }
}

// GET /api/activities/[id] - Get specific activity
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { data: activity, error } = await supabase
      .from('activities')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      return errorResponse(error.message)
    }

    if (!activity) {
      return errorResponse('Activity not found', 404)
    }

    return successResponse(activity)
  } catch (error) {
    return handleAPIError(error)
  }
}

// PUT /api/activities/[id] - Update specific activity
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json()
    
    const { data: activity, error } = await supabase
      .from('activities')
      .update(body)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return errorResponse(error.message)
    }

    if (!activity) {
      return errorResponse('Activity not found', 404)
    }

    return successResponse(activity, 'Activity updated successfully')
  } catch (error) {
    return handleAPIError(error)
  }
}

// DELETE /api/activities/[id] - Delete specific activity
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', params.id)

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse(null, 'Activity deleted successfully')
  } catch (error) {
    return handleAPIError(error)
  }
}

