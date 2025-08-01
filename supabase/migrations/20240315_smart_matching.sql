-- Create user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    preferred_categories TEXT[],
    preferred_tags TEXT[],
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    max_distance_km INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create item tags table
CREATE TABLE IF NOT EXISTS item_tags (
    item_id UUID REFERENCES items(id),
    tag TEXT,
    PRIMARY KEY (item_id, tag)
);

-- Add columns to items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS estimated_value DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Function to calculate matching score between two items
CREATE OR REPLACE FUNCTION calculate_item_match_score(
    item1_id UUID,
    item2_id UUID
)
RETURNS FLOAT AS $$
DECLARE
    item1 items;
    item2 items;
    category_match FLOAT := 0;
    tag_match FLOAT := 0;
    value_match FLOAT := 0;
    location_match FLOAT := 0;
    total_score FLOAT := 0;
BEGIN
    -- Get items
    SELECT * INTO item1 FROM items WHERE id = item1_id;
    SELECT * INTO item2 FROM items WHERE id = item2_id;
    
    -- Category match (30% weight)
    IF item1.category = item2.category THEN
        category_match := 0.3;
    END IF;
    
    -- Tag match (25% weight)
    SELECT COALESCE(
        ARRAY_LENGTH(ARRAY(
            SELECT UNNEST(item1.tags)
            INTERSECT
            SELECT UNNEST(item2.tags)
        ), 1)::FLOAT / 
        GREATEST(
            ARRAY_LENGTH(item1.tags, 1),
            ARRAY_LENGTH(item2.tags, 1)
        )::FLOAT * 0.25,
        0
    ) INTO tag_match;
    
    -- Value match (25% weight)
    IF item1.estimated_value > 0 AND item2.estimated_value > 0 THEN
        value_match := (1 - ABS(item1.estimated_value - item2.estimated_value) / 
            GREATEST(item1.estimated_value, item2.estimated_value)) * 0.25;
    END IF;
    
    -- Location match (20% weight)
    IF item1.location_lat IS NOT NULL AND item1.location_lng IS NOT NULL AND
       item2.location_lat IS NOT NULL AND item2.location_lng IS NOT NULL THEN
        -- Calculate distance using Haversine formula
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
                WHEN km <= 5 THEN 0.2
                WHEN km <= 20 THEN 0.15
                WHEN km <= 50 THEN 0.1
                WHEN km <= 100 THEN 0.05
                ELSE 0
            END 
        INTO location_match
        FROM distance;
    END IF;
    
    total_score := category_match + tag_match + value_match + location_match;
    RETURN total_score;
END;
$$ LANGUAGE plpgsql;

-- Function to find potential matches for an item
CREATE OR REPLACE FUNCTION find_potential_matches(
    p_item_id UUID,
    p_min_score FLOAT DEFAULT 0.3,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    matched_item_id UUID,
    match_score FLOAT,
    item_title TEXT,
    item_image_url TEXT,
    owner_id UUID,
    owner_name TEXT,
    estimated_value DECIMAL(10,2),
    distance_km FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH item_scores AS (
        SELECT 
            i.id as matched_item_id,
            calculate_item_match_score(p_item_id, i.id) as match_score,
            i.title as item_title,
            i.image_url as item_image_url,
            i.user_id as owner_id,
            u.raw_user_meta_data->>'name' as owner_name,
            i.estimated_value,
            CASE 
                WHEN i.location_lat IS NOT NULL AND i.location_lng IS NOT NULL THEN
                    (6371 * acos(
                        cos(radians(src.location_lat)) * 
                        cos(radians(i.location_lat)) * 
                        cos(radians(i.location_lng) - radians(src.location_lng)) + 
                        sin(radians(src.location_lat)) * 
                        sin(radians(i.location_lat))
                    ))
                ELSE NULL
            END as distance_km
        FROM items i
        JOIN auth.users u ON i.user_id = u.id
        CROSS JOIN (SELECT location_lat, location_lng FROM items WHERE id = p_item_id) src
        WHERE 
            i.id != p_item_id
            AND i.status = 'available'
            AND i.user_id != (SELECT user_id FROM items WHERE id = p_item_id)
    )
    SELECT *
    FROM item_scores
    WHERE match_score >= p_min_score
    ORDER BY match_score DESC, distance_km ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL ON user_preferences TO authenticated;
GRANT ALL ON item_tags TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_item_match_score TO authenticated;
GRANT EXECUTE ON FUNCTION find_potential_matches TO authenticated;

-- Create indexes for better performance
CREATE INDEX idx_items_status_location ON items(status, location_lat, location_lng);
CREATE INDEX idx_items_tags ON items USING gin(tags);
CREATE INDEX idx_user_preferences_location ON user_preferences(location_lat, location_lng); 