import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'
import type { Goal } from '@/types'

export const runtime = 'edge'

interface RouteParams {
  params: { id: string }
}

// GET /api/goals/[id] - Get specific goal
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { data: goal, error } = await supabase
      .from('goals')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      return errorResponse(error.message)
    }

    if (!goal) {
      return errorResponse('Goal not found', 404)
    }

    return successResponse(goal)
  } catch (error) {
    return handleAPIError(error)
  }
}

// PUT /api/goals/[id] - Update specific goal
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json()
    
    const { data: goal, error } = await supabase
      .from('goals')
      .update(body)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return errorResponse(error.message)
    }

    if (!goal) {
      return errorResponse('Goal not found', 404)
    }

    return successResponse(goal, 'Goal updated successfully')
  } catch (error) {
    return handleAPIError(error)
  }
}

// DELETE /api/goals/[id] - Delete specific goal
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', params.id)

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse(null, 'Goal deleted successfully')
  } catch (error) {
    return handleAPIError(error)
  }
}

