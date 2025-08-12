-- Strava Integration Migration for Single User
-- Run this in your Supabase SQL editor

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_strava_config_singleton') THEN
    CREATE UNIQUE INDEX idx_strava_config_singleton ON strava_config ((1));
  END IF;
END $$;

-- Add strava_id to activities table directly (no separate mapping table needed)
DO $$ 
BEGIN
  -- Add strava_id column to activities if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'strava_id') THEN
    ALTER TABLE activities ADD COLUMN strava_id BIGINT UNIQUE;
  END IF;
END $$;

-- Index for strava_id lookups
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_activities_strava_id') THEN
    CREATE INDEX idx_activities_strava_id ON activities(strava_id);
  END IF;
END $$;

-- RLS policy for strava_config
ALTER TABLE strava_config ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy to avoid conflicts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all operations on strava_config' AND tablename = 'strava_config') THEN
    DROP POLICY "Allow all operations on strava_config" ON strava_config;
  END IF;
  CREATE POLICY "Allow all operations on strava_config" ON strava_config FOR ALL USING (true);
END $$;

-- Clean up old tables if they exist (from previous implementation)
DROP TABLE IF EXISTS strava_activities;
DROP TABLE IF EXISTS strava_auth;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Strava migration completed successfully!';
END $$;
