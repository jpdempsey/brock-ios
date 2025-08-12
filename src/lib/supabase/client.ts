import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Fallback to hardcoded values for development if env vars not loaded
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nssulhixlseydkmnbbku.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zc3VsaGl4bHNleWRrbW5iYmt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MjM1OTIsImV4cCI6MjA2OTk5OTU5Mn0.x_VNbwYOhhxTTEB0D0_3zdMpOukHTsGPfdRyuOtYg9E'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Please check your environment variables.')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Server-side client with service role key for admin operations
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

