-- Add new columns to items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS condition TEXT CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')) DEFAULT 'good',
ADD COLUMN IF NOT EXISTS popularity_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create saved matches table
CREATE TABLE IF NOT EXISTS saved_matches (
    user_id UUID REFERENCES auth.users(id),
    item_id UUID REFERENCES items(id),
    matched_item_id UUID REFERENCES items(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, item_id, matched_item_id)
);

-- Create user trade stats table
CREATE TABLE IF NOT EXISTS user_trade_stats (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    successful_trades INTEGER DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    category_preferences JSONB DEFAULT '{}',
    value_range_preferences JSONB DEFAULT '{"min": 0, "max": 1000000}',
    condition_preferences TEXT[] DEFAULT ARRAY['new', 'like_new', 'good'],
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Function to update item popularity score
CREATE OR REPLACE FUNCTION update_item_popularity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE items 
    SET popularity_score = popularity_score + 1
    WHERE id = NEW.item_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating item popularity
CREATE TRIGGER item_view_trigger
    AFTER INSERT ON trade_proposals
    FOR EACH ROW
    EXECUTE FUNCTION update_item_popularity();

-- Function to update user trade stats
CREATE OR REPLACE FUNCTION update_user_trade_stats()
RETURNS TRIGGER AS $$
DECLARE
    item_category TEXT;
    item_value DECIMAL;
BEGIN
    -- Update trade counts
    INSERT INTO user_trade_stats (user_id, successful_trades, total_trades)
    VALUES (NEW.proposer_id, 1, 1)
    ON CONFLICT (user_id) DO UPDATE
    SET 
        successful_trades = CASE 
            WHEN NEW.status = 'completed' 
            THEN user_trade_stats.successful_trades + 1 
            ELSE user_trade_stats.successful_trades 
        END,
        total_trades = user_trade_stats.total_trades + 1;

    -- Update category preferences if trade is completed
    IF NEW.status = 'completed' THEN
        SELECT category, estimated_value 
        INTO item_category, item_value
        FROM items 
        WHERE id = NEW.offered_item_id;

        UPDATE user_trade_stats
        SET 
            category_preferences = COALESCE(category_preferences, '{}'::jsonb) || 
                jsonb_build_object(item_category, 
                    COALESCE((category_preferences->>item_category)::int, 0) + 1),
            value_range_preferences = jsonb_build_object(
                'min', LEAST(
                    (value_range_preferences->>'min')::decimal, 
                    item_value
                ),
                'max', GREATEST(
                    (value_range_preferences->>'max')::decimal, 
                    item_value
                )
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = NEW.proposer_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating user trade stats
CREATE TRIGGER trade_stats_trigger
    AFTER INSERT OR UPDATE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION update_user_trade_stats();

-- Enhanced matching function with new factors
CREATE OR REPLACE FUNCTION calculate_enhanced_match_score(
    item1_id UUID,
    item2_id UUID,
    user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    match_score FLOAT,
    match_reasons JSONB
) AS $$
DECLARE
    item1 items;
    item2 items;
    user_stats user_trade_stats;
    category_match FLOAT := 0;
    tag_match FLOAT := 0;
    value_match FLOAT := 0;
    location_match FLOAT := 0;
    condition_match FLOAT := 0;
    popularity_match FLOAT := 0;
    age_match FLOAT := 0;
    preference_match FLOAT := 0;
    total_score FLOAT := 0;
    reasons JSONB := '{}'::jsonb;
BEGIN
    -- Get items and user stats
    SELECT * INTO item1 FROM items WHERE id = item1_id;
    SELECT * INTO item2 FROM items WHERE id = item2_id;
    IF user_id IS NOT NULL THEN
        SELECT * INTO user_stats FROM user_trade_stats WHERE user_id = user_id;
    END IF;

    -- Category match (25%)
    IF item1.category = item2.category THEN
        category_match := 0.25;
        reasons = reasons || '{"category": "Items are in the same category"}'::jsonb;
    END IF;

    -- Tag match (15%)
    SELECT COALESCE(
        ARRAY_LENGTH(ARRAY(
            SELECT UNNEST(item1.tags)
            INTERSECT
            SELECT UNNEST(item2.tags)
        ), 1)::FLOAT / 
        GREATEST(
            ARRAY_LENGTH(item1.tags, 1),
            ARRAY_LENGTH(item2.tags, 1)
        )::FLOAT * 0.15,
        0
    ) INTO tag_match;
    IF tag_match > 0 THEN
        reasons = reasons || jsonb_build_object('tags', 
            format('Items share %s%% of tags', (tag_match / 0.15 * 100)::int));
    END IF;

    -- Value match (15%)
    IF item1.estimated_value > 0 AND item2.estimated_value > 0 THEN
        value_match := (1 - ABS(item1.estimated_value - item2.estimated_value) / 
            GREATEST(item1.estimated_value, item2.estimated_value)) * 0.15;
        IF value_match > 0.1 THEN
            reasons = reasons || '{"value": "Items have similar estimated values"}'::jsonb;
        END IF;
    END IF;

    -- Location match (10%)
    IF item1.location_lat IS NOT NULL AND item1.location_lng IS NOT NULL AND
       item2.location_lat IS NOT NULL AND item2.location_lng IS NOT NULL THEN
        WITH distance AS (
            SELECT (
                6371 * acos(
                    cos(radians(item1.location_lat)) * 
                    cos(radians(item2.location_lat)) * 
                    cos(radians(item2.location_lng) - radians(item1.location_lng)) + 
                    sin(radians(item1.location_lat)) * 
                    sin(radians(item2.location_lat))
                )
            ) as km
        )
        SELECT 
            CASE 
                WHEN km <= 5 THEN 0.10
                WHEN km <= 20 THEN 0.07
                WHEN km <= 50 THEN 0.05
                WHEN km <= 100 THEN 0.02
                ELSE 0
            END,
            CASE 
                WHEN km <= 5 THEN 'Items are very close (within 5km)'
                WHEN km <= 20 THEN 'Items are nearby (within 20km)'
                WHEN km <= 50 THEN 'Items are in the same region'
                WHEN km <= 100 THEN 'Items are within 100km'
            END
        INTO location_match, reasons
        FROM distance;
        IF location_match > 0 THEN
            reasons = reasons || jsonb_build_object('location', reasons);
        END IF;
    END IF;

    -- Condition match (10%)
    IF item1.condition = item2.condition THEN
        condition_match := 0.10;
        reasons = reasons || '{"condition": "Items are in similar condition"}'::jsonb;
    ELSIF (item1.condition IN ('new', 'like_new') AND item2.condition IN ('new', 'like_new')) OR
          (item1.condition IN ('good', 'fair') AND item2.condition IN ('good', 'fair')) THEN
        condition_match := 0.05;
        reasons = reasons || '{"condition": "Items are in comparable condition"}'::jsonb;
    END IF;

    -- Popularity and age match (15%)
    popularity_match := LEAST(
        (COALESCE(item1.popularity_score, 0) + COALESCE(item2.popularity_score, 0))::FLOAT / 100,
        0.10
    );
    IF popularity_match > 0.05 THEN
        reasons = reasons || '{"popularity": "Both items are popular"}'::jsonb;
    END IF;

    -- Age match (5%)
    IF ABS(EXTRACT(EPOCH FROM (item1.created_at - item2.created_at)) / 86400) <= 30 THEN
        age_match := 0.05;
        reasons = reasons || '{"age": "Items were listed around the same time"}'::jsonb;
    END IF;

    -- User preference match (5%)
    IF user_id IS NOT NULL AND user_stats IS NOT NULL THEN
        IF user_stats.category_preferences ? item2.category THEN
            preference_match := 0.05;
            reasons = reasons || '{"preference": "Matches your trading preferences"}'::jsonb;
        END IF;
    END IF;

    total_score := category_match + tag_match + value_match + location_match + 
                   condition_match + popularity_match + age_match + preference_match;

    RETURN QUERY SELECT total_score, reasons;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL ON saved_matches TO authenticated;
GRANT ALL ON user_trade_stats TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_enhanced_match_score TO authenticated;
GRANT EXECUTE ON FUNCTION update_item_popularity TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_trade_stats TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_saved_matches_user ON saved_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_items_condition ON items(condition);
CREATE INDEX IF NOT EXISTS idx_items_popularity ON items(popularity_score);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
CREATE INDEX IF NOT EXISTS idx_user_trade_stats_preferences ON user_trade_stats USING gin(category_preferences); 