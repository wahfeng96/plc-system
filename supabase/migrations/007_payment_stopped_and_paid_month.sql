-- Add paid_month column for reg fee payment month tracking
-- Add 'stopped' as a valid payment status
ALTER TABLE tuition_payments ADD COLUMN IF NOT EXISTS paid_month text;
-- status can now be: 'unpaid', 'paid', 'stopped'
