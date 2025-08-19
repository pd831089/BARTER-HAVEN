-- Post-Negotiation Features Migration
-- This migration adds comprehensive post-negotiation functionality

-- Create delivery method enum
CREATE TYPE delivery_method AS ENUM ('meetup', 'shipping', 'digital');

-- Create trade_details table for delivery and contact information
CREATE TABLE IF NOT EXISTS trade_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE NOT NULL,
    delivery_method delivery_method NOT NULL,
    meetup_location TEXT,
    meetup_date_time TIMESTAMP WITH TIME ZONE,
    shipping_address TEXT,
    tracking_number TEXT,
    contact_info JSONB, -- Store phone, email, etc.
    delivery_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(trade_id)
);

-- Create trade_reviews table for mutual reviews after trade completion
CREATE TABLE IF NOT EXISTS trade_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE NOT NULL,
    reviewer_id UUID REFERENCES users(id) NOT NULL,
    reviewed_user_id UUID REFERENCES users(id) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(trade_id, reviewer_id, reviewed_user_id)
);

-- Create trade_disputes table (enhanced version)
CREATE TABLE IF NOT EXISTS trade_disputes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trade_id UUID REFERENCES trades(id) ON DELETE CASCADE NOT NULL,
    reported_by UUID REFERENCES users(id) NOT NULL,
    reason TEXT NOT NULL,
    description TEXT,
    evidence_urls TEXT[], -- Array of evidence file URLs
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
    resolution TEXT,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trade_details_trade_id ON trade_details(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_reviews_trade_id ON trade_reviews(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_reviews_reviewer ON trade_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_trade_reviews_reviewed ON trade_reviews(reviewed_user_id);
CREATE INDEX IF NOT EXISTS idx_trade_disputes_trade_id ON trade_disputes(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_disputes_reported_by ON trade_disputes(reported_by);
CREATE INDEX IF NOT EXISTS idx_trade_disputes_status ON trade_disputes(status);

-- Function to create trade details
CREATE OR REPLACE FUNCTION create_trade_details(
    p_trade_id UUID,
    p_delivery_method delivery_method,
    p_meetup_location TEXT DEFAULT NULL,
    p_meetup_date_time TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_shipping_address TEXT DEFAULT NULL,
    p_tracking_number TEXT DEFAULT NULL,
    p_contact_info JSONB DEFAULT NULL,
    p_delivery_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_details_id UUID;
BEGIN
    INSERT INTO trade_details (
        trade_id,
        delivery_method,
        meetup_location,
        meetup_date_time,
        shipping_address,
        tracking_number,
        contact_info,
        delivery_notes
    ) VALUES (
        p_trade_id,
        p_delivery_method,
        p_meetup_location,
        p_meetup_date_time,
        p_shipping_address,
        p_tracking_number,
        p_contact_info,
        p_delivery_notes
    ) RETURNING id INTO v_details_id;
    
    RETURN v_details_id;
END;
$$ LANGUAGE plpgsql;

-- Function to submit trade review
CREATE OR REPLACE FUNCTION submit_trade_review(
    p_trade_id UUID,
    p_reviewer_id UUID,
    p_reviewed_user_id UUID,
    p_rating INTEGER,
    p_comment TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_review_id UUID;
    v_trade_status trade_status;
BEGIN
    -- Check if trade is completed
    SELECT status INTO v_trade_status
    FROM trades
    WHERE id = p_trade_id;
    
    IF v_trade_status != 'completed' THEN
        RAISE EXCEPTION 'Trade must be completed before submitting review';
    END IF;
    
    -- Check if user is part of the trade
    IF NOT EXISTS (
        SELECT 1 FROM trades 
        WHERE id = p_trade_id 
        AND (proposer_id = p_reviewer_id OR receiver_id = p_reviewer_id)
    ) THEN
        RAISE EXCEPTION 'User is not part of this trade';
    END IF;
    
    -- Check if user is reviewing the other party
    IF p_reviewer_id = p_reviewed_user_id THEN
        RAISE EXCEPTION 'Cannot review yourself';
    END IF;
    
    INSERT INTO trade_reviews (
        trade_id,
        reviewer_id,
        reviewed_user_id,
        rating,
        comment
    ) VALUES (
        p_trade_id,
        p_reviewer_id,
        p_reviewed_user_id,
        p_rating,
        p_comment
    ) ON CONFLICT (trade_id, reviewer_id, reviewed_user_id) 
    DO UPDATE SET
        rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO v_review_id;
    
    -- Update user's average rating
    UPDATE users
    SET 
        rating = (
            SELECT AVG(rating)::DECIMAL(3,2)
            FROM trade_reviews
            WHERE reviewed_user_id = p_reviewed_user_id
        ),
        total_ratings = (
            SELECT COUNT(*)
            FROM trade_reviews
            WHERE reviewed_user_id = p_reviewed_user_id
        )
    WHERE id = p_reviewed_user_id;
    
    RETURN v_review_id;
END;
$$ LANGUAGE plpgsql;

-- Function to report trade dispute
CREATE OR REPLACE FUNCTION report_trade_dispute(
    p_trade_id UUID,
    p_reported_by UUID,
    p_reason TEXT,
    p_description TEXT DEFAULT NULL,
    p_evidence_urls TEXT[] DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_dispute_id UUID;
    v_trade_status trade_status;
BEGIN
    -- Check if trade exists and user is part of it
    SELECT status INTO v_trade_status
    FROM trades
    WHERE id = p_trade_id 
    AND (proposer_id = p_reported_by OR receiver_id = p_reported_by);
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trade not found or user not part of trade';
    END IF;
    
    -- Check if dispute already exists
    IF EXISTS (
        SELECT 1 FROM trade_disputes 
        WHERE trade_id = p_trade_id 
        AND reported_by = p_reported_by
        AND status IN ('open', 'investigating')
    ) THEN
        RAISE EXCEPTION 'Dispute already reported for this trade';
    END IF;
    
    INSERT INTO trade_disputes (
        trade_id,
        reported_by,
        reason,
        description,
        evidence_urls
    ) VALUES (
        p_trade_id,
        p_reported_by,
        p_reason,
        p_description,
        p_evidence_urls
    ) RETURNING id INTO v_dispute_id;
    
    -- Update trade status to disputed
    UPDATE trades
    SET status = 'disputed'
    WHERE id = p_trade_id;
    
    RETURN v_dispute_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get trade completion summary
CREATE OR REPLACE FUNCTION get_trade_completion_summary(p_trade_id UUID)
RETURNS TABLE (
    trade_id UUID,
    proposer_id UUID,
    receiver_id UUID,
    offered_item_title TEXT,
    requested_item_title TEXT,
    delivery_method delivery_method,
    meetup_location TEXT,
    meetup_date_time TIMESTAMP WITH TIME ZONE,
    shipping_address TEXT,
    tracking_number TEXT,
    contact_info JSONB,
    delivery_notes TEXT,
    proposer_review_rating INTEGER,
    receiver_review_rating INTEGER,
    dispute_status VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.proposer_id,
        t.receiver_id,
        oi.title as offered_item_title,
        ri.title as requested_item_title,
        td.delivery_method,
        td.meetup_location,
        td.meetup_date_time,
        td.shipping_address,
        td.tracking_number,
        td.contact_info,
        td.delivery_notes,
        pr.rating as proposer_review_rating,
        rr.rating as receiver_review_rating,
        d.status as dispute_status
    FROM trades t
    LEFT JOIN items oi ON t.offered_item_id = oi.id
    LEFT JOIN items ri ON t.requested_item_id = ri.id
    LEFT JOIN trade_details td ON t.id = td.trade_id
    LEFT JOIN trade_reviews pr ON t.id = pr.trade_id AND pr.reviewer_id = t.proposer_id
    LEFT JOIN trade_reviews rr ON t.id = rr.trade_id AND rr.reviewer_id = t.receiver_id
    LEFT JOIN trade_disputes d ON t.id = d.trade_id AND d.status IN ('open', 'investigating')
    WHERE t.id = p_trade_id;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON trade_details TO authenticated;
GRANT SELECT, INSERT, UPDATE ON trade_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE ON trade_disputes TO authenticated;

GRANT EXECUTE ON FUNCTION create_trade_details TO authenticated;
GRANT EXECUTE ON FUNCTION submit_trade_review TO authenticated;
GRANT EXECUTE ON FUNCTION report_trade_dispute TO authenticated;
GRANT EXECUTE ON FUNCTION get_trade_completion_summary TO authenticated;

-- Enable RLS
ALTER TABLE trade_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_disputes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trade_details
CREATE POLICY "Users can view trade details for their trades"
    ON trade_details FOR SELECT
    USING (
        trade_id IN (
            SELECT id FROM trades 
            WHERE proposer_id = auth.uid() OR receiver_id = auth.uid()
        )
    );

CREATE POLICY "Users can create trade details for their trades"
    ON trade_details FOR INSERT
    WITH CHECK (
        trade_id IN (
            SELECT id FROM trades 
            WHERE proposer_id = auth.uid() OR receiver_id = auth.uid()
        )
    );

CREATE POLICY "Users can update trade details for their trades"
    ON trade_details FOR UPDATE
    USING (
        trade_id IN (
            SELECT id FROM trades 
            WHERE proposer_id = auth.uid() OR receiver_id = auth.uid()
        )
    );

-- RLS Policies for trade_reviews
CREATE POLICY "Users can view reviews for their trades"
    ON trade_reviews FOR SELECT
    USING (
        trade_id IN (
            SELECT id FROM trades 
            WHERE proposer_id = auth.uid() OR receiver_id = auth.uid()
        )
    );

CREATE POLICY "Users can create reviews for completed trades"
    ON trade_reviews FOR INSERT
    WITH CHECK (
        reviewer_id = auth.uid() AND
        trade_id IN (
            SELECT id FROM trades 
            WHERE (proposer_id = auth.uid() OR receiver_id = auth.uid())
            AND status = 'completed'
        )
    );

CREATE POLICY "Users can update their own reviews"
    ON trade_reviews FOR UPDATE
    USING (reviewer_id = auth.uid());

-- RLS Policies for trade_disputes
CREATE POLICY "Users can view disputes for their trades"
    ON trade_disputes FOR SELECT
    USING (
        trade_id IN (
            SELECT id FROM trades 
            WHERE proposer_id = auth.uid() OR receiver_id = auth.uid()
        )
    );

CREATE POLICY "Users can create disputes for their trades"
    ON trade_disputes FOR INSERT
    WITH CHECK (
        reported_by = auth.uid() AND
        trade_id IN (
            SELECT id FROM trades 
            WHERE proposer_id = auth.uid() OR receiver_id = auth.uid()
        )
    );

CREATE POLICY "Users can update disputes they reported"
    ON trade_disputes FOR UPDATE
    USING (reported_by = auth.uid()); 