import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'

export const runtime = 'edge'

// GET /api/checkins/generate-schedule - Test endpoint (shows info without generating)
export async function GET() {
  try {
    const now = new Date()
    const etDate = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}))
    const dateString = etDate.toISOString().split('T')[0]
    
    // Check if schedule exists for today
    const { data: existing } = await supabase
      .from('daily_checkin_schedule')
      .select('*')
      .eq('date', dateString)
      .single()
    
    return successResponse({
      message: 'Schedule generation endpoint (use POST to generate)',
      currentDate: dateString,
      currentTimeET: etDate.toLocaleString("en-US", {timeZone: "America/New_York"}),
      existingSchedule: existing || null,
      note: 'Use POST with Authorization header to generate schedule'
    })
  } catch (error) {
    return handleAPIError(error)
  }
}

// POST /api/checkins/generate-schedule - Generate daily check-in schedule (Vercel cron: daily at 1AM ET)
export async function POST(request: NextRequest) {
  try {
    // Verify this is a Vercel cron job
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return errorResponse('Unauthorized', 401)
    }

    // Get current date in ET timezone
    const now = new Date()
    const etDate = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}))
    const dateString = etDate.toISOString().split('T')[0] // YYYY-MM-DD format
    
    // Check if schedule already exists for today
    const { data: existing } = await supabase
      .from('daily_checkin_schedule')
      .select('id')
      .eq('date', dateString)
      .single()
    
    if (existing) {
      console.log(`✅ Schedule already exists for ${dateString}`)
      return successResponse({ message: 'Schedule already exists for today', date: dateString })
    }

    // Generate random times within the specified windows
    const morningTime = generateRandomTime(7, 30, 10, 30) // 7:30-10:30 AM
    const afternoonTime = generateRandomTime(15, 0, 20, 0) // 3:00-8:00 PM

    // Insert new schedule
    const { data: schedule, error } = await supabase
      .from('daily_checkin_schedule')
      .insert({
        date: dateString,
        morning_time: morningTime,
        afternoon_time: afternoonTime,
        morning_sent: false,
        afternoon_sent: false,
        timezone: 'America/New_York'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating schedule:', error)
      return errorResponse(`Failed to create schedule: ${error.message}`)
    }

    console.log(`🕐 Generated check-in schedule for ${dateString}:`)
    console.log(`  Morning: ${morningTime}`)
    console.log(`  Afternoon: ${afternoonTime}`)

    return successResponse({
      message: 'Daily check-in schedule generated successfully',
      schedule: {
        date: dateString,
        morning_time: morningTime,
        afternoon_time: afternoonTime
      }
    })

  } catch (error) {
    console.error('Error in generate-schedule:', error)
    return handleAPIError(error)
  }
}

// Generate random time within a window (24-hour format)
function generateRandomTime(startHour: number, startMin: number, endHour: number, endMin: number): string {
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  
  const randomMinutes = Math.floor(Math.random() * (endMinutes - startMinutes + 1)) + startMinutes
  
  const hours = Math.floor(randomMinutes / 60)
  const minutes = randomMinutes % 60
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
}
