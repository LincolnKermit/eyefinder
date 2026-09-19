-- EyeFinder Database Schema for Supabase / PostgreSQL
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS cameras (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    stream_url TEXT NOT NULL,
    source TEXT DEFAULT 'public',
    status TEXT DEFAULT 'operational' CHECK (status IN ('operational', 'down')),
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast spatial and status filtering
CREATE INDEX IF NOT EXISTS idx_cameras_status ON cameras(status);
CREATE INDEX IF NOT EXISTS idx_cameras_coords ON cameras(latitude, longitude);

-- Enable Row Level Security (RLS)
ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for Vercel serverless / public map)
CREATE POLICY "Allow public read on cameras" ON cameras
    FOR SELECT
    USING (true);

-- Allow authenticated or service role write/update
CREATE POLICY "Allow service role write on cameras" ON cameras
    FOR ALL
    USING (true);
