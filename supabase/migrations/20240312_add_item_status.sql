-- Add status column to items table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'status') THEN
        ALTER TABLE items ADD COLUMN status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'proposed', 'bartered', 'removed'));
    END IF;
END $$;

-- Create index for status
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);

-- Function to update item status based on trade proposals
CREATE OR REPLACE FUNCTION update_item_status()
RETURNS TRIGGER AS $$
BEGIN
    -- When a trade proposal is created or updated
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- If the proposal is accepted, mark item as bartered
        IF NEW.status = 'accepted' THEN
            UPDATE items SET status = 'bartered' WHERE id = NEW.item_id;
        -- If the proposal is pending, mark item as proposed
        ELSIF NEW.status = 'pending' THEN
            UPDATE items SET status = 'proposed' WHERE id = NEW.item_id;
        -- If the proposal is rejected/cancelled and no other pending proposals exist
        ELSIF (NEW.status = 'rejected' OR NEW.status = 'cancelled') THEN
            -- Check if there are any other pending proposals for this item
            IF NOT EXISTS (
                SELECT 1 FROM trade_proposals 
                WHERE item_id = NEW.item_id 
                AND status = 'pending'
                AND id != NEW.id
            ) THEN
                UPDATE items SET status = 'available' WHERE id = NEW.item_id;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on trade_proposals table
DROP TRIGGER IF EXISTS trigger_update_item_status ON trade_proposals;
CREATE TRIGGER trigger_update_item_status
    AFTER INSERT OR UPDATE ON trade_proposals
    FOR EACH ROW
    EXECUTE FUNCTION update_item_status();

-- Function to handle item removal
CREATE OR REPLACE FUNCTION remove_item(item_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE items
    SET status = 'removed'
    WHERE id = item_id AND items.user_id = user_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION remove_item TO authenticated; 