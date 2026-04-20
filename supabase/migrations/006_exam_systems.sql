-- Exam systems: dynamic admin-managed list
CREATE TABLE IF NOT EXISTS exam_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Seed defaults
INSERT INTO exam_systems (name) VALUES ('SPM'), ('UEC'), ('IGCSE'), ('A-Level'), ('KSSM')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE exam_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read exam_systems" ON exam_systems
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage exam_systems" ON exam_systems
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
