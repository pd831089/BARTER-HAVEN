-- Drop existing functions and triggers first
DROP FUNCTION IF EXISTS remove_item CASCADE;
DROP FUNCTION IF EXISTS update_item_status CASCADE;
DROP TRIGGER IF EXISTS trigger_update_item_status ON trade_proposals;

-- Store existing policies (we'll recreate them later)
DO $$ 
BEGIN
    -- Drop all policies on items table
    DROP POLICY IF EXISTS "Anyone can view active items" ON items;
    DROP POLICY IF EXISTS "Users can insert their own items" ON items;
    DROP POLICY IF EXISTS "Users can update their own items" ON items;
    DROP POLICY IF EXISTS "Users can delete their own items" ON items;
END $$;

-- Drop existing enum if it exists
DROP TYPE IF EXISTS item_status CASCADE;

-- Create enum for item status
CREATE TYPE item_status AS ENUM (
    'available',
    'proposed',
    'bartered',
    'removed'
);

-- First, ensure all existing statuses are valid
UPDATE items
SET status = LOWER(status)
WHERE status IS NOT NULL;

UPDATE items
SET status = 'available'
WHERE status IS NULL OR status NOT IN ('available', 'proposed', 'bartered', 'removed');

-- Create a temporary column with the new type
ALTER TABLE items 
    ADD COLUMN status_new item_status;

-- Update the new column with converted values
UPDATE items 
SET status_new = status::item_status;

-- Drop the old column
ALTER TABLE items 
    DROP COLUMN status;

-- Rename the new column
ALTER TABLE items 
    RENAME COLUMN status_new TO status;

-- Add NOT NULL constraint and default value
ALTER TABLE items 
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN status SET DEFAULT 'available'::item_status;

-- Recreate RLS policies
CREATE POLICY "Anyone can view active items" ON items
    FOR SELECT
    USING (status != 'removed'::item_status);

CREATE POLICY "Users can insert their own items" ON items
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own items" ON items
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own items" ON items
    FOR DELETE
    USING (auth.uid() = user_id);

-- Function to handle item removal
CREATE OR REPLACE FUNCTION remove_item(p_item_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE items
    SET 
        status = 'removed'::item_status,
        updated_at = CURRENT_TIMESTAMP
    WHERE 
        id = p_item_id 
        AND items.user_id = p_user_id
        AND status != 'removed'::item_status;
    
    -- Cancel any pending trade proposals for this item
    UPDATE trade_proposals
    SET 
        status = 'cancelled',
        updated_at = CURRENT_TIMESTAMP
    WHERE 
        item_id = p_item_id 
        AND status = 'pending';
        
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update item status based on trade proposals
CREATE OR REPLACE FUNCTION update_item_status()
RETURNS TRIGGER AS $$
BEGIN
    -- When a trade proposal is created or updated
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- If the proposal is accepted, mark item as bartered
        IF NEW.status = 'accepted' THEN
            UPDATE items 
            SET 
                status = 'bartered'::item_status,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.item_id;
            
            -- Cancel other pending proposals for this item
            UPDATE trade_proposals
            SET 
                status = 'cancelled',
                updated_at = CURRENT_TIMESTAMP
            WHERE 
                item_id = NEW.item_id 
                AND id != NEW.id
                AND status = 'pending';
                
        -- If the proposal is pending, mark item as proposed
        ELSIF NEW.status = 'pending' THEN
            UPDATE items 
            SET 
                status = 'proposed'::item_status,
                updated_at = CURRENT_TIMESTAMP
            WHERE 
                id = NEW.item_id
                AND status = 'available'::item_status;
                
        -- If the proposal is rejected/cancelled and no other pending proposals exist
        ELSIF (NEW.status = 'rejected' OR NEW.status = 'cancelled') THEN
            -- Check if there are any other pending proposals for this item
            IF NOT EXISTS (
                SELECT 1 
                FROM trade_proposals 
                WHERE 
                    item_id = NEW.item_id 
                    AND status = 'pending'
                    AND id != NEW.id
            ) THEN
                UPDATE items 
                SET 
                    status = 'available'::item_status,
                    updated_at = CURRENT_TIMESTAMP
                WHERE 
                    id = NEW.item_id
                    AND status = 'proposed'::item_status;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on trade_proposals table
CREATE TRIGGER trigger_update_item_status
    AFTER INSERT OR UPDATE ON trade_proposals
    FOR EACH ROW
    EXECUTE FUNCTION update_item_status();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_user_id_status ON items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_trade_proposals_item_id_status ON trade_proposals(item_id, status);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION remove_item TO authenticated;
GRANT EXECUTE ON FUNCTION update_item_status TO authenticated;

-- Function to get item status
CREATE OR REPLACE FUNCTION get_item_status(p_item_id UUID)
RETURNS item_status AS $$
DECLARE
    v_status item_status;
BEGIN
    SELECT status INTO v_status
    FROM items
    WHERE id = p_item_id;
    RETURN v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission to check item status
GRANT EXECUTE ON FUNCTION get_item_status TO authenticated; 