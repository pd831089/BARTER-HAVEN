-- Fix user_push_tokens table structure
-- This migration ensures the table exists with the correct columns

-- Create user_push_tokens table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_push_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    push_token TEXT NOT NULL,
    platform TEXT DEFAULT 'unknown',
    device_type TEXT NOT NULL DEFAULT 'unknown',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, push_token)
);

-- Add platform column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_push_tokens' 
        AND column_name = 'platform'
    ) THEN
        ALTER TABLE user_push_tokens ADD COLUMN platform TEXT DEFAULT 'unknown';
    END IF;
END $$;

-- Add device_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_push_tokens' 
        AND column_name = 'device_type'
    ) THEN
        ALTER TABLE user_push_tokens ADD COLUMN device_type TEXT NOT NULL DEFAULT 'unknown';
    END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);

-- Enable RLS
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can manage their own push tokens" ON user_push_tokens;
CREATE POLICY "Users can manage their own push tokens" ON user_push_tokens
    FOR ALL USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON user_push_tokens TO authenticated;
GRANT USAGE ON SEQUENCE user_push_tokens_id_seq TO authenticated; 