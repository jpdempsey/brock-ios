import { supabase } from '@/lib/supabase/client'
import { openai } from '@/lib/openai/client'

// Global Profile - stable facts about the user
export interface GlobalProfile {
  name: string
  timezone: string
  schedule_constraints?: Record<string, any>
  equipment?: string[]
  past_injuries?: string[]
  dietary_preferences?: Record<string, any>
  high_level_goals?: string[]
}

// Thread Context - focused memory for current conversation
export interface ThreadContext {
  thread_id: string
  title: string
  topic?: string
  summary?: string
  recent_messages: Array<{
    sender: 'user' | 'brock'
    content: string
    created_at: string
  }>
}

// Default global profile for personal use
const DEFAULT_GLOBAL_PROFILE: GlobalProfile = {
  name: 'James',
  timezone: 'America/New_York',
  schedule_constraints: {
    preferred_workout_times: ['morning', 'early_evening'],
    busy_days: ['monday', 'wednesday'],
    available_duration: '45-60 minutes'
  },
  equipment: [
    'dumbbells',
    'resistance_bands', 
    'pull_up_bar',
    'yoga_mat'
  ],
  past_injuries: [
    'left_shoulder_impingement_2023'
  ],
  dietary_preferences: {
    style: 'flexible',
    protein_target: 165,
    avoid_foods: [],
    meal_timing: 'intermittent_fasting_16_8'
  },
  high_level_goals: [
    'Build sustainable fitness habits',
    'Improve running endurance for half marathon',
    'Maintain healthy body composition',
    'Optimize sleep and recovery'
  ]
}

export class BrockMemorySystem {
  // Get global profile (for now, return default - can be enhanced to fetch from DB)
  async getGlobalProfile(): Promise<GlobalProfile> {
    // TODO: In future, fetch from profiles table
    return DEFAULT_GLOBAL_PROFILE
  }

  // Get thread context with recent messages
  async getThreadContext(threadId: string, messageLimit: number = 10): Promise<ThreadContext> {
    try {
      // Fetch thread info
      const { data: thread, error: threadError } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('id', threadId)
        .single()

      if (threadError) throw threadError

      // Fetch recent messages
      const { data: messages, error: messagesError } = await supabase
        .from('chat_messages')
        .select('sender, content, created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(messageLimit)

      if (messagesError) throw messagesError

      return {
        thread_id: threadId,
        title: thread.title,
        topic: thread.topic,
        summary: thread.summary,
        recent_messages: (messages || []).reverse() // Reverse to get chronological order
      }
    } catch (error) {
      console.error('Error fetching thread context:', error)
      return {
        thread_id: threadId,
        title: 'Unknown Thread',
        recent_messages: []
      }
    }
  }

  // Build system prompt with context
  buildSystemPrompt(profile: GlobalProfile, context: ThreadContext): string {
    const basePrompt = `You are Brock, a concise, action-oriented personal coach for ${profile.name}. You provide practical, personalized fitness and health guidance.

PROFILE:
- Name: ${profile.name}
- Timezone: ${profile.timezone}
- Equipment: ${profile.equipment?.join(', ') || 'basic home gym'}
- Past injuries: ${profile.past_injuries?.join(', ') || 'none noted'}
- Dietary style: ${profile.dietary_preferences?.style || 'flexible'}
- Protein target: ${profile.dietary_preferences?.protein_target || 'not specified'}g
- High-level goals: ${profile.high_level_goals?.join(', ') || 'general fitness'}

CURRENT CONVERSATION:
- Thread: "${context.title}"${context.topic ? ` (Topic: ${context.topic})` : ''}
${context.summary ? `- Summary: ${context.summary}` : ''}

GUIDELINES:
- Be concise and actionable
- Use tools to fetch current data when relevant
- Reference past conversation context when helpful
- Focus on practical next steps
- Maintain encouraging but realistic tone

Use available tools to fetch goals, activities, nutrition data, or log new activities when they would improve your response accuracy.`

    return basePrompt
  }

  // Update thread summary (called periodically)
  async updateThreadSummary(threadId: string, newSummary: string): Promise<void> {
    try {
      await supabase
        .from('chat_threads')
        .update({ 
          summary: newSummary,
          updated_at: new Date().toISOString()
        })
        .eq('id', threadId)
    } catch (error) {
      console.error('Error updating thread summary:', error)
    }
  }

  // Generate summary from recent messages (basic implementation)
  async generateThreadSummary(threadId: string): Promise<string> {
    try {
      const context = await this.getThreadContext(threadId, 20)
      
      if (context.recent_messages.length === 0) {
        return 'New conversation'
      }

      const messagesText = context.recent_messages
        .map(msg => `${msg.sender}: ${msg.content}`)
        .join('\n')

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Summarize this conversation thread in 1-2 sentences, focusing on the main topic and any key decisions or progress.'
          },
          {
            role: 'user',
            content: messagesText
          }
        ],
        max_tokens: 100,
        temperature: 0.3
      })

      return response.choices[0]?.message?.content || 'Conversation about fitness and health'
    } catch (error) {
      console.error('Error generating thread summary:', error)
      return 'Conversation about fitness and health'
    }
  }
}
