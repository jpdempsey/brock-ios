import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'
import type { Goal } from '@/types'

export const runtime = 'edge'

// GET /api/goals - Fetch all goals
export async function GET() {
  try {
    const { data: goals, error } = await supabase
      .from('goals')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse(goals || [])
  } catch (error) {
    return handleAPIError(error)
  }
}

// POST /api/goals - Create a new goal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { 
      name, 
      milestone_description, 
      start_date, 
      milestone_date, 
      reason, 
      image_system_name = 'target',
      is_manually_completed = false 
    } = body

    // Validate required fields
    if (!name || !milestone_description) {
      return errorResponse('Name and milestone description are required')
    }

    const goalData: Partial<Goal> = {
      name,
      milestone_description,
      start_date,
      milestone_date,
      reason,
      image_system_name,
      is_manually_completed
    }

    const { data: goal, error } = await supabase
      .from('goals')
      .insert(goalData)
      .select()
      .single()

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse(goal, 'Goal created successfully')
  } catch (error) {
    return handleAPIError(error)
  }
}

