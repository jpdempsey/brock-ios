import { supabase } from '@/lib/supabase/client'
import type { Goal, Activity, DailyNutrition } from '@/types'

// Tool definitions for OpenAI function calling
export const toolDefs = [
  {
    type: 'function',
    function: {
      name: 'fetch_goals',
      description: 'Fetch all goals from the database',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of goals to fetch',
            default: 10
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_goal',
      description: 'Create a new goal',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Goal name' },
          milestone_description: { type: 'string', description: 'What milestone to achieve' },
          start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          milestone_date: { type: 'string', description: 'Target milestone date (YYYY-MM-DD)' },
          reason: { type: 'string', description: 'Why this goal matters' },
          image_system_name: { type: 'string', description: 'System icon name', default: 'target' }
        },
        required: ['name', 'milestone_description', 'start_date', 'milestone_date']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fetch_activities',
      description: 'Fetch activities, optionally filtered by goal',
      parameters: {
        type: 'object',
        properties: {
          goal_id: { type: 'string', description: 'Filter by specific goal ID' },
          limit: { type: 'number', description: 'Maximum number of activities to fetch', default: 20 },
          activity_type: { type: 'string', description: 'Filter by activity type (workout, nutrition, etc.)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'log_activity',
      description: 'Log a new activity',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Activity title' },
          icon_name: { type: 'string', description: 'System icon name' },
          goal_id: { type: 'string', description: 'Related goal ID (optional)' },
          activity_type: { type: 'string', description: 'Type of activity', default: 'general' },
          data: { type: 'object', description: 'Additional activity data (sets, reps, distance, etc.)' }
        },
        required: ['title', 'icon_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fetch_daily_nutrition',
      description: 'Fetch daily nutrition data',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Specific date (YYYY-MM-DD) or leave empty for recent days' },
          limit: { type: 'number', description: 'Number of days to fetch', default: 7 }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: 'Get the current date and time',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  }
]

// Tool implementations
export const tools = {
  async fetch_goals({ limit = 10 }: { limit?: number } = {}) {
    try {
      const { data: goals, error } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return { success: true, data: goals }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  },

  async create_goal({ 
    name, 
    milestone_description, 
    start_date, 
    milestone_date, 
    reason, 
    image_system_name = 'target' 
  }: {
    name: string
    milestone_description: string
    start_date: string
    milestone_date: string
    reason?: string
    image_system_name?: string
  }) {
    try {
      const goalData: Partial<Goal> = {
        name,
        milestone_description,
        start_date,
        milestone_date,
        reason,
        image_system_name,
        is_manually_completed: false
      }

      const { data: goal, error } = await supabase
        .from('goals')
        .insert(goalData)
        .select()
        .single()

      if (error) throw error
      return { success: true, data: goal, message: `Goal "${name}" created successfully` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  },

  async fetch_activities({ 
    goal_id, 
    limit = 20, 
    activity_type 
  }: { 
    goal_id?: string
    limit?: number
    activity_type?: string 
  } = {}) {
    try {
      let query = supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (goal_id) {
        query = query.eq('goal_id', goal_id)
      }

      if (activity_type) {
        query = query.eq('activity_type', activity_type)
      }

      const { data: activities, error } = await query

      if (error) throw error
      return { success: true, data: activities }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  },

  async log_activity({ 
    title, 
    icon_name, 
    goal_id, 
    activity_type = 'general', 
    data = {} 
  }: {
    title: string
    icon_name: string
    goal_id?: string
    activity_type?: string
    data?: Record<string, any>
  }) {
    try {
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

      if (error) throw error
      return { success: true, data: activity, message: `Activity "${title}" logged successfully` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  },

  async fetch_daily_nutrition({ 
    date, 
    limit = 7 
  }: { 
    date?: string
    limit?: number 
  } = {}) {
    try {
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

      if (error) throw error
      return { success: true, data: nutrition }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  },

  async get_current_time() {
    const now = new Date()
    return {
      success: true,
      data: {
        iso: now.toISOString(),
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    }
  }
}
