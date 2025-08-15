import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'

export const runtime = 'edge'

// GET /api/checkins/check-time - Check if it's time for a proactive check-in (Vercel cron: every 15 minutes)
export async function GET() {
  try {
    // Get current date and time in ET timezone
    const now = new Date()
    const etDateTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}))
    const dateString = etDateTime.toISOString().split('T')[0] // YYYY-MM-DD
    const currentTime = etDateTime.toTimeString().split(' ')[0] // HH:MM:SS

    console.log(`🕐 Checking time: ${dateString} ${currentTime} ET`)

    // Get today's schedule
    const { data: schedule, error } = await supabase
      .from('daily_checkin_schedule')
      .select('*')
      .eq('date', dateString)
      .single()

    if (error || !schedule) {
      console.log(`⚠️ No schedule found for ${dateString}`)
      return successResponse({ message: 'No schedule found for today', date: dateString })
    }

    let messagesSent = 0
    const results = []

    // Check morning time
    if (!schedule.morning_sent && isTimeForCheckin(currentTime, schedule.morning_time)) {
      console.log(`🌅 Time for morning check-in! (${schedule.morning_time})`)
      
      const result = await sendProactiveMessage('morning')
      if (result.success) {
        // Mark morning as sent
        await supabase
          .from('daily_checkin_schedule')
          .update({ morning_sent: true })
          .eq('id', schedule.id)
        
        messagesSent++
        results.push({ type: 'morning', sent: true, time: schedule.morning_time })
      } else {
        results.push({ type: 'morning', sent: false, error: result.error })
      }
    }

    // Check afternoon time
    if (!schedule.afternoon_sent && isTimeForCheckin(currentTime, schedule.afternoon_time)) {
      console.log(`🌇 Time for afternoon check-in! (${schedule.afternoon_time})`)
      
      const result = await sendProactiveMessage('afternoon')
      if (result.success) {
        // Mark afternoon as sent
        await supabase
          .from('daily_checkin_schedule')
          .update({ afternoon_sent: true })
          .eq('id', schedule.id)
        
        messagesSent++
        results.push({ type: 'afternoon', sent: true, time: schedule.afternoon_time })
      } else {
        results.push({ type: 'afternoon', sent: false, error: result.error })
      }
    }

    if (messagesSent > 0) {
      console.log(`✅ Sent ${messagesSent} proactive check-in message(s)`)
    }

    return successResponse({
      message: `Checked time for ${dateString}`,
      currentTime,
      schedule: {
        morning_time: schedule.morning_time,
        afternoon_time: schedule.afternoon_time,
        morning_sent: schedule.morning_sent,
        afternoon_sent: schedule.afternoon_sent
      },
      results,
      messagesSent
    })

  } catch (error) {
    console.error('Error in check-time:', error)
    return handleAPIError(error)
  }
}

// POST /api/checkins/check-time - Check if it's time for a proactive check-in (Vercel cron: every 15 minutes)
export async function POST(request: NextRequest) {
  try {
    // Verify this is a Vercel cron job
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return errorResponse('Unauthorized', 401)
    }

    // Get current date and time in ET timezone
    const now = new Date()
    const etDateTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}))
    const dateString = etDateTime.toISOString().split('T')[0] // YYYY-MM-DD
    const currentTime = etDateTime.toTimeString().split(' ')[0] // HH:MM:SS

    console.log(`🕐 Checking time: ${dateString} ${currentTime} ET`)

    // Get today's schedule
    const { data: schedule, error } = await supabase
      .from('daily_checkin_schedule')
      .select('*')
      .eq('date', dateString)
      .single()

    if (error || !schedule) {
      console.log(`⚠️ No schedule found for ${dateString}`)
      return successResponse({ message: 'No schedule found for today', date: dateString })
    }

    let messagesSent = 0
    const results = []

    // Check morning time
    if (!schedule.morning_sent && isTimeForCheckin(currentTime, schedule.morning_time)) {
      console.log(`🌅 Time for morning check-in! (${schedule.morning_time})`)
      
      const result = await sendProactiveMessage('morning')
      if (result.success) {
        // Mark morning as sent
        await supabase
          .from('daily_checkin_schedule')
          .update({ morning_sent: true })
          .eq('id', schedule.id)
        
        messagesSent++
        results.push({ type: 'morning', sent: true, time: schedule.morning_time })
      } else {
        results.push({ type: 'morning', sent: false, error: result.error })
      }
    }

    // Check afternoon time
    if (!schedule.afternoon_sent && isTimeForCheckin(currentTime, schedule.afternoon_time)) {
      console.log(`🌇 Time for afternoon check-in! (${schedule.afternoon_time})`)
      
      const result = await sendProactiveMessage('afternoon')
      if (result.success) {
        // Mark afternoon as sent
        await supabase
          .from('daily_checkin_schedule')
          .update({ afternoon_sent: true })
          .eq('id', schedule.id)
        
        messagesSent++
        results.push({ type: 'afternoon', sent: true, time: schedule.afternoon_time })
      } else {
        results.push({ type: 'afternoon', sent: false, error: result.error })
      }
    }

    if (messagesSent > 0) {
      console.log(`✅ Sent ${messagesSent} proactive check-in message(s)`)
    }

    return successResponse({
      message: `Checked time for ${dateString}`,
      currentTime,
      schedule: {
        morning_time: schedule.morning_time,
        afternoon_time: schedule.afternoon_time,
        morning_sent: schedule.morning_sent,
        afternoon_sent: schedule.afternoon_sent
      },
      results,
      messagesSent
    })

  } catch (error) {
    console.error('Error in check-time:', error)
    return handleAPIError(error)
  }
}

// Check if current time is within 15 minutes of scheduled time
function isTimeForCheckin(currentTime: string, scheduledTime: string): boolean {
  const current = timeToMinutes(currentTime)
  const scheduled = timeToMinutes(scheduledTime)
  
  // Check if we're within 15 minutes after the scheduled time
  return current >= scheduled && current < scheduled + 15
}

// Convert HH:MM:SS to minutes since midnight
function timeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number)
  return hours * 60 + minutes
}

// Send proactive message to general check-in thread
async function sendProactiveMessage(timeOfDay: 'morning' | 'afternoon'): Promise<{success: boolean, error?: string}> {
  try {
    // Call the proactive message API
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/checkins/send-proactive-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      },
      body: JSON.stringify({ timeOfDay })
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
