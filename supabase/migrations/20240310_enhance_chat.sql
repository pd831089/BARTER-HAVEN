-- Drop existing storage policies first
DROP POLICY IF EXISTS "Allow authenticated users to upload chat images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read chat images" ON storage.objects;

-- Add new columns to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'text',
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reactions JSONB;

-- Create table for message reactions
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reaction VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id, reaction)
);

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS toggle_message_reaction CASCADE;
DROP FUNCTION IF EXISTS get_message_reactions CASCADE;

-- Create function to toggle message reaction
CREATE OR REPLACE FUNCTION toggle_message_reaction(
    p_message_id UUID,
    p_user_id UUID,
    p_reaction VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- Check if reaction exists
    SELECT EXISTS (
        SELECT 1 
        FROM message_reactions 
        WHERE message_id = p_message_id 
        AND user_id = p_user_id 
        AND reaction = p_reaction
    ) INTO v_exists;

    IF v_exists THEN
        -- Remove reaction
        DELETE FROM message_reactions 
        WHERE message_id = p_message_id 
        AND user_id = p_user_id 
        AND reaction = p_reaction;
        RETURN FALSE;
    ELSE
        -- Add reaction
        INSERT INTO message_reactions (message_id, user_id, reaction)
        VALUES (p_message_id, p_user_id, p_reaction);
        RETURN TRUE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to get message reactions
CREATE OR REPLACE FUNCTION get_message_reactions(p_message_id UUID)
RETURNS TABLE (
    reaction VARCHAR,
    count BIGINT,
    users JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mr.reaction,
        COUNT(*) as count,
        jsonb_agg(jsonb_build_object(
            'id', u.id,
            'name', u.name,
            'email', u.email
        )) as users
    FROM message_reactions mr
    JOIN users u ON u.id = mr.user_id
    WHERE mr.message_id = p_message_id
    GROUP BY mr.reaction;
END;
$$ LANGUAGE plpgsql;

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_message_reactions_message_id;
DROP INDEX IF EXISTS idx_message_reactions_user_id;
DROP INDEX IF EXISTS idx_messages_read_at;
DROP INDEX IF EXISTS idx_messages_type;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON messages(read_at);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON message_reactions TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_message_reaction TO authenticated;
GRANT EXECUTE ON FUNCTION get_message_reactions TO authenticated;

-- Create storage bucket for chat images if it doesn't exist
INSERT INTO storage.buckets (id, name)
VALUES ('chat_images', 'chat_images')
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for chat images
CREATE POLICY "Allow authenticated users to upload chat images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'chat_images' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Allow authenticated users to read chat images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat_images');

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; 