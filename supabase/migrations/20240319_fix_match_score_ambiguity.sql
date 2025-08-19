-- Fix ambiguous column reference in find_potential_matches function
-- This migration resolves the "column reference match_score is ambiguous" error
-- and fixes permission denied error by using users table instead of auth.users

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
            calculate_item_match_score(p_item_id, i.id) as calculated_match_score,
            i.title as item_title,
            i.image_url as item_image_url,
            i.user_id as owner_id,
            COALESCE(u.name, 'Unknown User') as owner_name,
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
        LEFT JOIN users u ON i.user_id = u.id
        CROSS JOIN (SELECT location_lat, location_lng FROM items WHERE id = p_item_id) src
        WHERE 
            i.id != p_item_id
            AND i.status = 'available'
            AND i.user_id != (SELECT user_id FROM items WHERE id = p_item_id)
    )
    SELECT 
        item_scores.matched_item_id,
        item_scores.calculated_match_score as match_score,
        item_scores.item_title,
        item_scores.item_image_url,
        item_scores.owner_id,
        item_scores.owner_name,
        item_scores.estimated_value,
        item_scores.distance_km
    FROM item_scores
    WHERE item_scores.calculated_match_score >= p_min_score
    ORDER BY item_scores.calculated_match_score DESC, item_scores.distance_km ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql; 