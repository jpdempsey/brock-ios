import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'

export const runtime = 'edge'

// GET /api/nutrition - Fetch daily nutrition data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '30')
    const date = searchParams.get('date') // Specific date in YYYY-MM-DD format

    let query = supabase
      .from('daily_nutrition_est')
      .select('*')
      .order('day_est', { ascending: false })

    if (date) {
      query = query.eq('day_est', date)
    } else {
      query = query.limit(limit)
    }

    const { data: nutrition, error } = await query

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse(nutrition || [])
  } catch (error) {
    return handleAPIError(error)
  }
}

