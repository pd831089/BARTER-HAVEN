-- Test script to verify the location migration works correctly
-- Run this in your Supabase SQL editor to test the functions

-- Test the calculate_haversine_distance function
SELECT calculate_haversine_distance(40.7128, -74.0060, 34.0522, -118.2437) as distance_ny_to_la;

-- Test the find_items_within_radius function (will return empty if no items exist)
SELECT * FROM find_items_within_radius(40.7128, -74.0060, 50);

-- Test adding location fields to a test user (replace with actual user ID)
-- UPDATE users SET 
--   latitude = 40.7128,
--   longitude = -74.0060,
--   address_city = 'New York',
--   address_country = 'USA',
--   location_updated_at = NOW()
-- WHERE id = 'your-user-id-here';

-- Test adding location fields to a test item (replace with actual item ID)
-- UPDATE items SET 
--   latitude = 34.0522,
--   longitude = -118.2437,
--   address_city = 'Los Angeles',
--   address_country = 'USA',
--   location_updated_at = NOW()
-- WHERE id = 'your-item-id-here'; 