-- Migration: Convert single photocopy/reg_fee columns to JSONB arrays for multi-row support

-- Step 1: Add new JSONB columns
ALTER TABLE teacher_invoices
  ADD COLUMN photocopy_rows jsonb DEFAULT '[{"label": "B/W", "price": 0.05, "prev_reading": 0, "curr_reading": 0}]';

ALTER TABLE teacher_invoices
  ADD COLUMN reg_fee_rows jsonb DEFAULT '[{"label": "Registration", "students": 0, "fee": 50, "rebate": 25}]';

-- Step 2: Migrate existing data from old columns into new JSONB format
UPDATE teacher_invoices
SET photocopy_rows = jsonb_build_array(
  jsonb_build_object(
    'label', 'B/W',
    'price', COALESCE(photocopy_price, 0.05),
    'prev_reading', COALESCE(photocopy_prev_reading, 0),
    'curr_reading', COALESCE(photocopy_curr_reading, 0)
  )
);

UPDATE teacher_invoices
SET reg_fee_rows = jsonb_build_array(
  jsonb_build_object(
    'label', 'Registration',
    'students', COALESCE(reg_fee_students, 0),
    'fee', COALESCE(reg_fee_per_student, 50),
    'rebate', COALESCE(reg_fee_rebate, 25)
  )
);

-- Step 3: Drop old columns
ALTER TABLE teacher_invoices
  DROP COLUMN photocopy_price,
  DROP COLUMN photocopy_prev_reading,
  DROP COLUMN photocopy_curr_reading,
  DROP COLUMN reg_fee_students,
  DROP COLUMN reg_fee_per_student,
  DROP COLUMN reg_fee_rebate;
