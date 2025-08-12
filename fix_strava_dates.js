// Quick script to fix Strava activity dates
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://nssulhixlseydkmnbbku.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zc3VsaGl4bHNleWRrbW5iYmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MjM1OTIsImV4cCI6MjA2OTk5OTU5Mn0.x_VNbwYOhhxTTEB0D0_3zdMpOukHTsGPfdRyuOtYg9E'

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixStravaActivityDates() {
  console.log('Fetching Strava activities...')
  
  // Get all Strava activities
  const { data: activities, error } = await supabase
    .from('activities')
    .select('*')
    .eq('activity_type', 'strava')
    .not('strava_id', 'is', null)

  if (error) {
    console.error('Error fetching activities:', error)
    return
  }

  console.log(`Found ${activities.length} Strava activities to update`)

  let updated = 0
  for (const activity of activities) {
    if (activity.data && activity.data.start_date_local) {
      const actualDate = activity.data.start_date_local
      
      console.log(`Updating activity "${activity.title}" from ${activity.created_at} to ${actualDate}`)
      
      const { error: updateError } = await supabase
        .from('activities')
        .update({ created_at: actualDate })
        .eq('id', activity.id)

      if (updateError) {
        console.error(`Error updating activity ${activity.id}:`, updateError)
      } else {
        updated++
      }
    }
  }

  console.log(`Successfully updated ${updated} activities with correct dates!`)
}

fixStravaActivityDates().catch(console.error)
