-- Teacher invoices: comprehensive monthly billing for teachers
-- Replaces the simple invoices/invoice_items system with full editable fields

CREATE TABLE teacher_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES teachers(id) NOT NULL,
  month text NOT NULL, -- '2026-04'

  -- Room rental (3 tiers)
  rental_rate_1 numeric DEFAULT 22,
  rental_hours_1 numeric DEFAULT 0,
  rental_rate_2 numeric DEFAULT 20,
  rental_hours_2 numeric DEFAULT 0,
  rental_rate_3 numeric DEFAULT 12,
  rental_hours_3 numeric DEFAULT 0,

  -- Photocopy
  photocopy_price numeric DEFAULT 0.05,
  photocopy_prev_reading numeric DEFAULT 0,
  photocopy_curr_reading numeric DEFAULT 0,

  -- Registration fee
  reg_fee_students integer DEFAULT 0,
  reg_fee_per_student numeric DEFAULT 50,
  reg_fee_rebate numeric DEFAULT 25,

  -- Overdue
  overdue_amount numeric DEFAULT 0,
  overdue_description text DEFAULT '',

  -- Bank details
  bank_name text DEFAULT 'RHB',
  bank_account text DEFAULT '26003200018111',
  bank_account_name text DEFAULT 'PERSEVERANCE LEARNING CENTRE',

  -- Remark
  remark text DEFAULT 'Please make payment to Jaycie or bank transfer to the account above. Thank you.',

  -- Status
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid')),
  issued_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(teacher_id, month)
);

-- RLS
ALTER TABLE teacher_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage teacher_invoices" ON teacher_invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Teachers view own invoices" ON teacher_invoices
  FOR SELECT USING (
    teacher_id IN (
      SELECT id FROM teachers WHERE user_id = auth.uid()
    )
  );
