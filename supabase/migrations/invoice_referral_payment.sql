-- Migration: Add referral_rows, payment_status, payment_date to teacher_invoices

ALTER TABLE teacher_invoices
  ADD COLUMN referral_rows jsonb DEFAULT '[]';

ALTER TABLE teacher_invoices
  ADD COLUMN payment_status text DEFAULT '';

ALTER TABLE teacher_invoices
  ADD COLUMN payment_date text DEFAULT '';
