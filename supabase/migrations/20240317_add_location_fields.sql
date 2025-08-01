-- Add location fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_street TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_region TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_postal_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_country TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP WITH TIME ZONE;

-- Add location fields to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE items ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE items ADD COLUMN IF NOT EXISTS address_street TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS address_city TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS address_region TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS address_postal_code TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS address_country TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for location-based queries
CREATE INDEX IF NOT EXISTS idx_users_location_coords ON users(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_items_location_coords ON items(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_users_address_city ON users(address_city);
CREATE INDEX IF NOT EXISTS idx_items_address_city ON items(address_city);

-- Drop existing functions if they exist to avoid conflicts
-- Drop with specific signatures to avoid ambiguity
DROP FUNCTION IF EXISTS calculate_distance(DECIMAL, DECIMAL, DECIMAL, DECIMAL);
DROP FUNCTION IF EXISTS calculate_distance(NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS calculate_distance(REAL, REAL, REAL, REAL);
DROP FUNCTION IF EXISTS calculate_distance(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

DROP FUNCTION IF EXISTS find_items_within_radius(DECIMAL, DECIMAL, DECIMAL);
DROP FUNCTION IF EXISTS find_items_within_radius(NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS find_items_within_radius(REAL, REAL, REAL);
DROP FUNCTION IF EXISTS find_items_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

-- Create a function to calculate distance between two points using Haversine formula
CREATE OR REPLACE FUNCTION calculate_haversine_distance(
    lat1 DECIMAL,
    lon1 DECIMAL,
    lat2 DECIMAL,
    lon2 DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    R DECIMAL := 6371; -- Earth's radius in kilometers
    dlat DECIMAL;
    dlon DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    -- Convert degrees to radians
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    
    -- Haversine formula
    a := sin(dlat/2) * sin(dlat/2) + 
         cos(radians(lat1)) * cos(radians(lat2)) * 
         sin(dlon/2) * sin(dlon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    
    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a function to find items within a certain radius
CREATE OR REPLACE FUNCTION find_items_within_radius(
    user_lat DECIMAL,
    user_lon DECIMAL,
    radius_km DECIMAL DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    category TEXT,
    image_url TEXT,
    user_id UUID,
    status TEXT,
    latitude DECIMAL,
    longitude DECIMAL,
    address_city TEXT,
    distance_km DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.title,
        i.description,
        i.category,
        i.image_url,
        i.user_id,
        i.status,
        i.latitude,
        i.longitude,
        i.address_city,
        calculate_haversine_distance(user_lat, user_lon, i.latitude, i.longitude) as distance_km
    FROM items i
    WHERE i.status = 'available'
        AND i.latitude IS NOT NULL 
        AND i.longitude IS NOT NULL
        AND calculate_haversine_distance(user_lat, user_lon, i.latitude, i.longitude) <= radius_km
    ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION calculate_haversine_distance TO authenticated;
GRANT EXECUTE ON FUNCTION find_items_within_radius TO authenticated; 