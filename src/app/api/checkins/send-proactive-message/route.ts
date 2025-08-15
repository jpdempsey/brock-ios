import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { openai } from '@/lib/openai/client'
import { BrockMemorySystem } from '@/lib/memory'
import { NotificationService } from '@/lib/notifications/service'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'

export const runtime = 'edge'

const CHAT_MODEL = 'gpt-4o-mini'

// POST /api/checkins/send-proactive-message - Send proactive check-in message
export async function POST(request: NextRequest) {
  try {
    // Verify this is authorized (from cron or admin)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return errorResponse('Unauthorized', 401)
    }

    const { timeOfDay } = await request.json()
    
    if (!timeOfDay || !['morning', 'afternoon'].includes(timeOfDay)) {
      return errorResponse('Invalid timeOfDay. Must be "morning" or "afternoon"')
    }

    console.log(`🤖 Generating proactive ${timeOfDay} check-in message...`)

    // Find or create the general check-in thread
    const threadResult = await findOrCreateGeneralCheckinThread()
    if (!threadResult.success) {
      return errorResponse(`Failed to find/create general check-in thread: ${threadResult.error}`)
    }
    
    const threadId = threadResult.threadId!

    // Generate contextual proactive message
    const messageResult = await generateProactiveMessage(timeOfDay, threadId)
    if (!messageResult.success) {
      return errorResponse(`Failed to generate message: ${messageResult.error}`)
    }

    const message = messageResult.message!

    // Save Brock's message to the database
    const { error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        sender: 'brock',
        content: message,
        metadata: { 
          type: 'proactive_checkin',
          time_of_day: timeOfDay,
          generated_at: new Date().toISOString()
        }
      })

    if (messageError) {
      console.error('Error saving message:', messageError)
      return errorResponse(`Failed to save message: ${messageError.message}`)
    }

    // Update thread's updated_at timestamp
    await supabase
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId)

    // Add notification to queue for iOS app to pick up
    const notificationSuccess = await NotificationService.createProactiveCheckinNotification(
      threadId, 
      message, 
      timeOfDay
    )

    console.log(`✅ Sent proactive ${timeOfDay} check-in message to thread ${threadId}`)
    console.log(`📝 Message: ${message.substring(0, 100)}...`)
    console.log(`📬 Notification queued: ${notificationSuccess ? 'success' : 'failed'}`)

    return successResponse({
      message: 'Proactive check-in message sent successfully',
      threadId,
      timeOfDay,
      content: message,
      notificationQueued: notificationSuccess
    })

  } catch (error) {
    console.error('Error in send-proactive-message:', error)
    return handleAPIError(error)
  }
}

// Find or create the general check-in thread
async function findOrCreateGeneralCheckinThread(): Promise<{success: boolean, threadId?: string, error?: string}> {
  try {
    // Look for existing general check-in thread
    const { data: existingThread } = await supabase
      .from('chat_threads')
      .select('id, title')
      .contains('flags', { is_general_checkin: true })
      .single()

    if (existingThread) {
      console.log(`📱 Found existing general check-in thread: ${existingThread.title}`)
      return { success: true, threadId: existingThread.id }
    }

    // Create new general check-in thread
    console.log('📱 Creating new general check-in thread...')
    const { data: newThread, error } = await supabase
      .from('chat_threads')
      .insert({
        title: 'Daily Check-ins',
        topic: 'Daily accountability and progress check-ins',
        summary: 'Thread for proactive daily check-ins from Brock',
        flags: { 
          is_general_checkin: true,
          icon: 'clock.badge.checkmark',
          icon_color: 'green'
        }
      })
      .select('id')
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    console.log(`✅ Created new general check-in thread: ${newThread.id}`)
    return { success: true, threadId: newThread.id }

  } catch (error) {
    return { success: false, error: String(error) }
  }
}

// Generate contextual proactive message using AI
async function generateProactiveMessage(timeOfDay: 'morning' | 'afternoon', threadId: string): Promise<{success: boolean, message?: string, error?: string}> {
  try {
    // Initialize memory system to get context
    const memorySystem = new BrockMemorySystem()
    
    // Get global profile and thread context
    const [profile, context] = await Promise.all([
      memorySystem.getGlobalProfile(),
      memorySystem.getThreadContext(threadId)
    ])

    // Get recent activities and goals for context
    const [recentActivities, activeGoals] = await Promise.all([
      getRecentActivities(),
      getActiveGoals()
    ])

    // Build contextual prompt for proactive message
    const systemPrompt = buildProactiveMessagePrompt(timeOfDay, profile, recentActivities, activeGoals)

    // Generate message using OpenAI
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a ${timeOfDay} check-in message` }
      ],
      temperature: 0.8,
      max_tokens: 200
    })

    const message = response.choices[0]?.message?.content?.trim()
    
    if (!message) {
      return { success: false, error: 'No message generated' }
    }

    return { success: true, message }

  } catch (error) {
    console.error('Error generating proactive message:', error)
    return { success: false, error: String(error) }
  }
}

// Get recent activities for context
async function getRecentActivities() {
  const { data: activities } = await supabase
    .from('activities')
    .select('title, activity_type, created_at')
    .order('created_at', { ascending: false })
    .limit(5)
  
  return activities || []
}

// Get active goals for context
async function getActiveGoals() {
  const { data: goals } = await supabase
    .from('goals')
    .select('title, description, target_date')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(3)
  
  return goals || []
}

// Build system prompt for proactive messaging
function buildProactiveMessagePrompt(
  timeOfDay: 'morning' | 'afternoon',
  profile: any,
  recentActivities: any[],
  activeGoals: any[]
): string {
  const timeContext = timeOfDay === 'morning' 
    ? 'It\'s morning - time to start the day strong and set intentions'
    : 'It\'s afternoon/evening - time to check in on progress and plan ahead'

  const activitiesContext = recentActivities.length > 0
    ? `Recent activities: ${recentActivities.map(a => `${a.title} (${a.activity_type})`).join(', ')}`
    : 'No recent activities logged'

  const goalsContext = activeGoals.length > 0
    ? `Active goals: ${activeGoals.map(g => g.title).join(', ')}`
    : 'No active goals set'

  return `You are Brock, a proactive personal trainer reaching out for a ${timeOfDay} accountability check-in.

CONTEXT:
- Time: ${timeContext}
- ${activitiesContext}
- ${goalsContext}
- User Profile: ${JSON.stringify(profile)}

INSTRUCTIONS:
- Be encouraging, motivational, and personal
- Reference recent activities or goals if relevant
- Ask a specific question to encourage engagement
- Keep it conversational and brief (2-3 sentences max)
- Match the energy for the time of day (energetic morning, reflective afternoon)
- Use appropriate emojis sparingly

EXAMPLES:
Morning: "Good morning! 🌅 I noticed you crushed that workout yesterday - how are you feeling about today's training? What's the first win you want to tackle?"

Afternoon: "Hey! How's your day going so far? 💪 I'm curious - did you get that strength session in, or are you planning it for later?"

Generate a personalized ${timeOfDay} check-in message now:`
}
