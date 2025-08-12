import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { stravaClient } from '@/lib/strava/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'
import type { Activity } from '@/types'

// Removed edge runtime to avoid Headers.delete immutable error

// POST /api/strava/sync - Sync Strava activities to activities table
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      days = 30, // Sync activities from last 30 days by default
      force = false // Force re-sync existing activities
    } = body

    const syncResult = await syncStravaActivities(days, force)
    
    if (!syncResult.success) {
      return errorResponse(syncResult.error || 'Sync failed')
    }

    return successResponse({
      synced: syncResult.synced,
      skipped: syncResult.skipped,
      errors: syncResult.errors
    }, `Synced ${syncResult.synced} Strava activities`)
    
  } catch (error) {
    return handleAPIError(error)
  }
}

// GET /api/strava/sync - Get sync status or trigger sync
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const trigger = searchParams.get('trigger') === 'true'
    
    if (trigger) {
      // Trigger a sync
      const syncResult = await syncStravaActivities(7, false) // Last 7 days
      return successResponse(syncResult, 'Sync completed')
    } else {
      // Get sync status
      const status = await getSyncStatus()
      return successResponse(status)
    }
  } catch (error) {
    return handleAPIError(error)
  }
}

async function syncStravaActivities(days: number, force: boolean) {
  try {
    // Calculate date range
    const afterDate = new Date()
    afterDate.setDate(afterDate.getDate() - days)

    let synced = 0
    let skipped = 0
    let errors: string[] = []
    let page = 1
    const perPage = 30

    while (true) {
      // Get activities from Strava
      const activities = await stravaClient.getActivitiesAfter(afterDate, page, perPage)
      
      if (activities.length === 0) {
        break // No more activities
      }

      for (const stravaActivity of activities) {
        try {
          const result = await syncSingleActivity(stravaActivity, force)
          if (result.synced) {
            synced++
          } else {
            skipped++
          }
        } catch (error) {
          errors.push(`Failed to sync activity ${stravaActivity.id}: ${error}`)
        }
      }

      // If we got less than perPage activities, we're done
      if (activities.length < perPage) {
        break
      }

      page++
    }

    // Update last sync timestamp
    try {
      await supabase
        .from('strava_config')
        .update({ 
          last_sync: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .limit(1) // Since there's only one config row
    } catch (updateError) {
      console.warn('Failed to update last sync timestamp:', updateError)
    }

    return {
      success: true,
      synced,
      skipped,
      errors
    }
  } catch (error) {
    return {
      success: false,
      error: `Sync error: ${error}`,
      synced: 0,
      skipped: 0,
      errors: []
    }
  }
}

async function syncSingleActivity(stravaActivity: any, force: boolean) {
  // Check if activity already exists (using strava_id column directly)
  const { data: existingActivity } = await supabase
    .from('activities')
    .select('*')
    .eq('strava_id', stravaActivity.id)
    .single()

  if (existingActivity && !force) {
    return { synced: false, reason: 'Already exists' }
  }

  // Map Strava activity to our activity format
  const activityData: Partial<Activity> = {
    title: stravaActivity.name,
    icon_name: mapStravaTypeToIcon(stravaActivity.sport_type),
    activity_type: 'strava',
    strava_id: stravaActivity.id, // Store strava_id directly in activities table
    created_at: stravaActivity.start_date_local, // Use actual activity date, not sync date
    data: {
      sport_type: stravaActivity.sport_type,
      start_date: stravaActivity.start_date,
      start_date_local: stravaActivity.start_date_local,
      distance: stravaActivity.distance,
      moving_time: stravaActivity.moving_time,
      elapsed_time: stravaActivity.elapsed_time,
      total_elevation_gain: stravaActivity.total_elevation_gain,
      average_speed: stravaActivity.average_speed,
      max_speed: stravaActivity.max_speed,
      average_heartrate: stravaActivity.average_heartrate,
      max_heartrate: stravaActivity.max_heartrate,
      elev_high: stravaActivity.elev_high,
      elev_low: stravaActivity.elev_low,
      external_id: stravaActivity.external_id,
      upload_id: stravaActivity.upload_id
    }
  }

  if (existingActivity && force) {
    // Update existing activity
    const { data: updatedActivity, error: updateError } = await supabase
      .from('activities')
      .update(activityData)
      .eq('id', existingActivity.id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update activity: ${updateError.message}`)
    }

    return { synced: true, reason: 'Updated' }
  } else {
    // Create new activity
    const { data: newActivity, error: insertError } = await supabase
      .from('activities')
      .insert(activityData)
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create activity: ${insertError.message}`)
    }

    return { synced: true, reason: 'Created' }
  }
}

function mapStravaTypeToIcon(sportType: string): string {
  const iconMap: { [key: string]: string } = {
    'Run': 'figure.run',
    'Ride': 'bicycle',
    'Walk': 'figure.walk',
    'Hike': 'figure.hiking',
    'Swim': 'figure.pool.swim',
    'WeightTraining': 'dumbbell.fill',
    'Workout': 'figure.strengthtraining.traditional',
    'Yoga': 'figure.yoga',
    'CrossTraining': 'figure.cross.training',
    'Elliptical': 'figure.elliptical',
    'StairStepper': 'figure.stair.stepper',
    'Soccer': 'soccerball',
    'Basketball': 'basketball.fill',
    'Tennis': 'tennisball.fill',
    'Golf': 'figure.golf',
    'Skiing': 'figure.skiing.downhill',
    'Snowboarding': 'figure.snowboarding',
    'IceSkate': 'figure.skating',
    'RollerSki': 'figure.rolling',
    'Kayaking': 'figure.kayaking',
    'Canoeing': 'figure.kayaking',
    'Rowing': 'figure.rower',
    'StandUpPaddling': 'figure.surfing',
    'Surfing': 'figure.surfing',
    'Kitesurf': 'figure.surfing',
    'Windsurf': 'figure.surfing',
    'RockClimbing': 'figure.climbing',
    'AlpineSki': 'figure.skiing.downhill',
    'BackcountrySki': 'figure.skiing.crosscountry',
    'NordicSki': 'figure.skiing.crosscountry',
    'Snowshoe': 'figure.snowshoeing'
  }

  return iconMap[sportType] || 'figure.mixed.cardio'
}

async function getSyncStatus() {
  try {
    // Get total Strava activities
    const { count: totalStrava } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('activity_type', 'strava')

    // Get config and last sync
    const { data: config } = await supabase
      .from('strava_config')
      .select('expires_at, last_sync')
      .single()

    return {
      total_synced: totalStrava || 0,
      last_sync: config?.last_sync || null,
      auth_status: config ? 'connected' : 'not_connected',
      token_expires: config?.expires_at || null
    }
  } catch (error) {
    return {
      total_synced: 0,
      last_sync: null,
      auth_status: 'error',
      error: `${error}`
    }
  }
}
