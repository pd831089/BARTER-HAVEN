-- Drop the table if it exists
DROP TABLE IF EXISTS trade_proposals;

-- Create trade_proposals table
CREATE TABLE trade_proposals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    proposer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    proposed_item_description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for faster lookups
CREATE INDEX idx_trade_proposals_item_id ON trade_proposals(item_id);
CREATE INDEX idx_trade_proposals_proposer_id ON trade_proposals(proposer_id);
CREATE INDEX idx_trade_proposals_status ON trade_proposals(status);

-- Enable RLS
ALTER TABLE trade_proposals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own proposals"
    ON trade_proposals FOR SELECT
    USING (
        proposer_id = auth.uid() OR
        item_id IN (SELECT id FROM items WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can propose trades"
    ON trade_proposals FOR INSERT
    WITH CHECK (
        proposer_id = auth.uid() AND
        item_id NOT IN (SELECT id FROM items WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can update their own proposals"
    ON trade_proposals FOR UPDATE
    USING (
        proposer_id = auth.uid() OR
        item_id IN (SELECT id FROM items WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can delete their own proposals"
    ON trade_proposals FOR DELETE
    USING (proposer_id = auth.uid());

-- Grant necessary permissions
GRANT ALL ON trade_proposals TO authenticated; 