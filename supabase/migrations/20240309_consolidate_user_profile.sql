-- Drop existing functions and triggers if they exist
DROP TRIGGER IF EXISTS update_user_last_active ON users;
DROP FUNCTION IF EXISTS update_last_active();
DROP FUNCTION IF EXISTS add_bio_column();

-- Ensure all required columns exist in users table
DO $$ 
BEGIN
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bio') THEN
        ALTER TABLE users ADD COLUMN bio TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone_number') THEN
        ALTER TABLE users ADD COLUMN phone_number VARCHAR(20);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'location') THEN
        ALTER TABLE users ADD COLUMN location VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'rating') THEN
        ALTER TABLE users ADD COLUMN rating DECIMAL(3,2) DEFAULT 5.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'total_ratings') THEN
        ALTER TABLE users ADD COLUMN total_ratings INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'verification_status') THEN
        ALTER TABLE users ADD COLUMN verification_status VARCHAR(20) DEFAULT 'unverified';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'join_date') THEN
        ALTER TABLE users ADD COLUMN join_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_active') THEN
        ALTER TABLE users ADD COLUMN last_active TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'successful_trades') THEN
        ALTER TABLE users ADD COLUMN successful_trades INTEGER DEFAULT 0;
    END IF;

    -- Create or replace indexes
    DROP INDEX IF EXISTS idx_users_location;
    CREATE INDEX idx_users_location ON users(location);
    
    DROP INDEX IF EXISTS idx_users_rating;
    CREATE INDEX idx_users_rating ON users(rating);
    
    DROP INDEX IF EXISTS idx_users_verification_status;
    CREATE INDEX idx_users_verification_status ON users(verification_status);
    
    DROP INDEX IF EXISTS idx_users_bio;
    CREATE INDEX idx_users_bio ON users(bio);
END $$;

-- Recreate the last_active update function
CREATE OR REPLACE FUNCTION update_last_active()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_active = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER update_user_last_active
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_last_active();

-- Grant necessary permissions
GRANT UPDATE (
    name,
    bio,
    phone_number,
    location,
    verification_status,
    last_active,
    profile_image_url
) ON users TO authenticated; 