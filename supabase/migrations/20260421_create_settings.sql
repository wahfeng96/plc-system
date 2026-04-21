-- Settings table for system-wide configuration
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default rates
INSERT INTO settings (key, value, description) VALUES
  ('rate_per_hour', '15', 'Rental fee per hour (RM)'),
  ('rate_per_student', '5', 'Head count fee per student (RM)')
ON CONFLICT (key) DO NOTHING;

-- RLS policies
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY settings_admin_all ON settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Everyone can read settings
CREATE POLICY settings_read_all ON settings
  FOR SELECT
  TO authenticated
  USING (true);
