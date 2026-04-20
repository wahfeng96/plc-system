-- Headcount & Rental overrides (admin can manually adjust per teacher per month)
CREATE TABLE IF NOT EXISTS headcount_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers ON DELETE CASCADE,
  month text NOT NULL, -- '2026-01'
  students_override integer,
  hours_override integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE (teacher_id, month)
);

ALTER TABLE headcount_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read headcount_overrides" ON headcount_overrides
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage headcount_overrides" ON headcount_overrides
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
