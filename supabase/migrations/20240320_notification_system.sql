-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'message', 'trade_update', 'match_suggestion', 'trade_reminder', 'general'
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
    messages BOOLEAN DEFAULT TRUE,
    trades BOOLEAN DEFAULT TRUE,
    matches BOOLEAN DEFAULT TRUE,
    reminders BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT TRUE,
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '08:00',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user push tokens table
CREATE TABLE IF NOT EXISTS user_push_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    push_token TEXT NOT NULL,
    device_type VARCHAR(20) NOT NULL, -- 'ios', 'android'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, push_token)
);

-- Create notification delivery log table
CREATE TABLE IF NOT EXISTS notification_delivery_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    push_token TEXT,
    delivery_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_active ON user_push_tokens(is_active);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_notification_id ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_user_id ON notification_delivery_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_status ON notification_delivery_log(delivery_status);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- Create RLS policies for notification preferences
CREATE POLICY "Users can view their own notification preferences"
    ON notification_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
    ON notification_preferences FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
    ON notification_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for user push tokens
CREATE POLICY "Users can view their own push tokens"
    ON user_push_tokens FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens"
    ON user_push_tokens FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push tokens"
    ON user_push_tokens FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for notification delivery log
CREATE POLICY "Users can view their own delivery logs"
    ON notification_delivery_log FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert delivery logs"
    ON notification_delivery_log FOR INSERT
    WITH CHECK (true);

CREATE POLICY "System can update delivery logs"
    ON notification_delivery_log FOR UPDATE
    USING (true);

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_updated_at();

CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_updated_at();

CREATE TRIGGER update_user_push_tokens_updated_at
    BEFORE UPDATE ON user_push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_updated_at();

-- Function to get notification count for user
CREATE OR REPLACE FUNCTION get_user_notification_count(p_user_id UUID)
RETURNS TABLE (
    total_count INTEGER,
    unread_count INTEGER,
    message_count INTEGER,
    trade_count INTEGER,
    match_count INTEGER,
    reminder_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_count,
        COUNT(CASE WHEN read = FALSE THEN 1 END)::INTEGER as unread_count,
        COUNT(CASE WHEN type = 'message' AND read = FALSE THEN 1 END)::INTEGER as message_count,
        COUNT(CASE WHEN type = 'trade_update' AND read = FALSE THEN 1 END)::INTEGER as trade_count,
        COUNT(CASE WHEN type = 'match_suggestion' AND read = FALSE THEN 1 END)::INTEGER as match_count,
        COUNT(CASE WHEN type = 'trade_reminder' AND read = FALSE THEN 1 END)::INTEGER as reminder_count
    FROM notifications
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old notifications (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
    AND read = TRUE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to batch mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_as_read(
    p_user_id UUID,
    p_notification_ids UUID[] DEFAULT NULL,
    p_notification_type VARCHAR(50) DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    IF p_notification_ids IS NOT NULL THEN
        -- Mark specific notifications as read
        UPDATE notifications
        SET read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE user_id = p_user_id
        AND id = ANY(p_notification_ids)
        AND read = FALSE;
    ELSIF p_notification_type IS NOT NULL THEN
        -- Mark all notifications of a specific type as read
        UPDATE notifications
        SET read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE user_id = p_user_id
        AND type = p_notification_type
        AND read = FALSE;
    ELSE
        -- Mark all unread notifications as read
        UPDATE notifications
        SET read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE user_id = p_user_id
        AND read = FALSE;
    END IF;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's active push tokens
CREATE OR REPLACE FUNCTION get_user_push_tokens(p_user_id UUID)
RETURNS TABLE (
    push_token TEXT,
    device_type VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT upt.push_token, upt.device_type
    FROM user_push_tokens upt
    WHERE upt.user_id = p_user_id
    AND upt.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_push_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notification_delivery_log TO authenticated;

GRANT EXECUTE ON FUNCTION get_user_notification_count TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notifications_as_read TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_push_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_notifications TO authenticated; 