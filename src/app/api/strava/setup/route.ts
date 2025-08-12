import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'

// Removed edge runtime to avoid Headers.delete immutable error

// POST /api/strava/setup - One-time setup with your personal tokens
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      access_token,
      refresh_token,
      expires_at_hours = 6 // Default Strava token expiry
    } = body

    if (!access_token || !refresh_token) {
      return errorResponse('access_token and refresh_token are required')
    }

    // Calculate expiry time (6 hours from now by default)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + expires_at_hours)

    // Get athlete data from Strava to validate token
    let athleteData = null
    try {
      const response = await fetch('https://www.strava.com/api/v3/athlete', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        athleteData = await response.json()
      }
    } catch (error) {
      console.warn('Could not fetch athlete data:', error)
    }

    // Insert/update config (upsert since there's only one row)
    const { data, error } = await supabase
      .from('strava_config')
      .upsert({
        access_token,
        refresh_token,
        expires_at: expiresAt.toISOString(),
        athlete_data: athleteData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()

    if (error) {
      return errorResponse(`Failed to store config: ${error.message}`)
    }

    return successResponse({
      message: 'Strava configuration saved successfully',
      athlete: athleteData?.firstname + ' ' + athleteData?.lastname || 'Unknown',
      expires_at: expiresAt.toISOString()
    })
    
  } catch (error) {
    return handleAPIError(error)
  }
}

// GET /api/strava/setup - Check current setup
export async function GET() {
  try {
    const { data: config, error } = await supabase
      .from('strava_config')
      .select('expires_at, athlete_data, created_at, last_sync')
      .single()

    if (error) {
      return successResponse({ 
        configured: false, 
        message: 'No Strava configuration found' 
      })
    }

    const now = new Date()
    const expiresAt = new Date(config.expires_at)
    const isExpired = expiresAt <= now

    return successResponse({
      configured: true,
      athlete: config.athlete_data?.firstname + ' ' + config.athlete_data?.lastname || 'Unknown',
      expires_at: config.expires_at,
      is_expired: isExpired,
      created_at: config.created_at,
      last_sync: config.last_sync
    })
    
  } catch (error) {
    return handleAPIError(error)
  }
}
