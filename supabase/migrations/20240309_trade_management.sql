-- Drop existing enum type if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trade_status') THEN
        -- Drop dependent objects first
        DROP TABLE IF EXISTS trade_history;
        DROP TABLE IF EXISTS trade_messages;
        DROP TABLE IF EXISTS user_ratings;  -- Drop user_ratings first as it depends on trades
        DROP TABLE IF EXISTS trades;
        DROP TYPE trade_status;
    END IF;
END $$;

-- Create enum for trade status
CREATE TYPE trade_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'cancelled',
    'completed',
    'disputed'
);

-- Create trades table
CREATE TABLE IF NOT EXISTS trades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    proposer_id UUID REFERENCES users(id) NOT NULL,
    receiver_id UUID REFERENCES users(id) NOT NULL,
    offered_item_id UUID REFERENCES items(id) NOT NULL,
    requested_item_id UUID REFERENCES items(id) NOT NULL,
    status trade_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completion_date TIMESTAMP WITH TIME ZONE,
    proposer_confirmed BOOLEAN DEFAULT FALSE,
    receiver_confirmed BOOLEAN DEFAULT FALSE,
    cancellation_reason TEXT,
    dispute_reason TEXT,
    dispute_resolution TEXT,
    trade_notes TEXT,
    CONSTRAINT different_users CHECK (proposer_id != receiver_id),
    CONSTRAINT different_items CHECK (offered_item_id != requested_item_id)
);

-- Create trade_messages table for communication
CREATE TABLE IF NOT EXISTS trade_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_system_message BOOLEAN DEFAULT FALSE
);

-- Create trade_history table for tracking status changes
CREATE TABLE IF NOT EXISTS trade_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
    previous_status trade_status,
    new_status trade_status NOT NULL,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
);

-- Function to update trade status and record in history
CREATE OR REPLACE FUNCTION update_trade_status(
    p_trade_id UUID,
    p_new_status trade_status,
    p_changed_by UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_previous_status trade_status;
BEGIN
    -- Get current status
    SELECT status INTO v_previous_status
    FROM trades
    WHERE id = p_trade_id;

    -- Update trade status
    UPDATE trades
    SET 
        status = p_new_status,
        updated_at = CURRENT_TIMESTAMP,
        completion_date = CASE 
            WHEN p_new_status = 'completed' THEN CURRENT_TIMESTAMP
            ELSE completion_date
        END
    WHERE id = p_trade_id;

    -- Record in history
    INSERT INTO trade_history (
        trade_id,
        previous_status,
        new_status,
        changed_by,
        reason
    ) VALUES (
        p_trade_id,
        v_previous_status,
        p_new_status,
        p_changed_by,
        p_reason
    );

    -- If trade is completed, update users' successful_trades count
    IF p_new_status = 'completed' THEN
        WITH trade_users AS (
            SELECT proposer_id, receiver_id
            FROM trades
            WHERE id = p_trade_id
        )
        UPDATE users
        SET successful_trades = successful_trades + 1
        WHERE id IN (
            SELECT proposer_id FROM trade_users
            UNION
            SELECT receiver_id FROM trade_users
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to confirm trade completion
CREATE OR REPLACE FUNCTION confirm_trade_completion(
    p_trade_id UUID,
    p_user_id UUID
)
RETURNS boolean AS $$
DECLARE
    v_trade trades;
BEGIN
    -- Get trade details
    SELECT * INTO v_trade
    FROM trades
    WHERE id = p_trade_id;

    -- Verify trade exists and is in accepted status
    IF NOT FOUND OR v_trade.status != 'accepted' THEN
        RETURN FALSE;
    END IF;

    -- Update confirmation based on user role
    IF p_user_id = v_trade.proposer_id THEN
        UPDATE trades
        SET proposer_confirmed = TRUE
        WHERE id = p_trade_id;
    ELSIF p_user_id = v_trade.receiver_id THEN
        UPDATE trades
        SET receiver_confirmed = TRUE
        WHERE id = p_trade_id;
    ELSE
        RETURN FALSE;
    END IF;

    -- Check if both parties have confirmed
    IF EXISTS (
        SELECT 1
        FROM trades
        WHERE id = p_trade_id
        AND proposer_confirmed = TRUE
        AND receiver_confirmed = TRUE
    ) THEN
        -- Complete the trade
        PERFORM update_trade_status(
            p_trade_id,
            'completed'::trade_status,
            p_user_id,
            'Both parties confirmed completion'
        );
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_trades_proposer_id;
DROP INDEX IF EXISTS idx_trades_receiver_id;
DROP INDEX IF EXISTS idx_trades_status;
DROP INDEX IF EXISTS idx_trade_messages_trade_id;
DROP INDEX IF EXISTS idx_trade_history_trade_id;

-- Create indexes for better performance
CREATE INDEX idx_trades_proposer_id ON trades(proposer_id);
CREATE INDEX idx_trades_receiver_id ON trades(receiver_id);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trade_messages_trade_id ON trade_messages(trade_id);
CREATE INDEX idx_trade_history_trade_id ON trade_history(trade_id);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON trades TO authenticated;
GRANT SELECT, INSERT ON trade_messages TO authenticated;
GRANT SELECT ON trade_history TO authenticated;

-- Grant sequence permissions if they exist
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'trades_id_seq') THEN
        GRANT USAGE ON SEQUENCE trades_id_seq TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'trade_messages_id_seq') THEN
        GRANT USAGE ON SEQUENCE trade_messages_id_seq TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'trade_history_id_seq') THEN
        GRANT USAGE ON SEQUENCE trade_history_id_seq TO authenticated;
    END IF;
END $$; 