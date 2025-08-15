-- Enhanced schema for Brock Brain backend
-- Run this in your Supabase SQL editor
-- This adds new features while preserving existing tables

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add new columns to existing goals table (if they don't exist)
DO $$ 
BEGIN
  -- Add progress_data column to goals if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'goals' AND column_name = 'progress_data') THEN
    ALTER TABLE goals ADD COLUMN progress_data JSONB;
  END IF;
END $$;

-- Add new columns to existing activities table (if they don't exist)
DO $$ 
BEGIN
  -- Add goal_id column to activities if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'goal_id') THEN
    ALTER TABLE activities ADD COLUMN goal_id UUID REFERENCES goals(id);
  END IF;
  
  -- Add activity_type column to activities if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'activity_type') THEN
    ALTER TABLE activities ADD COLUMN activity_type TEXT DEFAULT 'general';
  END IF;
  
  -- Add data column to activities if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'data') THEN
    ALTER TABLE activities ADD COLUMN data JSONB DEFAULT '{}';
  END IF;
END $$;

-- Add unique constraint to nutrition_entries sample_uuid if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'nutrition_entries_sample_uuid_key') THEN
    ALTER TABLE nutrition_entries ADD CONSTRAINT nutrition_entries_sample_uuid_key UNIQUE (sample_uuid);
  END IF;
END $$;

-- Chat Threads (One brain, many threads) - No user_id for personal use
CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT, -- e.g., "Strength block", "Macros tuning"
  summary TEXT, -- Rolling summary updated every 10-20 messages
  flags JSONB DEFAULT '{}', -- Thread flags like {"is_general_checkin": true}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'brock')),
  content TEXT NOT NULL,
  metadata JSONB, -- Tool calls, function results, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_goal_id ON activities(goal_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_threads_updated_at ON chat_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- Enable RLS (Row Level Security) - but keep policies simple for personal use
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_entries ENABLE ROW LEVEL SECURITY;

-- Simple policies for personal use (allow all operations)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goals' AND policyname = 'Allow all operations on goals') THEN
    CREATE POLICY "Allow all operations on goals" ON goals FOR ALL USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activities' AND policyname = 'Allow all operations on activities') THEN
    CREATE POLICY "Allow all operations on activities" ON activities FOR ALL USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_threads' AND policyname = 'Allow all operations on chat_threads') THEN
    CREATE POLICY "Allow all operations on chat_threads" ON chat_threads FOR ALL USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Allow all operations on chat_messages') THEN
    CREATE POLICY "Allow all operations on chat_messages" ON chat_messages FOR ALL USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nutrition_entries' AND policyname = 'Allow all operations on nutrition_entries') THEN
    CREATE POLICY "Allow all operations on nutrition_entries" ON nutrition_entries FOR ALL USING (true);
  END IF;
END $$;

-- Simplified Strava Configuration (single user)
CREATE TABLE IF NOT EXISTS strava_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  athlete_data JSONB,
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Simple constraint - only one config row allowed
CREATE UNIQUE INDEX IF NOT EXISTS idx_strava_config_singleton ON strava_config ((1));

-- Add strava_id to activities table directly (no separate mapping table needed)
DO $$ 
BEGIN
  -- Add strava_id column to activities if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'strava_id') THEN
    ALTER TABLE activities ADD COLUMN strava_id BIGINT UNIQUE;
  END IF;
END $$;

-- Index for strava_id lookups
CREATE INDEX IF NOT EXISTS idx_activities_strava_id ON activities(strava_id);

-- RLS policy for strava_config
ALTER TABLE strava_config ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'strava_config' AND policyname = 'Allow all operations on strava_config') THEN
    CREATE POLICY "Allow all operations on strava_config" ON strava_config FOR ALL USING (true);
  END IF;
END $$;

-- Proactive Check-in Scheduling
CREATE TABLE IF NOT EXISTS daily_checkin_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  morning_time TIME NOT NULL, -- Random between 7:30-10:30 AM ET
  afternoon_time TIME NOT NULL, -- Random between 3-8 PM ET
  morning_sent BOOLEAN DEFAULT FALSE,
  afternoon_sent BOOLEAN DEFAULT FALSE,
  timezone TEXT DEFAULT 'America/New_York', -- ET timezone
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient date lookups
CREATE INDEX IF NOT EXISTS idx_daily_checkin_schedule_date ON daily_checkin_schedule(date);

-- RLS policy for daily_checkin_schedule
ALTER TABLE daily_checkin_schedule ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_checkin_schedule' AND policyname = 'Allow all operations on daily_checkin_schedule') THEN
    CREATE POLICY "Allow all operations on daily_checkin_schedule" ON daily_checkin_schedule FOR ALL USING (true);
  END IF;
END $$;

-- Device tokens for Apple Push Notifications (APNs)
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_token TEXT NOT NULL UNIQUE,
  user_id TEXT DEFAULT 'default_user',
  platform TEXT NOT NULL DEFAULT 'ios', -- 'ios' or 'android'
  device_info JSONB DEFAULT '{}', -- Device model, OS version, etc.
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(device_token)
);

-- Indexes for device tokens
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_is_active ON device_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON device_tokens(platform);

-- RLS policy for device_tokens
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'device_tokens' AND policyname = 'Allow all operations on device_tokens') THEN
    CREATE POLICY "Allow all operations on device_tokens" ON device_tokens FOR ALL USING (true);
  END IF;
END $$;

