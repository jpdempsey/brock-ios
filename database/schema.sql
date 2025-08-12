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
CREATE POLICY "Allow all operations on goals" ON goals FOR ALL USING (true);
CREATE POLICY "Allow all operations on activities" ON activities FOR ALL USING (true);
CREATE POLICY "Allow all operations on chat_threads" ON chat_threads FOR ALL USING (true);
CREATE POLICY "Allow all operations on chat_messages" ON chat_messages FOR ALL USING (true);
CREATE POLICY "Allow all operations on nutrition_entries" ON nutrition_entries FOR ALL USING (true);

