import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { stravaClient } from '@/lib/strava/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'

// GET /api/webhooks/strava - Webhook verification (required by Strava)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    console.log('Strava webhook verification:', { mode, token, challenge })

    // Strava webhook verification
    if (mode === 'subscribe' && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
      console.log('Webhook verified successfully')
      return new Response(JSON.stringify({ 'hub.challenge': challenge }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return errorResponse('Webhook verification failed', 403)
  } catch (error) {
    console.error('Webhook verification error:', error)
    return handleAPIError(error)
  }
}

// POST /api/webhooks/strava - Handle webhook events
export async function POST(request: NextRequest) {
  try {
    const event = await request.json()
    console.log('Strava webhook event received:', JSON.stringify(event, null, 2))

    // Strava webhook event structure:
    // {
    //   "aspect_type": "create|update|delete",
    //   "event_time": 1516126040,
    //   "object_id": 1360128428,
    //   "object_type": "activity",
    //   "owner_id": 134815,
    //   "subscription_id": 120475,
    //   "updates": {}
    // }

    const { aspect_type, object_type, object_id, owner_id } = event

    // We only care about activity events
    if (object_type !== 'activity') {
      console.log('Ignoring non-activity event:', object_type)
      return successResponse({ message: 'Event ignored - not an activity' })
    }

    // Handle different event types
    switch (aspect_type) {
      case 'create':
        await handleActivityCreate(object_id)
        break
      case 'update':
        await handleActivityUpdate(object_id)
        break
      case 'delete':
        await handleActivityDelete(object_id)
        break
      default:
        console.log('Unknown aspect_type:', aspect_type)
    }

    return successResponse({ message: 'Webhook processed successfully' })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return handleAPIError(error)
  }
}

async function handleActivityCreate(stravaActivityId: number) {
  try {
    console.log('Processing activity create:', stravaActivityId)

    // Check if activity already exists
    const { data: existingActivity } = await supabase
      .from('activities')
      .select('id')
      .eq('strava_id', stravaActivityId)
      .single()

    if (existingActivity) {
      console.log('Activity already exists:', stravaActivityId)
      return
    }

    // Fetch full activity data from Strava
    const stravaActivity = await stravaClient.getActivity(stravaActivityId)
    
    // Map to our activity format
    const activityData = {
      title: stravaActivity.name,
      icon_name: mapStravaTypeToIcon(stravaActivity.sport_type),
      activity_type: 'strava',
      strava_id: stravaActivity.id,
      created_at: stravaActivity.start_date_local, // Use actual activity date
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

    // Insert into database
    const { data, error } = await supabase
      .from('activities')
      .insert(activityData)
      .select()
      .single()

    if (error) {
      console.error('Error creating activity:', error)
      return
    }

    console.log('Activity created successfully:', data.id)
  } catch (error) {
    console.error('Error in handleActivityCreate:', error)
  }
}

async function handleActivityUpdate(stravaActivityId: number) {
  try {
    console.log('Processing activity update:', stravaActivityId)

    // Find existing activity
    const { data: existingActivity } = await supabase
      .from('activities')
      .select('id')
      .eq('strava_id', stravaActivityId)
      .single()

    if (!existingActivity) {
      console.log('Activity not found for update, creating instead:', stravaActivityId)
      await handleActivityCreate(stravaActivityId)
      return
    }

    // Fetch updated data from Strava
    const stravaActivity = await stravaClient.getActivity(stravaActivityId)
    
    // Update activity
    const activityData = {
      title: stravaActivity.name,
      icon_name: mapStravaTypeToIcon(stravaActivity.sport_type),
      created_at: stravaActivity.start_date_local, // Use actual activity date
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

    const { error } = await supabase
      .from('activities')
      .update(activityData)
      .eq('id', existingActivity.id)

    if (error) {
      console.error('Error updating activity:', error)
      return
    }

    console.log('Activity updated successfully:', existingActivity.id)
  } catch (error) {
    console.error('Error in handleActivityUpdate:', error)
  }
}

async function handleActivityDelete(stravaActivityId: number) {
  try {
    console.log('Processing activity delete:', stravaActivityId)

    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('strava_id', stravaActivityId)

    if (error) {
      console.error('Error deleting activity:', error)
      return
    }

    console.log('Activity deleted successfully:', stravaActivityId)
  } catch (error) {
    console.error('Error in handleActivityDelete:', error)
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
