-- Drop existing tables and policies
DROP TABLE IF EXISTS chat_participants CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create messages table
CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'text',
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT different_users CHECK (sender_id != receiver_id)
);

-- Create indexes
CREATE INDEX idx_messages_sender_receiver ON messages(sender_id, receiver_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

-- Create simple policies
CREATE POLICY "Users can view messages they're involved in"
    ON messages FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages"
    ON messages FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own sent messages"
    ON messages FOR UPDATE
    USING (auth.uid() = sender_id);

-- First check and remove if table is already in publication
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE messages;
    END IF;
END
$$;

-- Now add the table to publication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Ensure replication is enabled for the messages table
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Drop any existing triggers
DROP TRIGGER IF EXISTS on_message_created ON messages;
DROP TRIGGER IF EXISTS on_message_updated ON messages;

-- Create trigger function for message changes
CREATE OR REPLACE FUNCTION handle_message_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Broadcast the new message
    PERFORM pg_notify('supabase_realtime', json_build_object(
      'type', 'INSERT',
      'table', 'messages',
      'record', row_to_json(NEW)
    )::text);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Broadcast the updated message
    PERFORM pg_notify('supabase_realtime', json_build_object(
      'type', 'UPDATE',
      'table', 'messages',
      'record', row_to_json(NEW)
    )::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for realtime
CREATE TRIGGER on_message_created
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION handle_message_change();

CREATE TRIGGER on_message_updated
  AFTER UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION handle_message_change();

-- Add soft delete column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END
$$;

-- Update RLS policies to handle soft delete
DROP POLICY IF EXISTS "Users can view messages they're involved in" ON messages;
CREATE POLICY "Users can view messages they're involved in"
    ON messages FOR SELECT
    USING (
        (auth.uid() = sender_id OR auth.uid() = receiver_id)
        AND deleted_at IS NULL
    );

-- Add policy for soft delete if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_policies 
        WHERE policyname = 'Users can soft delete their own messages'
        AND tablename = 'messages'
    ) THEN
        CREATE POLICY "Users can soft delete their own messages"
            ON messages FOR UPDATE
            USING (auth.uid() = sender_id)
            WITH CHECK (auth.uid() = sender_id);
    END IF;
END
$$;

-- Function to soft delete a message
CREATE OR REPLACE FUNCTION soft_delete_message(message_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE messages
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = message_id AND sender_id = user_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT ALL ON messages TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_message TO authenticated;
GRANT EXECUTE ON FUNCTION handle_message_change TO authenticated;

-- Create function to get chat participants for a user
CREATE OR REPLACE FUNCTION get_chat_participants(user_id UUID)
RETURNS TABLE (
    participant_id UUID,
    last_message_at TIMESTAMP WITH TIME ZONE,
    unread_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH chat_users AS (
        SELECT DISTINCT
            CASE 
                WHEN sender_id = user_id THEN receiver_id
                ELSE sender_id
            END AS participant_id,
            MAX(created_at) as last_message_at
        FROM messages
        WHERE sender_id = user_id OR receiver_id = user_id
        GROUP BY 
            CASE 
                WHEN sender_id = user_id THEN receiver_id
                ELSE sender_id
            END
    ),
    unread_messages AS (
        SELECT 
            sender_id as participant_id,
            COUNT(*) as unread_count
        FROM messages
        WHERE receiver_id = user_id AND read_at IS NULL
        GROUP BY sender_id
    )
    SELECT 
        cu.participant_id,
        cu.last_message_at,
        COALESCE(um.unread_count, 0) as unread_count
    FROM chat_users cu
    LEFT JOIN unread_messages um ON um.participant_id = cu.participant_id
    ORDER BY cu.last_message_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_chat_participants TO authenticated; 