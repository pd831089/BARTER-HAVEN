-- Remove verification system from users table
-- This migration removes the verification_status column and related indexes

-- Drop the verification status index first
DROP INDEX IF EXISTS idx_users_verification_status;

-- Remove the verification_status column from users table
ALTER TABLE users DROP COLUMN IF EXISTS verification_status;

-- Remove the verified column from bill_documents table if it exists
ALTER TABLE bill_documents DROP COLUMN IF EXISTS verified;

-- Update any existing functions or triggers that might reference verification_status
-- (Add any specific function updates here if needed)

-- Note: This migration removes the verification system entirely
-- Users will no longer have verification status tracking 