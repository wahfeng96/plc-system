-- Monthly fee per schedule (shared for all students in that class)
-- Default RM100, admin can edit per month
CREATE TABLE IF NOT EXISTS class_monthly_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES schedules ON DELETE CASCADE,
  month text NOT NULL, -- '2026-01', '2026-02', etc.
  amount numeric NOT NULL DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  UNIQUE (schedule_id, month)
);

ALTER TABLE class_monthly_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read class_monthly_fees" ON class_monthly_fees
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage class_monthly_fees" ON class_monthly_fees
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Ensure tuition_payments has schedule_id column (add if not exists)
-- We'll use: student_id + schedule_id + month as the unique key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tuition_payments' AND column_name = 'schedule_id'
  ) THEN
    ALTER TABLE tuition_payments ADD COLUMN schedule_id uuid REFERENCES schedules ON DELETE CASCADE;
  END IF;
END $$;

-- Add unique constraint for the grid pattern
-- (student can only have one payment record per schedule per month)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tuition_payments_student_schedule_month_key'
  ) THEN
    ALTER TABLE tuition_payments ADD CONSTRAINT tuition_payments_student_schedule_month_key
      UNIQUE (student_id, schedule_id, month);
  END IF;
END $$;
