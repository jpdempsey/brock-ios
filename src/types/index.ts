// Core data types matching iOS app models

export interface Goal {
  id: string
  name: string
  milestone_description: string
  start_date: string
  milestone_date: string
  reason?: string
  image_system_name?: string
  is_manually_completed: boolean
  progress_data?: Record<string, any>
  created_at?: string
}

export interface Activity {
  id: string
  goal_id?: string
  title: string
  icon_name: string
  activity_type?: string
  data?: Record<string, any>
  created_at?: string
}

export interface DailyNutrition {
  day_est: string
  calories_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface NutritionEntry {
  id?: string
  start_at: string
  end_at: string
  kind: string
  value: number
  unit: string
  source: string
  sample_uuid: string
  created_at?: string
}

export interface ChatThread {
  id: string
  title: string
  topic?: string
  summary?: string
  created_at?: string
  updated_at?: string
}

export interface ChatMessage {
  id: string
  thread_id: string
  sender: 'user' | 'brock'
  content: string
  metadata?: Record<string, any>
  created_at?: string
}

export interface APIResponse<T = any> {
  data?: T
  error?: string
  message?: string
}

