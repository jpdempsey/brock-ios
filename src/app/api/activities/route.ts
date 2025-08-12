import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'
import type { Activity } from '@/types'

// Removed edge runtime for consistency

// GET /api/activities - Fetch all activities
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const goalId = searchParams.get('goal_id')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (goalId) {
      query = query.eq('goal_id', goalId)
    }

    const { data: activities, error } = await query

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse(activities || [])
  } catch (error) {
    return handleAPIError(error)
  }
}

// POST /api/activities - Create a new activity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { 
      title, 
      icon_name, 
      goal_id,
      activity_type = 'general',
      data = {}
    } = body

    // Validate required fields
    if (!title || !icon_name) {
      return errorResponse('Title and icon name are required')
    }

    const activityData: Partial<Activity> = {
      title,
      icon_name,
      goal_id,
      activity_type,
      data
    }

    const { data: activity, error } = await supabase
      .from('activities')
      .insert(activityData)
      .select()
      .single()

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse(activity, 'Activity created successfully')
  } catch (error) {
    return handleAPIError(error)
  }
}

