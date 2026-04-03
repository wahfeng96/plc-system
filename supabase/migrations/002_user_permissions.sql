-- Add page access control to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allowed_pages text[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
